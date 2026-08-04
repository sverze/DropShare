import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CompletedPart,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Readable } from "stream";
import * as dns from "dns";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { pipeline } from "stream/promises";
import { ConfigService } from "src/config/config.service";

const DEFAULT_MULTIPART_THRESHOLD = 50 * 1024 * 1024;
const DEFAULT_MULTIPART_PART_SIZE = 10 * 1024 * 1024;
const MIN_MULTIPART_PART_SIZE = 5 * 1024 * 1024;

const readPositiveInt = (
  value: string | undefined,
  fallback: number,
  min = 1,
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
};

const ipv4Lookup: https.AgentOptions["lookup"] = (
  hostname,
  options,
  callback,
) => {
  dns.lookup(hostname, { ...options, family: 4 }, callback);
};

export interface MultipartUploadInit {
  uploadId: string;
  key: string;
  partSize: number;
  totalParts: number;
}

export interface PartUploadUrl {
  partNumber: number;
  url: string;
}

export interface StorageObjectSummary {
  key: string;
  size?: number;
  lastModified?: Date;
}

export interface StorageBucketSlice {
  bytes: number;
  objects: number;
}

export interface StorageBreakdown {
  enabled: boolean;
  generatedAt: string;
  cached: boolean;
  totalBytes: number;
  totalObjects: number;
  /** shares/<shareId>/<fileId> - the uploads themselves */
  sourceFiles: StorageBucketSlice;
  /** shares/<shareId>/archive.zip - regenerable download-all archives */
  zips: StorageBucketSlice;
  /** shares/<shareId>/previews/... - regenerable thumbnails and HLS renditions */
  previews: StorageBucketSlice;
  /** anything else, e.g. email-headers/ */
  other: StorageBucketSlice;
}

export type StorageErrorCode =
  | "STORAGE_TIMEOUT"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_NOT_FOUND"
  | "STORAGE_ERROR";

export class StorageOperationError extends Error {
  readonly code: StorageErrorCode;
  readonly operation: string;
  readonly key: string;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(options: {
    code: StorageErrorCode;
    operation: string;
    key: string;
    message: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "StorageOperationError";
    this.code = options.code;
    this.operation = options.operation;
    this.key = options.key;
    this.retryable = options.retryable;
    this.cause = options.cause;
  }
}

interface StorageFailureMetric {
  at: Date;
  code: StorageErrorCode;
  operation: string;
  key: string;
  message: string;
}

interface SourceCacheEntry {
  path: string;
  size: number;
  mtimeMs: number;
}

export interface SourceCacheStats {
  path: string;
  maxBytes: number;
  maxAgeMs: number;
  cleanupIntervalMs: number;
  totalBytes: number;
  fileCount: number;
  activeDownloads: number;
  oldestMtime: Date | null;
  newestMtime: Date | null;
}

@Injectable()
export class R2StorageService implements OnModuleInit {
  private readonly logger = new Logger(R2StorageService.name);
  private client: S3Client;
  private presignClient: S3Client;
  private downloadClient: S3Client;
  private interactiveDownloadClient: S3Client;
  private bucket: string;
  private publicUrl: string;
  private enabled: boolean;

  private uploadQueue: Array<() => Promise<void>> = [];
  private activeUploads = 0;
  private readonly MAX_CONCURRENT_UPLOADS = 5;
  private readonly UPLOAD_DELAY_MS = 50;

  private downloadQueue: Array<() => Promise<void>> = [];
  private activeDownloads = 0;
  private readonly MAX_CONCURRENT_DOWNLOADS = readPositiveInt(
    process.env.R2_MAX_CONCURRENT_DOWNLOADS,
    3,
  );
  private readonly DOWNLOAD_DELAY_MS = readPositiveInt(
    process.env.R2_DOWNLOAD_DELAY_MS,
    100,
    0,
  );
  private readonly DOWNLOAD_RETRY_ATTEMPTS = readPositiveInt(
    process.env.R2_DOWNLOAD_RETRY_ATTEMPTS,
    4,
  );
  private readonly DOWNLOAD_RETRY_BASE_DELAY_MS = readPositiveInt(
    process.env.R2_DOWNLOAD_RETRY_BASE_DELAY_MS,
    2000,
    0,
  );
  private readonly INTERACTIVE_DOWNLOAD_RETRY_ATTEMPTS = readPositiveInt(
    process.env.R2_INTERACTIVE_DOWNLOAD_RETRY_ATTEMPTS,
    3,
  );
  private readonly INTERACTIVE_DOWNLOAD_RETRY_BASE_DELAY_MS = readPositiveInt(
    process.env.R2_INTERACTIVE_DOWNLOAD_RETRY_BASE_DELAY_MS,
    1000,
    0,
  );
  private readonly DOWNLOAD_REQUEST_TIMEOUT_MS = readPositiveInt(
    process.env.R2_DOWNLOAD_REQUEST_TIMEOUT_MS,
    240000,
  );
  private readonly DOWNLOAD_CONNECTION_TIMEOUT_MS = readPositiveInt(
    process.env.R2_DOWNLOAD_CONNECTION_TIMEOUT_MS,
    15000,
  );
  private readonly INTERACTIVE_REQUEST_TIMEOUT_MS = readPositiveInt(
    process.env.R2_INTERACTIVE_REQUEST_TIMEOUT_MS,
    60000,
  );
  private readonly INTERACTIVE_CONNECTION_TIMEOUT_MS = readPositiveInt(
    process.env.R2_INTERACTIVE_CONNECTION_TIMEOUT_MS,
    10000,
  );
  private readonly DOWNLOAD_CLIENT_REFRESH_FAILURES = readPositiveInt(
    process.env.R2_DOWNLOAD_CLIENT_REFRESH_FAILURES,
    8,
  );
  private readonly recentFailures: StorageFailureMetric[] = [];
  private readonly sourceDownloadLocks = new Map<string, Promise<string>>();
  private readonly RECENT_FAILURE_WINDOW_MS = Number(
    process.env.R2_FAILURE_METRIC_WINDOW_MS || 15 * 60 * 1000,
  );
  private readonly MAX_RECENT_FAILURES = 200;
  private readonly SOURCE_CACHE_DIR =
    process.env.R2_SOURCE_CACHE_DIR ||
    path.resolve(process.cwd(), "data/storage-source-cache");
  private readonly SOURCE_CACHE_MAX_BYTES = Number(
    process.env.R2_SOURCE_CACHE_MAX_BYTES || 10 * 1024 * 1024 * 1024,
  );
  private readonly SOURCE_CACHE_MAX_AGE_MS = Number(
    process.env.R2_SOURCE_CACHE_MAX_AGE_MS || 30 * 60 * 1000,
  );
  private readonly SOURCE_CACHE_CLEANUP_INTERVAL_MS = Number(
    process.env.R2_SOURCE_CACHE_CLEANUP_INTERVAL_MS || 5 * 60 * 1000,
  );
  private lastSourceCacheCleanupAt = 0;
  private sourceCacheCleanupRunning = false;
  private consecutiveDownloadFailures = 0;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.forceIpv4DnsOrder();
    await fs.promises
      .mkdir(this.SOURCE_CACHE_DIR, { recursive: true })
      .catch((error) =>
        this.logger.warn(
          `Failed to create source cache directory ${this.SOURCE_CACHE_DIR}: ${error.message}`,
        ),
      );
    this.initializeClients();
    this.configService.on("update", (key: string) => {
      if (key.startsWith("s3.")) {
        this.initializeClients();
      }
    });
  }

  private forceIpv4DnsOrder() {
    const setDefaultResultOrder = dns.setDefaultResultOrder;
    if (!setDefaultResultOrder) return;

    try {
      setDefaultResultOrder("ipv4first");
      this.logger.log("Storage DNS result order set to ipv4first");
    } catch (error) {
      this.logger.warn(
        `Could not set storage DNS result order to ipv4first: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private initializeClients() {
    const config = this.resolveStorageConfig();

    this.enabled = config.enabled;

    if (!this.enabled) {
      this.bucket = "";
      this.publicUrl = "";
      this.client = undefined;
      this.presignClient = undefined;
      this.downloadClient = undefined;
      this.interactiveDownloadClient = undefined;
      this.logger.log("Cloud storage is disabled");
      return;
    }

    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;

    const uploadAgent = new https.Agent({
      maxSockets: 50,
      maxFreeSockets: 15,
      keepAlive: true,
      keepAliveMsecs: 10000,
      timeout: 60000,
      family: 4,
      lookup: ipv4Lookup,
    });

    const downloadAgent = new https.Agent({
      maxSockets: Math.max(4, this.MAX_CONCURRENT_DOWNLOADS * 2),
      maxFreeSockets: 0,
      keepAlive: false,
      timeout: this.DOWNLOAD_REQUEST_TIMEOUT_MS,
      family: 4,
      lookup: ipv4Lookup,
    });

    const interactiveDownloadAgent = new https.Agent({
      maxSockets: 10,
      maxFreeSockets: 0,
      keepAlive: false,
      timeout: this.INTERACTIVE_REQUEST_TIMEOUT_MS,
      family: 4,
      lookup: ipv4Lookup,
    });

    this.logger.log(
      `Storage config - endpoint: ${config.endpoint}, region: ${config.region}`,
    );
    if (this.publicUrl) {
      this.logger.log(`CDN configured: ${this.publicUrl}`);
    }

    // Static keys win when they are configured. When they are absent, omit
    // `credentials` entirely rather than handing the SDK a pair of empty
    // strings: an explicit credentials object short-circuits the default
    // provider chain, which is what supplies an ECS/Fargate task role, an EC2
    // instance profile, or AWS_* environment credentials.
    const hasStaticCredentials = Boolean(
      config.accessKeyId && config.secretAccessKey,
    );

    const baseClientConfig = {
      region: config.region,
      endpoint: config.endpoint,
      ...(hasStaticCredentials
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
      forcePathStyle: config.forcePathStyle,
    };

    this.client = new S3Client({
      ...baseClientConfig,
      requestHandler: new NodeHttpHandler({
        httpsAgent: uploadAgent,
        requestTimeout: 300000,
        connectionTimeout: 60000,
      }),
      maxAttempts: 3,
    });

    this.presignClient = new S3Client({
      ...baseClientConfig,
      requestHandler: new NodeHttpHandler({
        httpsAgent: uploadAgent,
        requestTimeout: 300000,
        connectionTimeout: 60000,
      }),
      maxAttempts: 3,
    });

    this.presignClient.middlewareStack.add(
      (next) => async (args: any) => {
        if (args.request?.headers) {
          delete args.request.headers["x-amz-sdk-checksum-algorithm"];
          delete args.request.headers["x-amz-checksum-crc32"];
          delete args.request.headers["x-amz-checksum-crc32c"];
          delete args.request.headers["x-amz-checksum-sha1"];
          delete args.request.headers["x-amz-checksum-sha256"];
          delete args.request.headers["x-amz-checksum-mode"];
        }
        if (args.request?.query) {
          delete args.request.query["x-amz-sdk-checksum-algorithm"];
          delete args.request.query["x-amz-checksum-crc32"];
          delete args.request.query["x-amz-checksum-crc32c"];
          delete args.request.query["x-amz-checksum-sha1"];
          delete args.request.query["x-amz-checksum-sha256"];
          delete args.request.query["x-amz-checksum-mode"];
          delete args.request.query["x-id"];
        }
        return next(args);
      },
      {
        step: "build",
        name: "removeB2IncompatibleParams",
        priority: "high",
      },
    );

    this.downloadClient = new S3Client({
      ...baseClientConfig,
      requestHandler: new NodeHttpHandler({
        httpsAgent: downloadAgent,
        requestTimeout: this.DOWNLOAD_REQUEST_TIMEOUT_MS,
        connectionTimeout: this.DOWNLOAD_CONNECTION_TIMEOUT_MS,
      }),
      maxAttempts: 3,
    });

    this.interactiveDownloadClient = new S3Client({
      ...baseClientConfig,
      requestHandler: new NodeHttpHandler({
        httpsAgent: interactiveDownloadAgent,
        requestTimeout: this.INTERACTIVE_REQUEST_TIMEOUT_MS,
        connectionTimeout: this.INTERACTIVE_CONNECTION_TIMEOUT_MS,
      }),
      maxAttempts: readPositiveInt(process.env.R2_INTERACTIVE_SDK_ATTEMPTS, 2),
    });

    this.consecutiveDownloadFailures = 0;

    const provider = config.endpoint.includes("backblazeb2")
      ? "Backblaze B2"
      : config.endpoint.includes("r2.cloudflarestorage")
        ? "Cloudflare R2"
        : "S3-Compatible";
    this.logger.log(
      `${provider} storage initialized - bucket: ${this.bucket}, region: ${config.region}, B2-compatible presigning: yes`,
    );
  }

  private resolveStorageConfig() {
    const configEnabled = this.configService.get("s3.enabled");
    const configEndpoint = this.getConfigString("s3.endpoint");
    const configBucket = this.getConfigString("s3.bucketName");
    const configKey = this.getConfigString("s3.key");
    const configSecret = this.getConfigString("s3.secret");
    const configRegion = this.getConfigString("s3.region");
    const configPublicUrl = this.getConfigString("s3.publicUrl");
    const hasConfigPublicUrl = this.configService.has("s3.publicUrl");

    const hasUiConfig =
      configEnabled &&
      Boolean(configEndpoint) &&
      Boolean(configBucket) &&
      Boolean(configKey) &&
      Boolean(configSecret);

    const endpoint =
      configEndpoint ||
      process.env.R2_ENDPOINT ||
      "https://s3.us-east-005.backblazeb2.com";
    const region =
      configRegion || process.env.R2_REGION || this.deriveRegion(endpoint);

    return {
      enabled: hasUiConfig || process.env.R2_ENABLED === "true",
      endpoint,
      region,
      bucket: configBucket || process.env.R2_BUCKET || "dropshare",
      accessKeyId: configKey || process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: configSecret || process.env.R2_SECRET_ACCESS_KEY || "",
      publicUrl: hasConfigPublicUrl
        ? configPublicUrl
        : process.env.R2_PUBLIC_URL || "",
      // Path-style addressing is what B2 and R2 expect and stays the default.
      // Amazon S3 accepts it too, but steers new deployments at virtual-host
      // addressing, so allow opting out without touching code.
      forcePathStyle: process.env.R2_FORCE_PATH_STYLE !== "false",
    };
  }

  private getConfigString(key: `${string}.${string}`): string {
    const value = this.configService.get(key);
    return typeof value === "string" ? value.trim() : "";
  }

  private isRetryableStorageError(error: unknown) {
    if (error instanceof StorageOperationError) return error.retryable;

    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "";

    return [
      "TimeoutError",
      "ECONNRESET",
      "ECONNREFUSED",
      "EPIPE",
      "ETIMEDOUT",
      "ENOTFOUND",
      "socket",
      "connection",
      "request timeout",
      "temporarily unavailable",
    ].some((needle) =>
      `${name} ${message}`.toLowerCase().includes(needle.toLowerCase()),
    );
  }

  private getStorageErrorCode(error: unknown): StorageErrorCode {
    if (error instanceof StorageOperationError) return error.code;

    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "";
    const combined = `${name} ${message}`.toLowerCase();
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;

    if (
      statusCode === 404 ||
      combined.includes("not found") ||
      combined.includes("nosuchkey")
    ) {
      return "STORAGE_NOT_FOUND";
    }

    if (
      combined.includes("abort") ||
      combined.includes("timeout") ||
      combined.includes("timed out") ||
      combined.includes("etimedout") ||
      combined.includes("request socket did not establish")
    ) {
      return "STORAGE_TIMEOUT";
    }

    if (
      combined.includes("econnreset") ||
      combined.includes("econnrefused") ||
      combined.includes("enotfound") ||
      combined.includes("eai_again") ||
      combined.includes("socket") ||
      combined.includes("connection") ||
      combined.includes("temporarily unavailable")
    ) {
      return "STORAGE_UNAVAILABLE";
    }

    return "STORAGE_ERROR";
  }

  private normalizeStorageError(
    operation: string,
    key: string,
    error: unknown,
  ): StorageOperationError {
    if (error instanceof StorageOperationError) return error;

    const code = this.getStorageErrorCode(error);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const retryable =
      code === "STORAGE_TIMEOUT" ||
      code === "STORAGE_UNAVAILABLE" ||
      this.isRetryableStorageError(error);
    const readable =
      code === "STORAGE_TIMEOUT"
        ? "Storage timed out while fetching the file. Please try again shortly."
        : code === "STORAGE_UNAVAILABLE"
          ? "Storage is temporarily unavailable while fetching the file. Please try again shortly."
          : code === "STORAGE_NOT_FOUND"
            ? "The file was not found in storage."
            : rawMessage || "Storage operation failed.";

    return new StorageOperationError({
      code,
      operation,
      key,
      message: readable,
      retryable,
      cause: error,
    });
  }

  private recordStorageFailure(error: StorageOperationError) {
    const now = Date.now();
    this.recentFailures.push({
      at: new Date(now),
      code: error.code,
      operation: error.operation,
      key: error.key,
      message: error.message,
    });

    const cutoff = now - this.RECENT_FAILURE_WINDOW_MS;
    while (
      this.recentFailures.length > this.MAX_RECENT_FAILURES ||
      (this.recentFailures[0] && this.recentFailures[0].at.getTime() < cutoff)
    ) {
      this.recentFailures.shift();
    }

    if (
      error.code === "STORAGE_TIMEOUT" ||
      error.code === "STORAGE_UNAVAILABLE"
    ) {
      this.consecutiveDownloadFailures++;
      if (
        this.consecutiveDownloadFailures >=
        this.DOWNLOAD_CLIENT_REFRESH_FAILURES
      ) {
        this.logger.warn(
          `Refreshing storage clients after ${this.consecutiveDownloadFailures} consecutive download failures`,
        );
        this.initializeClients();
      }
    }
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withDownloadRetry<T>(
    label: string,
    task: () => Promise<T>,
    options?: { attempts?: number; baseDelayMs?: number },
  ): Promise<T> {
    let lastError: unknown;
    const attempts = Math.max(
      1,
      options?.attempts ?? this.DOWNLOAD_RETRY_ATTEMPTS,
    );
    const baseDelayMs = Math.max(
      0,
      options?.baseDelayMs ?? this.DOWNLOAD_RETRY_BASE_DELAY_MS,
    );

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await task();
        this.consecutiveDownloadFailures = 0;
        return result;
      } catch (error) {
        const storageError = this.normalizeStorageError(
          label,
          this.extractKeyFromLabel(label),
          error,
        );
        lastError = storageError;
        if (attempt >= attempts || !storageError.retryable) {
          this.recordStorageFailure(storageError);
          throw storageError;
        }

        const jitter = Math.floor(Math.random() * Math.max(100, baseDelayMs));
        const delay = baseDelayMs * attempt + jitter;
        this.logger.warn(
          `${label} failed on attempt ${attempt}/${attempts}; code=${storageError.code}; retrying in ${delay}ms: ${storageError.message}`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private extractKeyFromLabel(label: string) {
    const parts = label.split(" ");
    return parts[parts.length - 1] || label;
  }

  private deriveRegion(endpoint: string): string {
    if (endpoint.includes("backblazeb2.com")) {
      const match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2/);
      if (match) {
        return match[1];
      }
      return "us-east-005";
    }

    if (endpoint.includes("r2.cloudflarestorage.com")) {
      return "auto";
    }

    // Amazon S3 signs per-region, so guessing wrong fails the request outright
    // (AuthorizationHeaderMalformed / PermanentRedirect) rather than degrading.
    // Pull the region out of the regional endpoint when it is there. Covers the
    // dotted, dashed and dualstack forms; the legacy global "s3.amazonaws.com"
    // has no region in it and correctly falls through to us-east-1.
    if (endpoint.includes("amazonaws.com")) {
      const match = endpoint.match(
        /s3[.-](?:dualstack\.)?([a-z]{2}(?:-[a-z]+)+-\d)\.amazonaws\.com/,
      );
      if (match) {
        return match[1];
      }
    }

    return "us-east-1";
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getMultipartThreshold(): number {
    let configured: number;
    try {
      configured = Number(this.configService.get("share.multipartThreshold"));
    } catch {
      configured = NaN;
    }
    if (Number.isFinite(configured) && configured >= MIN_MULTIPART_PART_SIZE) {
      return configured;
    }

    return DEFAULT_MULTIPART_THRESHOLD;
  }

  getPartSize(): number {
    let configured: number;
    try {
      configured = Number(this.configService.get("share.chunkSize"));
    } catch {
      configured = NaN;
    }
    if (Number.isFinite(configured) && configured >= MIN_MULTIPART_PART_SIZE) {
      return configured;
    }

    return DEFAULT_MULTIPART_PART_SIZE;
  }

  shouldUseMultipart(fileSize: number): boolean {
    return fileSize > this.getMultipartThreshold();
  }

  canUseMultipart(fileSize: number): boolean {
    return fileSize >= MIN_MULTIPART_PART_SIZE;
  }

  private async processUploadQueue(): Promise<void> {
    while (
      this.uploadQueue.length > 0 &&
      this.activeUploads < this.MAX_CONCURRENT_UPLOADS
    ) {
      const task = this.uploadQueue.shift();
      if (task) {
        this.activeUploads++;
        task().finally(() => {
          this.activeUploads--;
          setTimeout(() => this.processUploadQueue(), this.UPLOAD_DELAY_MS);
        });
      }
    }
  }

  private async processDownloadQueue(): Promise<void> {
    while (
      this.downloadQueue.length > 0 &&
      this.activeDownloads < this.MAX_CONCURRENT_DOWNLOADS
    ) {
      const task = this.downloadQueue.shift();
      if (task) {
        this.activeDownloads++;
        task().finally(() => {
          this.activeDownloads--;
          setTimeout(() => this.processDownloadQueue(), this.DOWNLOAD_DELAY_MS);
        });
      }
    }
  }

  async upload(
    key: string,
    data: Buffer | Readable,
    contentType?: string,
  ): Promise<void> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: data,
            ContentType: contentType || "application/octet-stream",
          });

          await this.client.send(command);
          this.logger.log(`Uploaded file: ${key}`);
          resolve();
        } catch (error) {
          this.logger.error(`Failed to upload: ${key}`, error);
          reject(error);
        }
      };

      this.uploadQueue.push(task);
      this.processUploadQueue();
    });
  }

  async uploadLargeFile(
    key: string,
    filePath: string,
    contentType?: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    const fileStream = fs.createReadStream(filePath);
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);

    this.logger.log(
      `[uploadLargeFile] Starting multipart upload: ${key} (${fileSizeMB} MB)`,
    );

    try {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: fileStream,
          ContentType: contentType || "application/octet-stream",
        },
        partSize: this.getPartSize(),
        queueSize: 3,
        leavePartsOnError: false,
      });

      let lastPercent = 0;
      upload.on("httpUploadProgress", (progress) => {
        if (progress.loaded && progress.total) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          if (percent !== lastPercent) {
            lastPercent = percent;
            this.logger.log(`[uploadLargeFile] Progress: ${percent}% (${key})`);
            onProgress?.(percent);
          }
        }
      });

      await upload.done();
      this.logger.log(
        `[uploadLargeFile] Completed: ${key} (${fileSizeMB} MB)`,
      );
    } catch (error) {
      this.logger.error(`[uploadLargeFile] Failed: ${key}`, error);
      throw error;
    }
  }

  async createMultipartUpload(
    key: string,
    contentType: string,
    fileSize: number,
  ): Promise<MultipartUploadInit> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const response = await this.client.send(command);
      const uploadId = response.UploadId;

      if (!uploadId) {
        throw new Error("Failed to get uploadId from multipart init");
      }

      const partSize = this.getPartSize();
      const totalParts = Math.ceil(fileSize / partSize);

      this.logger.log(
        `Multipart upload initiated: ${key}, uploadId: ${uploadId}, parts: ${totalParts}`,
      );

      return {
        uploadId,
        key,
        partSize,
        totalParts,
      };
    } catch (error) {
      this.logger.error(`Failed to create multipart upload: ${key}`, error);
      throw error;
    }
  }

  async getPartSignedUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 3600,
  ): Promise<string> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    try {
      const command = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(this.presignClient, command, {
        expiresIn,
      });

      this.logger.debug(`Generated part URL: ${key}, part ${partNumber}`);
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to get part signed URL: ${key}, part ${partNumber}`,
        error,
      );
      throw error;
    }
  }

  async getMultiplePartSignedUrls(
    key: string,
    uploadId: string,
    partNumbers: number[],
    expiresIn = 3600,
  ): Promise<PartUploadUrl[]> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    const urls: PartUploadUrl[] = [];

    for (const partNumber of partNumbers) {
      const url = await this.getPartSignedUrl(
        key,
        uploadId,
        partNumber,
        expiresIn,
      );
      urls.push({ partNumber, url });
    }

    this.logger.log(`Generated ${urls.length} part URLs for: ${key}`);
    return urls;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ): Promise<void> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    try {
      const sortedParts = [...parts].sort(
        (a, b) => (a.PartNumber || 0) - (b.PartNumber || 0),
      );

      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts,
        },
      });

      await this.client.send(command);
      this.logger.log(
        `Multipart upload completed: ${key}, ${parts.length} parts`,
      );
    } catch (error) {
      this.logger.error(`Failed to complete multipart upload: ${key}`, error);
      throw error;
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      });

      await this.client.send(command);
      this.logger.log(`Multipart upload aborted: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to abort multipart upload: ${key}`, error);
    }
  }

  async download(key: string): Promise<Buffer> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    try {
      return await this.withDownloadRetry(
        `Download ${key}`,
        async () => {
          const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
          });

          const response = await this.interactiveDownloadClient.send(command);
          const stream = response.Body as Readable;

          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
          }

          return Buffer.concat(chunks);
        },
        {
          attempts: this.INTERACTIVE_DOWNLOAD_RETRY_ATTEMPTS,
          baseDelayMs: this.INTERACTIVE_DOWNLOAD_RETRY_BASE_DELAY_MS,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to download: ${key}`, error);
      throw error;
    }
  }

  async downloadQueued(key: string): Promise<Buffer> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          const buffer = await this.withDownloadRetry(
            `Queued download ${key}`,
            async () => {
              const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
              });

              const response = await this.downloadClient.send(command);
              const stream = response.Body as Readable;

              const chunks: Buffer[] = [];
              for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
              }

              return Buffer.concat(chunks);
            },
          );
          resolve(buffer);
        } catch (error) {
          this.logger.error(`Failed to download (queued): ${key}`, error);
          reject(error);
        }
      };

      this.downloadQueue.push(task);
      this.processDownloadQueue();
    });
  }

  async downloadToFile(key: string, filePath: string): Promise<void> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    try {
      await this.withDownloadRetry(
        `Download to file ${key}`,
        async () => {
          await fs.promises
            .rm(filePath, { force: true })
            .catch(() => undefined);
          const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
          });

          const response = await this.interactiveDownloadClient.send(command);
          const stream = response.Body as Readable;
          await pipeline(stream, fs.createWriteStream(filePath));
        },
        {
          attempts: this.INTERACTIVE_DOWNLOAD_RETRY_ATTEMPTS,
          baseDelayMs: this.INTERACTIVE_DOWNLOAD_RETRY_BASE_DELAY_MS,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to download to file: ${key}`, error);
      throw error;
    }
  }

  async downloadQueuedToFile(key: string, filePath: string): Promise<void> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          await this.withDownloadRetry(
            `Queued download to file ${key}`,
            async () => {
              await fs.promises
                .rm(filePath, { force: true })
                .catch(() => undefined);
              const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
              });

              const response = await this.downloadClient.send(command);
              const stream = response.Body as Readable;
              await pipeline(stream, fs.createWriteStream(filePath));
            },
          );
          resolve();
        } catch (error) {
          this.logger.error(
            `Failed to download to file (queued): ${key}`,
            error,
          );
          reject(error);
        }
      };

      this.downloadQueue.push(task);
      this.processDownloadQueue();
    });
  }

  async getCachedSourceFile(key: string): Promise<string> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    await this.cleanupSourceCacheIfNeeded();
    await fs.promises.mkdir(this.SOURCE_CACHE_DIR, { recursive: true });

    const cachedPath = this.getSourceCachePath(key);
    const existing = await this.getUsableSourceCacheEntry(cachedPath);
    if (existing) {
      await fs.promises
        .utimes(cachedPath, new Date(), new Date())
        .catch(() => undefined);
      return cachedPath;
    }

    const runningDownload = this.sourceDownloadLocks.get(key);
    if (runningDownload) return runningDownload;

    const download = this.downloadSourceToCache(key, cachedPath).finally(() => {
      this.sourceDownloadLocks.delete(key);
    });
    this.sourceDownloadLocks.set(key, download);
    return download;
  }

  private getSourceCachePath(key: string) {
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    const ext = path
      .extname(key)
      .replace(/[^a-zA-Z0-9.]/g, "")
      .slice(0, 16);
    return path.join(this.SOURCE_CACHE_DIR, `${hash}${ext || ".bin"}`);
  }

  private async getUsableSourceCacheEntry(
    filePath: string,
  ): Promise<SourceCacheEntry | null> {
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile() || stat.size <= 0) return null;
      if (Date.now() - stat.mtimeMs > this.SOURCE_CACHE_MAX_AGE_MS) return null;
      return { path: filePath, size: stat.size, mtimeMs: stat.mtimeMs };
    } catch {
      return null;
    }
  }

  private async downloadSourceToCache(key: string, cachedPath: string) {
    const tmpPath = `${cachedPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.rm(tmpPath, { force: true }).catch(() => undefined);

    try {
      await this.downloadQueuedToFile(key, tmpPath);
      const stat = await fs.promises.stat(tmpPath);
      if (!stat.isFile() || stat.size <= 0) {
        throw new Error("Downloaded source file was empty");
      }
      await fs.promises.rename(tmpPath, cachedPath);
      await fs.promises
        .utimes(cachedPath, new Date(), new Date())
        .catch(() => undefined);
      this.logger.log(
        `Cached source file for ${key}; bytes=${stat.size}; activeSourceDownloads=${this.sourceDownloadLocks.size}`,
      );
      void this.cleanupSourceCacheIfNeeded(true);
      return cachedPath;
    } catch (error) {
      await fs.promises.rm(tmpPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async cleanupSourceCacheIfNeeded(force = false) {
    const now = Date.now();
    if (
      !force &&
      now - this.lastSourceCacheCleanupAt <
        this.SOURCE_CACHE_CLEANUP_INTERVAL_MS
    ) {
      return;
    }
    if (this.sourceCacheCleanupRunning) return;

    this.sourceCacheCleanupRunning = true;
    this.lastSourceCacheCleanupAt = now;

    try {
      await fs.promises.mkdir(this.SOURCE_CACHE_DIR, { recursive: true });
      const entries = await fs.promises.readdir(this.SOURCE_CACHE_DIR);
      const files: SourceCacheEntry[] = [];

      for (const entry of entries) {
        const filePath = path.join(this.SOURCE_CACHE_DIR, entry);
        try {
          const stat = await fs.promises.stat(filePath);
          if (!stat.isFile()) continue;
          files.push({
            path: filePath,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
          });
        } catch {
        }
      }

      const maxAgeCutoff = now - this.SOURCE_CACHE_MAX_AGE_MS;
      for (const file of files.filter(
        (entry) => entry.mtimeMs < maxAgeCutoff,
      )) {
        await fs.promises.rm(file.path, { force: true }).catch(() => undefined);
      }

      const remaining = files
        .filter((entry) => entry.mtimeMs >= maxAgeCutoff)
        .sort((a, b) => a.mtimeMs - b.mtimeMs);
      let totalBytes = remaining.reduce((sum, entry) => sum + entry.size, 0);

      while (totalBytes > this.SOURCE_CACHE_MAX_BYTES && remaining.length > 0) {
        const oldest = remaining.shift();
        if (!oldest) break;
        await fs.promises
          .rm(oldest.path, { force: true })
          .catch(() => undefined);
        totalBytes -= oldest.size;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Source cache cleanup failed: ${message}`);
    } finally {
      this.sourceCacheCleanupRunning = false;
    }
  }

  async getSourceCacheStats(): Promise<SourceCacheStats> {
    let totalBytes = 0;
    let fileCount = 0;
    let oldestMtimeMs: number | null = null;
    let newestMtimeMs: number | null = null;

    try {
      await fs.promises.mkdir(this.SOURCE_CACHE_DIR, { recursive: true });
      const entries = await fs.promises.readdir(this.SOURCE_CACHE_DIR);

      for (const entry of entries) {
        const filePath = path.join(this.SOURCE_CACHE_DIR, entry);
        try {
          const stat = await fs.promises.stat(filePath);
          if (!stat.isFile()) continue;
          totalBytes += stat.size;
          fileCount += 1;
          oldestMtimeMs =
            oldestMtimeMs === null
              ? stat.mtimeMs
              : Math.min(oldestMtimeMs, stat.mtimeMs);
          newestMtimeMs =
            newestMtimeMs === null
              ? stat.mtimeMs
              : Math.max(newestMtimeMs, stat.mtimeMs);
        } catch {
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Source cache stats failed: ${message}`);
    }

    return {
      path: this.SOURCE_CACHE_DIR,
      maxBytes: this.SOURCE_CACHE_MAX_BYTES,
      maxAgeMs: this.SOURCE_CACHE_MAX_AGE_MS,
      cleanupIntervalMs: this.SOURCE_CACHE_CLEANUP_INTERVAL_MS,
      totalBytes,
      fileCount,
      activeDownloads: this.sourceDownloadLocks.size,
      oldestMtime: oldestMtimeMs === null ? null : new Date(oldestMtimeMs),
      newestMtime: newestMtimeMs === null ? null : new Date(newestMtimeMs),
    };
  }

  async clearSourceCache() {
    await fs.promises.mkdir(this.SOURCE_CACHE_DIR, { recursive: true });
    const entries = await fs.promises.readdir(this.SOURCE_CACHE_DIR);
    let deletedFiles = 0;
    let deletedBytes = 0;

    for (const entry of entries) {
      const filePath = path.join(this.SOURCE_CACHE_DIR, entry);
      try {
        const stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) continue;
        await fs.promises.rm(filePath, { force: true });
        deletedFiles += 1;
        deletedBytes += stat.size;
      } catch {
      }
    }

    return { deletedFiles, deletedBytes };
  }

  getQueueStatus() {
    return {
      uploads: {
        active: this.activeUploads,
        queued: this.uploadQueue.length,
        maxConcurrent: this.MAX_CONCURRENT_UPLOADS,
      },
      downloads: {
        active: this.activeDownloads,
        queued: this.downloadQueue.length,
        maxConcurrent: this.MAX_CONCURRENT_DOWNLOADS,
      },
    };
  }

  getStorageHealth() {
    const now = Date.now();
    const cutoff = now - this.RECENT_FAILURE_WINDOW_MS;
    const recent = this.recentFailures.filter(
      (failure) => failure.at.getTime() >= cutoff,
    );
    const byCode = recent.reduce<Record<string, number>>((acc, failure) => {
      acc[failure.code] = (acc[failure.code] || 0) + 1;
      return acc;
    }, {});

    return {
      enabled: this.enabled,
      activeDownloads: this.activeDownloads,
      queuedDownloads: this.downloadQueue.length,
      sourceCacheDir: this.SOURCE_CACHE_DIR,
      sourceCacheMaxBytes: this.SOURCE_CACHE_MAX_BYTES,
      sourceCacheMaxAgeMs: this.SOURCE_CACHE_MAX_AGE_MS,
      activeSourceDownloads: this.sourceDownloadLocks.size,
      maxConcurrentDownloads: this.MAX_CONCURRENT_DOWNLOADS,
      downloadRequestTimeoutMs: this.DOWNLOAD_REQUEST_TIMEOUT_MS,
      downloadConnectionTimeoutMs: this.DOWNLOAD_CONNECTION_TIMEOUT_MS,
      interactiveRequestTimeoutMs: this.INTERACTIVE_REQUEST_TIMEOUT_MS,
      interactiveConnectionTimeoutMs: this.INTERACTIVE_CONNECTION_TIMEOUT_MS,
      consecutiveDownloadFailures: this.consecutiveDownloadFailures,
      recentFailureWindowMs: this.RECENT_FAILURE_WINDOW_MS,
      recentFailures: recent.length,
      recentFailuresByCode: byCode,
      latestFailures: recent.slice(-10),
    };
  }

  async getStream(
    key: string,
    options?: { abortSignal?: AbortSignal; attempts?: number },
  ): Promise<Readable> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    try {
      return await this.withDownloadRetry(
        `Get stream ${key}`,
        async () => {
          const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
          });

          const response = await this.interactiveDownloadClient.send(command, {
            abortSignal: options?.abortSignal,
          });
          return response.Body as Readable;
        },
        {
          attempts: options?.attempts ?? this.INTERACTIVE_DOWNLOAD_RETRY_ATTEMPTS,
          baseDelayMs: this.INTERACTIVE_DOWNLOAD_RETRY_BASE_DELAY_MS,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to get stream: ${key}`, error);
      throw error;
    }
  }

  async getStreamQueued(key: string): Promise<Readable> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          const stream = await this.withDownloadRetry(
            `Queued get stream ${key}`,
            async () => {
              const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
              });

              const response = await this.downloadClient.send(command);
              return response.Body as Readable;
            },
          );
          resolve(stream);
        } catch (error) {
          this.logger.error(`Failed to get stream (queued): ${key}`, error);
          reject(error);
        }
      };

      this.downloadQueue.push(task);
      this.processDownloadQueue();
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      this.logger.log(`Deleted file: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete: ${key}`, error);
      throw error;
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    let continuationToken: string | undefined;

    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const objects = (listed.Contents || [])
        .map((object) => object.Key)
        .filter((key): key is string => Boolean(key));

      if (objects.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: objects.map((Key) => ({ Key })),
              Quiet: true,
            },
          }),
        );
        this.logger.log(
          `Deleted ${objects.length} objects with prefix: ${prefix}`,
        );
      }

      continuationToken = listed.NextContinuationToken;
    } while (continuationToken);
  }

  /**
   * Bucket usage split by what the object actually is. The stats page only ever
   * summed File.size from the database, which is the source files alone - on one
   * real install that read 44.87 GB while the bucket held 90.10 GB, the whole
   * difference being zips and preview renditions.
   *
   * A full listing of tens of thousands of objects is far too slow to do on
   * every page load, so the result is cached.
   */
  private breakdownCache: {
    at: number;
    data: StorageBreakdown;
  } | null = null;

  async getStorageBreakdown(maxAgeMs = 10 * 60 * 1000): Promise<StorageBreakdown> {
    const empty: StorageBreakdown = {
      enabled: false,
      generatedAt: new Date().toISOString(),
      cached: false,
      totalBytes: 0,
      totalObjects: 0,
      sourceFiles: { bytes: 0, objects: 0 },
      zips: { bytes: 0, objects: 0 },
      previews: { bytes: 0, objects: 0 },
      other: { bytes: 0, objects: 0 },
    };

    if (!this.enabled) return empty;

    if (this.breakdownCache && Date.now() - this.breakdownCache.at < maxAgeMs) {
      return { ...this.breakdownCache.data, cached: true };
    }

    const objects = await this.listKeys("", 200000);

    const bucketFor = (key: string): keyof Omit<
      StorageBreakdown,
      "enabled" | "generatedAt" | "cached" | "totalBytes" | "totalObjects"
    > => {
      if (key.includes("/previews/")) return "previews";
      if (key.endsWith("/archive.zip")) return "zips";
      if (/^shares\/[^/]+\/[^/]+$/.test(key)) return "sourceFiles";
      return "other";
    };

    const data: StorageBreakdown = { ...empty, enabled: true };
    for (const o of objects) {
      const size = Number(o.size || 0);
      const b = bucketFor(o.key);
      data[b].bytes += size;
      data[b].objects += 1;
      data.totalBytes += size;
      data.totalObjects += 1;
    }
    data.generatedAt = new Date().toISOString();

    this.breakdownCache = { at: Date.now(), data };
    return data;
  }

  async listKeys(
    prefix: string,
    maxKeys = 20000,
  ): Promise<StorageObjectSummary[]> {
    if (!this.enabled) {
      return [];
    }

    const objects: StorageObjectSummary[] = [];
    let continuationToken: string | undefined;

    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of listed.Contents || []) {
        if (!object.Key) continue;

        objects.push({
          key: object.Key,
          size: object.Size,
          lastModified: object.LastModified,
        });

        if (objects.length >= maxKeys) {
          return objects;
        }
      }

      continuationToken = listed.NextContinuationToken;
    } while (continuationToken);

    return objects;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  async getSignedUrl(
    key: string,
    filename?: string,
    expiresIn = 3600,
    forceSigned = false,
  ): Promise<string> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    if (this.publicUrl && !forceSigned && filename) {
      if (filename) {
        const encodedFilename = encodeURIComponent(filename);
        return `${this.publicUrl}/${key}?download=${encodedFilename}`;
      }
    }

    if (filename) {
      const commandOptions: any = {
        Bucket: this.bucket,
        Key: key,
      };

      const asciiFilename = filename.replace(/[^\x00-\x7F]/g, "_");
      const encodedFilename = encodeURIComponent(filename)
        .replace(/['()]/g, escape)
        .replace(/\*/g, "%2A");
      commandOptions.ResponseContentDisposition = `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;

      const command = new GetObjectCommand(commandOptions);
      return getSignedUrl(this.presignClient, command, { expiresIn });
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.presignClient, command, { expiresIn });
  }

  getPublicUrl(key: string): string | null {
    if (!this.publicUrl) {
      return null;
    }
    return `${this.publicUrl}/${key}`;
  }

  getPublicUrlWithFilename(key: string, filename?: string): string | null {
    if (!this.publicUrl) {
      return null;
    }
    return `${this.publicUrl}/${key}`;
  }

  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<string> {
    if (!this.enabled) {
      throw new Error("Cloud storage is not enabled");
    }

    try {
      this.logger.debug(
        `[getSignedUploadUrl] Generating upload URL for contentType: ${contentType}`,
      );

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.presignClient, command, {
        expiresIn,
      });

      this.logger.debug("[getSignedUploadUrl] Upload URL generated");
      return url;
    } catch (error) {
      this.logger.error(
        `[getSignedUploadUrl] Error generating signed URL: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  getFileKey(shareId: string, fileId: string): string {
    return `shares/${shareId}/${fileId}`;
  }

  getZipKey(shareId: string): string {
    return `shares/${shareId}/archive.zip`;
  }

  getVideoPreviewPrefix(shareId: string, fileId: string): string {
    return `shares/${shareId}/previews/${fileId}/`;
  }

  getVideoPreviewKey(
    shareId: string,
    fileId: string,
    objectPath: string,
  ): string {
    return `${this.getVideoPreviewPrefix(shareId, fileId)}${objectPath}`;
  }

}
