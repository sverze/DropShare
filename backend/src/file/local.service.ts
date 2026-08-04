import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import * as crypto from "crypto";
import { createReadStream, createWriteStream } from "fs";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as mime from "mime-types";
import * as mm from "music-metadata";
import * as archiver from "archiver";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import {
  R2StorageService,
  StorageOperationError,
} from "src/r2-storage/r2-storage.service";
import { validate as isValidUUID } from "uuid";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { SHARE_DIRECTORY } from "../constants";
import { Cron, CronExpression } from "@nestjs/schedule";
import { skipScheduledJob } from "../utils/scheduled-jobs.util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const ARCHIVE_CACHE_DIRECTORY = path.resolve(
  __dirname,
  "../../../data/archive-cache",
);
const VIDEO_THUMBNAIL_CACHE_DIRECTORY = path.resolve(
  __dirname,
  "../../../data/video-thumbnail-cache",
);
const VIDEO_PREVIEW_CACHE_DIRECTORY = path.resolve(
  __dirname,
  "../../../data/video-preview-cache",
);
const VIDEO_PREVIEW_OBJECT_CACHE_DIRECTORY = path.resolve(
  __dirname,
  "../../../data/video-preview-object-cache",
);

const VIDEO_PREVIEW_STATUSES = {
  NOT_STARTED: "not_started",
  QUEUED: "queued",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
} as const;

const FILE_METADATA_STATUSES = {
  NOT_STARTED: "not_started",
  QUEUED: "queued",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
} as const;

const PREVIEW_STORAGE_TIMEOUT_MS = Number(
  process.env.PREVIEW_STORAGE_TIMEOUT_MS || 30000,
);
const PREVIEW_PROBE_TIMEOUT_MS = 8000;
const STORAGE_RECONCILIATION_DEFAULT_LIMIT = 200;

type VideoPreviewQuality = {
  label: string;
  height: number;
  bandwidth: number;
  maxrate: string;
  bufsize: string;
};

@Injectable()
export class LocalFileService {
  private readonly logger = new Logger(LocalFileService.name);
  private readonly videoPreviewQueue = new Set<string>();
  private readonly metadataQueue = new Set<string>();
  private readonly videoPreviewObjectLocks = new Map<string, Promise<void>>();
  private videoPreviewWorkerRunning = false;
  private metadataWorkerRunning = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private r2Storage: R2StorageService,
  ) {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(SHARE_DIRECTORY, { recursive: true });
      await fs.mkdir(ARCHIVE_CACHE_DIRECTORY, { recursive: true });
      await fs.mkdir(VIDEO_THUMBNAIL_CACHE_DIRECTORY, { recursive: true });
      await fs.mkdir(VIDEO_PREVIEW_CACHE_DIRECTORY, { recursive: true });
      await fs.mkdir(VIDEO_PREVIEW_OBJECT_CACHE_DIRECTORY, {
        recursive: true,
      });
    } catch (error) {
      this.logger.error("Failed to create storage directories", error);
    }
  }

  private isSupportedArchive(name: string) {
    const lower = name.toLowerCase();
    return [".zip", ".7z", ".rar", ".tar", ".gz", ".tar.gz", ".tgz"].some(
      (ext) => lower.endsWith(ext),
    );
  }

  private getArchiveCacheDir(fileId: string) {
    return path.join(ARCHIVE_CACHE_DIRECTORY, fileId);
  }

  private getArchiveManifestPath(fileId: string) {
    return path.join(this.getArchiveCacheDir(fileId), "manifest.json");
  }

  private getArchiveCachedFilePath(fileId: string, fileName: string) {
    const ext = path.extname(fileName) || ".bin";
    return path.join(this.getArchiveCacheDir(fileId), `source${ext}`);
  }

  private shellEscape(value: string) {
    return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private async withPreviewTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async pathExists(filePath: string) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private isVideoFileName(name: string) {
    const mimeType = String(mime.lookup(name) || "").toLowerCase();
    const fileExtension = path.extname(name || "").toLowerCase();
    const supportedVideoExtensions = new Set([
      ".mp4",
      ".m4v",
      ".mov",
      ".qt",
      ".webm",
      ".mkv",
      ".avi",
      ".ogv",
      ".3gp",
      ".3g2",
      ".mts",
      ".m2ts",
    ]);

    return (
      mimeType.startsWith("video/") ||
      mimeType === "application/mp4" ||
      supportedVideoExtensions.has(fileExtension)
    );
  }

  private isAudioFileName(name: string) {
    const mimeType = String(mime.lookup(name) || "").toLowerCase();
    const fileExtension = path.extname(name || "").toLowerCase();
    const supportedAudioExtensions = new Set([
      ".mp3",
      ".m4a",
      ".aac",
      ".wav",
      ".flac",
      ".ogg",
      ".oga",
      ".opus",
      ".aiff",
      ".aif",
      ".alac",
      ".wma",
    ]);

    return (
      mimeType.startsWith("audio/") ||
      supportedAudioExtensions.has(fileExtension)
    );
  }

  private getVideoPreviewWorkDir(fileId: string) {
    return path.join(VIDEO_PREVIEW_CACHE_DIRECTORY, fileId);
  }

  private getVideoPreviewInputPath(fileId: string, fileName: string) {
    const ext = path.extname(fileName) || ".video";
    return path.join(this.getVideoPreviewWorkDir(fileId), `source${ext}`);
  }

  private getVideoPreviewObjectCacheDir(shareId: string, fileId: string) {
    return path.join(VIDEO_PREVIEW_OBJECT_CACHE_DIRECTORY, shareId, fileId);
  }

  private getVideoPreviewObjectCachePath(
    shareId: string,
    fileId: string,
    objectPath: string,
  ) {
    return path.join(
      this.getVideoPreviewObjectCacheDir(shareId, fileId),
      ...objectPath.split("/"),
    );
  }

  private getVideoThumbnailCachedPath(fileId: string) {
    return path.join(VIDEO_THUMBNAIL_CACHE_DIRECTORY, `${fileId}.jpg`);
  }

  private getRenditionCachedPath(fileId: string, size: "thumb" | "preview") {
    return size === "thumb"
      ? this.getVideoThumbnailCachedPath(fileId)
      : path.join(VIDEO_THUMBNAIL_CACHE_DIRECTORY, `${fileId}_${size}.jpg`);
  }

  private parseVideoPreviewQualities(value: string | null | undefined) {
    if (!value) return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item) => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }

  private getVideoPreviewContentType(objectPath: string) {
    if (objectPath.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
    if (objectPath.endsWith(".ts")) return "video/mp2t";
    if (objectPath.endsWith(".m4s")) return "video/iso.segment";
    if (objectPath.endsWith(".mp4")) return "video/mp4";
    return mime.lookup(objectPath) || "application/octet-stream";
  }

  private getVideoPreviewQualities(
    sourceHeight: number,
  ): VideoPreviewQuality[] {
    const candidates: VideoPreviewQuality[] = [
      {
        label: "360p",
        height: 360,
        bandwidth: 800000,
        maxrate: "800k",
        bufsize: "1200k",
      },
      {
        label: "480p",
        height: 480,
        bandwidth: 1400000,
        maxrate: "1400k",
        bufsize: "2100k",
      },
      {
        label: "720p",
        height: 720,
        bandwidth: 2800000,
        maxrate: "2800k",
        bufsize: "4200k",
      },
      {
        label: "1080p",
        height: 1080,
        bandwidth: 5000000,
        maxrate: "5000k",
        bufsize: "7500k",
      },
    ];

    const selected = candidates.filter(
      (quality) => sourceHeight >= quality.height - 24,
    );
    if (selected.length > 0) return selected;

    const fallbackHeight = Math.max(144, Math.floor(sourceHeight || 360));
    return [
      {
        label: `${fallbackHeight}p`,
        height: fallbackHeight,
        bandwidth: 700000,
        maxrate: "700k",
        bufsize: "1050k",
      },
    ];
  }

  private parseArchiveListing(stdout: string) {
    const lines = stdout.split("\n");
    const contents: Array<{
      name: string;
      size: number;
      isDirectory: boolean;
    }> = [];
    let inEntries = false;
    let current: Record<string, string> = {};

    const pushCurrent = () => {
      const entryPath = current.Path?.trim();
      if (!entryPath) return;
      const attributes = current.Attributes || "";
      const isDirectory = attributes.includes("D") || entryPath.endsWith("/");
      contents.push({
        name: entryPath,
        size: parseInt(current.Size || "0", 10) || 0,
        isDirectory,
      });
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!inEntries) {
        if (line.startsWith("----------")) {
          inEntries = true;
        }
        continue;
      }

      if (!line.trim()) {
        pushCurrent();
        current = {};
        continue;
      }

      const match = line.match(/^([^=]+?) = ?(.*)$/);
      if (match) {
        current[match[1].trim()] = match[2];
      }
    }

    pushCurrent();

    return contents.filter((entry) => entry.name && entry.name !== ".");
  }

  private async ensureArchiveSourcePath(
    shareId: string,
    fileId: string,
    fileName: string,
    storageLocation: string,
  ) {
    if (storageLocation === "s3" && this.r2Storage.isEnabled()) {
      const cacheDir = this.getArchiveCacheDir(fileId);
      const cachedFilePath = this.getArchiveCachedFilePath(fileId, fileName);
      await fs.mkdir(cacheDir, { recursive: true });

      if (!fsSync.existsSync(cachedFilePath)) {
        const r2Key = this.r2Storage.getFileKey(shareId, fileId);
        await this.r2Storage.downloadQueuedToFile(r2Key, cachedFilePath);
      }

      return cachedFilePath;
    }

    return `${SHARE_DIRECTORY}/${shareId}/${fileId}`;
  }

  private async getFileStorageLocation(fileId: string): Promise<string> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { storageLocation: true },
    });
    return file?.storageLocation || "s3";
  }

  private async updateLastAccessed(fileId: string): Promise<void> {
    await this.prisma.file.update({
      where: { id: fileId },
      data: { lastAccessedAt: new Date() },
    });
  }

  private async getConfiguredShareLimit(shareId: string): Promise<number> {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: {
        creatorId: true,
        groupId: true,
        creator: {
          select: {
            canCreateShares: true,
            isAdmin: true,
            maxFileSizeOverride: true,
            groupMemberships: {
              select: {
                groupId: true,
              },
            },
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    if (!share.creatorId) {
      return this.config.get("share.maxAnonymousSize");
    }

    if (
      share.creator &&
      !share.creator.isAdmin &&
      share.creator.canCreateShares === false
    ) {
      return this.config.get("share.maxUninvitedRegisteredSize");
    }

    let effectiveLimit = this.config.get("share.maxSize");

    const groupIds = share.groupId
      ? [share.groupId]
      : share.creator?.groupMemberships?.map(
          (membership) => membership.groupId,
        ) || [];

    if (groupIds.length > 0) {
      const groups = await this.prisma.userGroup.findMany({
        where: { id: { in: groupIds } },
        select: {
          shareSizeLimit: true,
        },
      });

      groups.forEach((group) => {
        if (group.shareSizeLimit) {
          effectiveLimit = Math.max(
            effectiveLimit,
            Number(group.shareSizeLimit),
          );
        }
      });
    }

    if (share.creator?.maxFileSizeOverride) {
      effectiveLimit = Math.max(
        effectiveLimit,
        Number(share.creator.maxFileSizeOverride),
      );
    }

    return effectiveLimit;
  }

  private shouldUsePublicUrlDelivery(
    share?: {
      security?: { password?: string | null; maxViews?: number | null } | null;
    } | null,
  ) {
    if (share?.security?.password || share?.security?.maxViews) {
      return false;
    }

    try {
      return this.config.get("s3.allowPublicUrlAccess");
    } catch {
      return false;
    }
  }

  private parsePositiveInt(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private resolveAudioBitrate(audioStream: any, format: any): number | null {
    const streamBitrate = this.parsePositiveInt(audioStream?.bit_rate);
    if (streamBitrate) return streamBitrate;

    const formatBitrate = this.parsePositiveInt(format?.bit_rate);
    if (formatBitrate) return formatBitrate;

    return null;
  }

  private async validateShareSizeLimit(
    shareId: string,
    incomingFileSize: number,
    reverseShareMaxSize?: string | null,
  ) {
    const existingFiles = await this.prisma.file.findMany({
      where: { shareId },
      select: { size: true },
    });

    const existingSize = existingFiles.reduce(
      (sum, currentFile) => sum + parseInt(currentFile.size || "0"),
      0,
    );
    const nextShareSize = existingSize + incomingFileSize;
    const configuredShareLimit = await this.getConfiguredShareLimit(shareId);

    if (
      nextShareSize > configuredShareLimit ||
      (reverseShareMaxSize && nextShareSize > parseInt(reverseShareMaxSize))
    ) {
      throw new HttpException(
        "Max share size exceeded",
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  }

  private async resetShareVirusScan(
    shareId: string,
    resetExistingFiles: boolean,
  ) {
    const scanReset = {
      virusScanStatus: "not_scanned",
      virusScanStartedAt: null,
      virusScanCompletedAt: null,
      virusScanThreats: null,
      virusScanError: null,
    };

    await this.prisma.share
      .update({
        where: { id: shareId },
        data: scanReset,
      })
      .catch(() => undefined);

    if (resetExistingFiles) {
      await this.prisma.file
        .updateMany({
          where: { shareId },
          data: scanReset,
        })
        .catch(() => undefined);
    }
  }

  async create(
    data: string,
    chunk: { index: number; total: number },
    file: {
      id?: string;
      name: string;
      relativePath?: string | null;
      order?: number;
      previewGroup?: boolean;
      previewHeader?: string | null;
    },
    shareId: string,
  ) {
    const fallbackFileOrder = await this.prisma.file.count({
      where: { shareId },
    });
    const nextFileOrder =
      typeof file.order === "number" && Number.isFinite(file.order)
        ? Math.max(0, Math.trunc(file.order))
        : fallbackFileOrder;

    if (!file.id) {
      file.id = crypto.randomUUID();
    } else if (!isValidUUID(file.id)) {
      throw new BadRequestException("Invalid file ID format");
    }

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: { files: true, reverseShare: true },
    });

    if (share.uploadLocked)
      throw new BadRequestException("Share is already completed");

    const tempDir = `./data/upload-temp/${shareId}`;
    await fs.mkdir(tempDir, { recursive: true });

    let diskFileSize: number;
    try {
      diskFileSize = (await fs.stat(`${tempDir}/${file.id}.tmp-chunk`)).size;
    } catch {
      diskFileSize = 0;
    }

    const chunkSize = this.config.get("share.chunkSize");
    const expectedChunkIndex = Math.ceil(diskFileSize / chunkSize);

    if (expectedChunkIndex != chunk.index)
      throw new BadRequestException({
        message: "Unexpected chunk received",
        error: "unexpected_chunk_index",
        expectedChunkIndex,
      });

    const buffer = Buffer.from(data, "base64");

    const fileSizeSum = share.files.reduce(
      (n, { size }) => n + parseInt(size),
      0,
    );

    const shareSizeSum = fileSizeSum + diskFileSize + buffer.byteLength;

    const configuredShareLimit = await this.getConfiguredShareLimit(shareId);

    if (
      shareSizeSum > configuredShareLimit ||
      (share.reverseShare?.maxShareSize &&
        shareSizeSum > parseInt(share.reverseShare.maxShareSize))
    ) {
      throw new HttpException(
        "Max share size exceeded",
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    await fs.appendFile(`${tempDir}/${file.id}.tmp-chunk`, buffer);

    const isLastChunk = chunk.index == chunk.total - 1;
    if (isLastChunk) {
      const tempFilePath = `${tempDir}/${file.id}.tmp-chunk`;
      const finalTempPath = `${tempDir}/${file.id}`;

      await fs.rename(tempFilePath, finalTempPath);

      const fileSize = (await fs.stat(finalTempPath)).size;

      if (this.r2Storage.isEnabled()) {
        const fileStream = createReadStream(finalTempPath);
        const r2Key = this.r2Storage.getFileKey(shareId, file.id);
        const contentType =
          mime.lookup(file.name) || "application/octet-stream";

        await this.r2Storage.upload(r2Key, fileStream, contentType);
        this.logger.log(`Uploaded file ${file.id} to R2`);

        await fs.unlink(finalTempPath);
      } else {
        const diskDir = `${SHARE_DIRECTORY}/${shareId}`;
        await fs.mkdir(diskDir, { recursive: true });
        await fs.rename(finalTempPath, `${diskDir}/${file.id}`);
      }

      try {
        const remainingFiles = await fs.readdir(tempDir);
        if (remainingFiles.length === 0) {
          await fs.rmdir(tempDir);
        }
      } catch {
      }

      await this.prisma.file.create({
        data: {
          id: file.id,
          name: file.name,
          size: fileSize.toString(),
          order: nextFileOrder,
          previewGroup: file.previewGroup ?? true,
          previewHeader: file.previewHeader || null,
          relativePath: file.relativePath || null,
          storageLocation: this.r2Storage.isEnabled() ? "s3" : "local",
          lastAccessedAt: new Date(),
          share: { connect: { id: shareId } },
        },
      });
      await this.resetShareVirusScan(shareId, false);

      await this.queueVideoPreviewIfNeeded(shareId, file.id, file.name);
      await this.queueAudioMetadataIfNeeded(shareId, file.id, file.name);
    }

    return file;
  }

  async getUploadUrl(
    shareId: string,
    file: {
      id: string;
      name: string;
      size: number;
      relativePath?: string | null;
      order?: number;
      previewGroup?: boolean;
      previewHeader?: string | null;
    },
  ) {
    this.logger.log(
      `[getUploadUrl] Starting for share ${shareId}, file ${file.name}`,
    );

    if (!this.r2Storage.isEnabled()) {
      this.logger.log(
        `[getUploadUrl] R2 not enabled, falling back to chunked upload`,
      );
      return { useChunkedUpload: true };
    }

    try {
      const share = await this.prisma.share.findUnique({
        where: { id: shareId },
        select: {
          uploadLocked: true,
          reverseShare: {
            select: {
              maxShareSize: true,
            },
          },
        },
      });

      if (!share) {
        this.logger.warn(`[getUploadUrl] Share not found: ${shareId}`);
        throw new NotFoundException("Share not found");
      }

      if (share.uploadLocked) {
        this.logger.warn(`[getUploadUrl] Share is locked: ${shareId}`);
        throw new BadRequestException("Share is already completed");
      }

      await this.validateShareSizeLimit(
        shareId,
        file.size,
        share.reverseShare?.maxShareSize,
      );

      const contentType = mime.lookup(file.name) || "application/octet-stream";
      const r2Key = this.r2Storage.getFileKey(shareId, file.id);

      this.logger.log(
        `[getUploadUrl] Getting signed URL for key: ${r2Key}, contentType: ${contentType}`,
      );

      const uploadUrl = await this.r2Storage.getSignedUploadUrl(
        r2Key,
        contentType,
      );

      this.logger.log(
        `[getUploadUrl] Success - got signed URL for ${file.name}`,
      );

      return {
        useChunkedUpload: false,
        uploadUrl,
        fileId: file.id,
      };
    } catch (error) {
      this.logger.error(`[getUploadUrl] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async confirmDirectUpload(
    shareId: string,
    file: {
      id: string;
      name: string;
      size: number;
      relativePath?: string | null;
      order?: number;
      previewGroup?: boolean;
      previewHeader?: string | null;
    },
  ) {
    const existingFile = await this.prisma.file.findUnique({
      where: { id: file.id },
      select: { id: true, name: true },
    });

    if (existingFile) {
      this.logger.log(
        `Confirmed direct upload ${file.id} to R2 (already recorded)`,
      );
      return existingFile;
    }

    const fallbackFileOrder = await this.prisma.file.count({
      where: { shareId },
    });
    const nextFileOrder =
      typeof file.order === "number" && Number.isFinite(file.order)
        ? Math.max(0, Math.trunc(file.order))
        : fallbackFileOrder;

    if (!this.r2Storage.isEnabled()) {
      throw new BadRequestException("R2 storage is not enabled");
    }

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: {
        reverseShare: {
          select: {
            maxShareSize: true,
          },
        },
      },
    });

    await this.validateShareSizeLimit(
      shareId,
      file.size,
      share?.reverseShare?.maxShareSize,
    );

    await this.prisma.file.create({
      data: {
        id: file.id,
        name: file.name,
        size: file.size.toString(),
        order: nextFileOrder,
        previewGroup: file.previewGroup ?? true,
        previewHeader: file.previewHeader || null,
        relativePath: file.relativePath || null,
        storageLocation: "s3",
        lastAccessedAt: new Date(),
        share: { connect: { id: shareId } },
      },
    });
    await this.resetShareVirusScan(shareId, false);

    this.logger.log(`Confirmed direct upload ${file.id} to R2`);

    await this.queueVideoPreviewIfNeeded(shareId, file.id, file.name);
    await this.queueAudioMetadataIfNeeded(shareId, file.id, file.name);

    return { id: file.id, name: file.name };
  }

  async get(shareId: string, fileId: string, forceDownload = false) {
    const [fileMetaData, share] = await Promise.all([
      this.prisma.file.findUnique({
        where: { id: fileId },
      }),
      this.prisma.share.findUnique({
        where: { id: shareId },
        include: { security: true },
      }),
    ]);

    if (!fileMetaData) throw new NotFoundException("File not found");
    if (!share) throw new NotFoundException("Share not found");

    const storageLocation = fileMetaData.storageLocation || "s3";

    await this.updateLastAccessed(fileId);

    if (storageLocation === "s3" && this.r2Storage.isEnabled()) {
      const r2Key = this.r2Storage.getFileKey(shareId, fileId);

      if (forceDownload) {
        this.logger.debug(`[get] Redirecting download from R2: ${r2Key}`);

        const downloadUrl = await this.r2Storage.getSignedUrl(
          r2Key,
          fileMetaData.name,
          3600,
          true,
        );

        return {
          metaData: {
            mimeType: mime.contentType(fileMetaData.name.split(".").pop()),
            ...fileMetaData,
            size: fileMetaData.size,
          },
          redirectUrl: downloadUrl,
        };
      } else {
        const downloadUrl = await this.r2Storage.getSignedUrl(r2Key);

        return {
          metaData: {
            mimeType: mime.contentType(fileMetaData.name.split(".").pop()),
            ...fileMetaData,
            size: fileMetaData.size,
          },
          redirectUrl: downloadUrl,
        };
      }
    } else {
      const diskPath = `${SHARE_DIRECTORY}/${shareId}/${fileId}`;

      try {
        await fs.access(diskPath);
      } catch {
        throw new NotFoundException("File not found on disk");
      }

      if (this.r2Storage.isEnabled()) {
        this.moveFileToR2(shareId, fileId, diskPath).catch((err) =>
          this.logger.error(`Failed to move file ${fileId} to R2:`, err),
        );
      }

      const file = createReadStream(diskPath);

      return {
        metaData: {
          mimeType: mime.contentType(fileMetaData.name.split(".").pop()),
          ...fileMetaData,
          size: fileMetaData.size,
        },
        file,
      };
    }
  }

  async getScanStream(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    if (fileMetaData.storageLocation === "s3" && this.r2Storage.isEnabled()) {
      const sourcePath = await this.r2Storage.getCachedSourceFile(
        this.r2Storage.getFileKey(shareId, fileId),
      );
      return createReadStream(sourcePath);
    }

    const diskPath = `${SHARE_DIRECTORY}/${shareId}/${fileId}`;

    try {
      await fs.access(diskPath);
    } catch {
      throw new NotFoundException("File not found on disk");
    }

    return createReadStream(diskPath);
  }

  private async moveFileToR2(
    shareId: string,
    fileId: string,
    diskPath: string,
  ): Promise<void> {
    try {
      const r2Key = this.r2Storage.getFileKey(shareId, fileId);
      if (await this.r2Storage.exists(r2Key)) {
        await this.prisma.file.update({
          where: { id: fileId },
          data: { storageLocation: "s3", lastAccessedAt: new Date() },
        });
        return;
      }

      const fileMetaData = await this.prisma.file.findUnique({
        where: { id: fileId },
        select: { name: true },
      });
      const contentType =
        mime.lookup(fileMetaData?.name || "") || "application/octet-stream";

      await this.r2Storage.upload(
        r2Key,
        createReadStream(diskPath),
        contentType,
      );

      await this.prisma.file.update({
        where: { id: fileId },
        data: { storageLocation: "s3", lastAccessedAt: new Date() },
      });

      await fs.unlink(diskPath);

      const diskShareDir = `${SHARE_DIRECTORY}/${shareId}`;
      try {
        const remainingFiles = await fs.readdir(diskShareDir);
        if (remainingFiles.length === 0) {
          await fs.rmdir(diskShareDir);
        }
      } catch {
      }

      this.logger.log(`Moved file ${fileId} from local disk to object storage (warmed up)`);
    } catch (error) {
      this.logger.error(`Error moving file ${fileId} to R2:`, error);
      throw error;
    }
  }

  async remove(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    const storageLocation = fileMetaData.storageLocation || "s3";

    if (storageLocation === "s3" && this.r2Storage.isEnabled()) {
      try {
        const r2Key = this.r2Storage.getFileKey(shareId, fileId);
        await this.r2Storage.delete(r2Key);
        await this.r2Storage.deletePrefix(
          this.r2Storage.getVideoPreviewPrefix(shareId, fileId),
        );
      } catch (error) {
        this.logger.warn(`Failed to delete ${fileId} from R2:`, error);
      }
    }

    try {
      await fs.unlink(`${SHARE_DIRECTORY}/${shareId}/${fileId}`);
    } catch {
    }

    await this.prisma.file.delete({ where: { id: fileId } });
    await this.resetShareVirusScan(shareId, true);

    await this.prisma.share
      .update({
        where: { id: shareId },
        data: { isZipReady: false },
      })
      .catch(() => undefined);

    if (this.r2Storage.isEnabled()) {
      try {
        const zipKey = this.r2Storage.getZipKey(shareId);
        if (await this.r2Storage.exists(zipKey)) {
          await this.r2Storage.delete(zipKey);
          this.logger.log(`Deleted stale R2 zip for changed share: ${shareId}`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to delete stale R2 zip for ${shareId}:`,
          error,
        );
      }
    }

    await fs
      .unlink(`${SHARE_DIRECTORY}/${shareId}/archive.zip`)
      .catch(() => undefined);

    return fileMetaData;
  }

  async deleteAllFiles(shareId: string) {
    const files = await this.prisma.file.findMany({
      where: { shareId },
      select: { id: true, storageLocation: true },
    });

    if (this.r2Storage.isEnabled()) {
      for (const file of files) {
        try {
          const r2Key = this.r2Storage.getFileKey(shareId, file.id);
          await this.r2Storage.delete(r2Key);
          await this.r2Storage.deletePrefix(
            this.r2Storage.getVideoPreviewPrefix(shareId, file.id),
          );
        } catch {
        }
      }

      try {
        await this.r2Storage.delete(this.r2Storage.getZipKey(shareId));
      } catch {
      }
    }

    try {
      await fs.rm(`${SHARE_DIRECTORY}/${shareId}`, {
        recursive: true,
        force: true,
      });
    } catch {
    }

    try {
      await fs.rm(`./data/upload-temp/${shareId}`, {
        recursive: true,
        force: true,
      });
    } catch {
    }
  }

  async getZip(
    shareId: string,
  ): Promise<
    | { redirectUrl: string; fileName: string }
    | { stream: Readable; fileName: string }
  > {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: { id: true, name: true },
    });

    const baseName = (share?.name || shareId).trim() || shareId;
    const safeBaseName =
      baseName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim() || shareId;
    const fileName = `${safeBaseName}.zip`;

    await this.prisma.file.updateMany({
      where: { shareId },
      data: { lastAccessedAt: new Date() },
    });

    if (this.r2Storage.isEnabled()) {
      const zipKey = this.r2Storage.getZipKey(shareId);
      if (await this.r2Storage.exists(zipKey)) {
        return {
          stream: await this.r2Storage.getStream(zipKey),
          fileName,
        };
      }
    }

    const diskZipPath = `${SHARE_DIRECTORY}/${shareId}/archive.zip`;
    if (fsSync.existsSync(diskZipPath)) {
      const stats = await fs.stat(diskZipPath);
      if (this.r2Storage.isEnabled() && stats.size < 100 * 1024 * 1024) {
        try {
          const zipBuffer = await fs.readFile(diskZipPath);
          const zipKey = this.r2Storage.getZipKey(shareId);
          await this.r2Storage.upload(zipKey, zipBuffer, "application/zip");
          await fs.unlink(diskZipPath);

          return {
            stream: await this.r2Storage.getStream(zipKey),
            fileName,
          };
        } catch (error) {
          this.logger.warn(
            `Failed to move zip to R2, serving from local disk:`,
            error,
          );
        }
      }

      return { stream: createReadStream(diskZipPath), fileName };
    }

    throw new NotFoundException(
      "Zip file not found - it may still be generating",
    );
  }

  async getMetadata(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    const mimeType =
      mime.contentType(fileMetaData.name.split(".").pop()) ||
      "application/octet-stream";

    const basicMetadata = {
      id: fileId,
      name: fileMetaData.name,
      size: parseInt(fileMetaData.size),
      mimeType,
      relativePath: fileMetaData.relativePath,
      lyricsText: fileMetaData.lyricsText,
      lyricsSource: fileMetaData.lyricsSource,
      lyricsSourceUrl: fileMetaData.lyricsSourceUrl,
    };

    if (
      fileMetaData.metadata &&
      fileMetaData.metadataStatus === FILE_METADATA_STATUSES.READY
    ) {
      try {
        return {
          ...JSON.parse(fileMetaData.metadata),
          ...basicMetadata,
        };
      } catch {
      }
    }

    if (mimeType.startsWith("audio/")) {
      try {
        const storageLocation = fileMetaData.storageLocation || "s3";
        let filePath: string;
        let needsCleanup = false;

        if (storageLocation === "s3" && this.r2Storage.isEnabled()) {
          const r2Key = this.r2Storage.getFileKey(shareId, fileId);
          filePath = await this.withPreviewTimeout(
            this.r2Storage.getCachedSourceFile(r2Key),
            PREVIEW_STORAGE_TIMEOUT_MS,
            "Timed out while fetching audio metadata source",
          );
        } else {
          filePath = `${SHARE_DIRECTORY}/${shareId}/${fileId}`;
        }

        try {
          const { stdout } = await this.withPreviewTimeout(
            execAsync(
              `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
            ),
            PREVIEW_PROBE_TIMEOUT_MS,
            "Timed out while probing audio metadata",
          );
          const parsedAudioTagMetadata = await this.withPreviewTimeout(
            this.extractParsedAudioTagMetadata(filePath),
            PREVIEW_PROBE_TIMEOUT_MS,
            "Timed out while parsing audio tags",
          );
          const info = JSON.parse(stdout);
          const audioStream = info.streams?.find(
            (s: any) => s.codec_type === "audio",
          );
          const format = info.format;
          const formatTags = format?.tags || {};
          const streamTags = audioStream?.tags || {};
          const originalCreateDate =
            this.extractAudioOriginalCreateDateFromFormatTags(formatTags);
          const fallbackCreateDate =
            this.extractAudioOriginalCreateDateFromFormatTags(streamTags);
          const encodedBy =
            this.extractAudioEncodedByFromTags(formatTags) ||
            this.extractAudioEncodedByFromTags(streamTags) ||
            parsedAudioTagMetadata.encodedBy;
          const embeddedArtwork = parsedAudioTagMetadata.coverDataUrl;

          const audioMetadata = {
            ...basicMetadata,
            type: "audio" as const,
            sampleRate: audioStream?.sample_rate
              ? parseInt(audioStream.sample_rate)
              : null,
            channels: audioStream?.channels || null,
            codec: audioStream?.codec_name || null,
            duration: format?.duration ? parseFloat(format.duration) : null,
            bitrate: this.resolveAudioBitrate(audioStream, format),
            format: format?.format_name || null,
            originalCreateDate: originalCreateDate || fallbackCreateDate,
            title: null,
            artist: null,
            album: null,
            year: null,
            track: null,
            genre: null,
            encodedBy,
            hasEmbeddedCover: !!embeddedArtwork,
            coverDataUrl: embeddedArtwork,
          };

          await this.prisma.file.update({
            where: { id: fileId },
            data: {
              metadata: JSON.stringify(audioMetadata),
              metadataStatus: FILE_METADATA_STATUSES.READY,
              metadataStartedAt: fileMetaData.metadataStartedAt || new Date(),
              metadataCompletedAt: new Date(),
              metadataError: null,
            },
          });

          return audioMetadata;
        } finally {
          if (needsCleanup) {
            try {
              await fs.unlink(filePath);
            } catch {
            }
          }
        }
      } catch (error) {
        const message = this.getErrorMessage(error);
        this.logger.warn(`Failed to extract audio metadata: ${message}`);
        await this.prisma.file.update({
          where: { id: fileId },
          data: {
            metadataStatus: FILE_METADATA_STATUSES.FAILED,
            metadataCompletedAt: new Date(),
            metadataError: message || "Failed to extract audio metadata",
          },
        });
        return basicMetadata;
      }
    }

    return basicMetadata;
  }

  private extractAudioOriginalCreateDateFromFormatTags(
    formatTags: Record<string, any>,
  ): string | null {
    const candidates = [
      formatTags.date_time_original,
      formatTags.DATE_TIME_ORIGINAL,
      formatTags.create_date,
      formatTags.CREATE_DATE,
      formatTags.creation_date,
      formatTags.CREATION_DATE,
      formatTags.creation_time,
      formatTags.CREATION_TIME,
      formatTags.date,
      formatTags.DATE,
      formatTags["com.apple.quicktime.creationdate"],
    ];

    const originationDate =
      formatTags.origination_date || formatTags.ORIGINATION_DATE;
    const originationTime =
      formatTags.origination_time || formatTags.ORIGINATION_TIME;
    if (originationDate || originationTime) {
      candidates.unshift(
        [originationDate, originationTime].filter(Boolean).join(" ").trim(),
      );
    }

    for (const candidate of candidates) {
      const normalized = this.normalizeAudioDate(candidate);
      if (normalized) return normalized;
    }

    return null;
  }

  private extractAudioEncodedByFromTags(
    formatTags: Record<string, any>,
  ): string | null {
    if (!formatTags || typeof formatTags !== "object") return null;

    const preferredKeys = [
      "encoder",
      "encoded_by",
      "encodersettings",
      "encodingsettings",
      "encodedby",
      "tool",
      "writing_application",
      "encoded_with",
    ];

    const entries = Object.entries(formatTags);

    for (const key of preferredKeys) {
      const match = entries.find(
        ([entryKey]) => entryKey.toLowerCase() === key,
      );
      const value = match?.[1];

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private async extractParsedAudioTagMetadata(filePath: string): Promise<{
    encodedBy: string | null;
    coverDataUrl: string | null;
  }> {
    try {
      const metadata = await mm.parseFile(filePath);
      const picture = metadata.common.picture?.[0];
      const common = metadata.common as Record<string, any>;
      const nativeGroups = Object.values(metadata.native || {});

      const commonCandidates = [
        common.encodedBy,
        common.encodedby,
        common.encoder,
        common.tool,
      ];

      let encodedBy =
        commonCandidates.find(
          (value) => typeof value === "string" && value.trim(),
        ) || null;

      if (!encodedBy) {
        const nativeKeyCandidates = [
          "TSSE",
          "TSS",
          "TENC",
          "TXXX:ENCODERSETTINGS",
          "TXXX:ENCODINGSETTINGS",
          "TXXX:ENCODER",
          "©too",
          "----:com.apple.iTunes:ENCODERSETTINGS",
          "----:com.apple.iTunes:ENCODINGSETTINGS",
        ];

        for (const group of nativeGroups) {
          const match = (group as any[]).find((entry) =>
            nativeKeyCandidates.includes(entry.id),
          );

          const rawValue = match?.value;
          const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

          if (typeof value === "string" && value.trim()) {
            encodedBy = value.trim();
            break;
          }
        }
      }

      let coverDataUrl: string | null = null;
      if (picture?.data) {
        const mimeType = picture.format || "image/jpeg";
        const base64 = Buffer.from(picture.data).toString("base64");
        coverDataUrl = `data:${mimeType};base64,${base64}`;
      }

      return {
        encodedBy,
        coverDataUrl,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse audio tags: ${error.message}`);
      return {
        encodedBy: null,
        coverDataUrl: null,
      };
    }
  }

  private normalizeAudioDate(value: unknown): string | null {
    if (!value) return null;

    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) return null;

    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      return raw.toISOString();
    }

    const text = String(raw).trim();
    if (!text) return null;

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return text;
  }

  async getZipContents(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    if (!this.isSupportedArchive(fileMetaData.name)) {
      throw new BadRequestException("Not a supported archive file");
    }

    const storageLocation = fileMetaData.storageLocation || "s3";
    const manifestPath = this.getArchiveManifestPath(fileId);

    if (fsSync.existsSync(manifestPath)) {
      const cachedManifest = JSON.parse(
        await fs.readFile(manifestPath, "utf-8"),
      );
      return { contents: cachedManifest.contents || [] };
    }

    const filePath = await this.ensureArchiveSourcePath(
      shareId,
      fileId,
      fileMetaData.name,
      storageLocation,
    );
    const { stdout } = await execAsync(
      `7z l -slt ${this.shellEscape(filePath)}`,
    );
    const contents = this.parseArchiveListing(stdout);

    await fs.mkdir(this.getArchiveCacheDir(fileId), { recursive: true });
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), contents },
        null,
        2,
      ),
      "utf-8",
    );

    return { contents };
  }

  async downloadArchiveSelection(
    shareId: string,
    fileId: string,
    selectedPaths: string[],
  ): Promise<{ stream: Readable; fileName: string }> {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");
    if (!this.isSupportedArchive(fileMetaData.name)) {
      throw new BadRequestException("Not a supported archive file");
    }

    const filteredPaths = Array.from(
      new Set(selectedPaths.map((item) => item.trim()).filter(Boolean)),
    );

    if (filteredPaths.length === 0) {
      throw new BadRequestException("No archive entries selected");
    }

    const storageLocation = fileMetaData.storageLocation || "s3";
    const archivePath = await this.ensureArchiveSourcePath(
      shareId,
      fileId,
      fileMetaData.name,
      storageLocation,
    );

    const tempRoot = path.join(
      "/tmp",
      `archive-select-${fileId}-${Date.now()}`,
    );
    const extractDir = path.join(tempRoot, "extract");
    const outputZipPath = path.join(tempRoot, "selection.zip");
    await fs.mkdir(extractDir, { recursive: true });

    const escapedSelected = filteredPaths
      .map((item) => this.shellEscape(item))
      .join(" ");
    await execAsync(
      `7z x -y -aoa -o${this.shellEscape(extractDir)} ${this.shellEscape(archivePath)} ${escapedSelected}`,
      { maxBuffer: 1024 * 1024 * 20 },
    );

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(outputZipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      archive.on("error", reject);
      archive.pipe(output);
      archive.directory(extractDir, false);
      archive.finalize();
    });

    const stream = createReadStream(outputZipPath);
    stream.on("close", async () => {
      try {
        await fs.rm(tempRoot, { recursive: true, force: true });
      } catch {
      }
    });

    const baseName = path.parse(fileMetaData.name).name.replace(/\s+/g, "-");
    return {
      stream,
      fileName: `${baseName}-selected.zip`,
    };
  }

  async getSpectrum(shareId: string, fileId: string): Promise<Readable> {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    const mimeType = mime.lookup(fileMetaData.name) || "";
    if (!mimeType.startsWith("audio/")) {
      throw new BadRequestException("Not an audio file");
    }

    const storageLocation = fileMetaData.storageLocation || "s3";
    let filePath = "";
    let needsCleanup = false;

    if (storageLocation === "s3" && this.r2Storage.isEnabled()) {
      const r2Key = this.r2Storage.getFileKey(shareId, fileId);
      filePath = await this.r2Storage.getCachedSourceFile(r2Key);
    } else {
      filePath = `${SHARE_DIRECTORY}/${shareId}/${fileId}`;
    }

    const outputPath = `/tmp/${fileId}_spectrum.png`;

    try {
      await execAsync(
        `ffmpeg -y -i "${filePath}" -lavfi showspectrumpic=s=1920x1080:mode=combined:legend=0:color=intensity:fscale=lin "${outputPath}"`,
      );

      const stream = createReadStream(outputPath);

      stream.on("end", async () => {
        try {
          await fs.unlink(outputPath);
          if (needsCleanup) {
            await fs.unlink(filePath);
          }
        } catch {
        }
      });

      return stream;
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Spectrum generation failed: ${message}`);
      try {
        await fs.unlink(outputPath);
        if (needsCleanup) {
          await fs.unlink(filePath);
        }
      } catch {
      }
      if (error instanceof StorageOperationError) {
        throw new InternalServerErrorException(message);
      }
      throw new InternalServerErrorException("Failed to generate spectrum");
    }
  }

  async queueVideoPreviewIfNeeded(
    shareId: string,
    fileId: string,
    fileName?: string | null,
  ) {
    if (!fileName || !this.isVideoFileName(fileName)) return;

    if (!this.r2Storage.isEnabled()) {
      await this.prisma.file.updateMany({
        where: { id: fileId, shareId },
        data: {
          videoPreviewStatus: VIDEO_PREVIEW_STATUSES.FAILED,
          videoPreviewError:
            "Cloud storage is required for adaptive video previews.",
        },
      });
      return;
    }

    await this.prisma.file.updateMany({
      where: {
        id: fileId,
        shareId,
        videoPreviewStatus: {
          in: [
            VIDEO_PREVIEW_STATUSES.NOT_STARTED,
            VIDEO_PREVIEW_STATUSES.FAILED,
          ],
        },
      },
      data: {
        videoPreviewStatus: VIDEO_PREVIEW_STATUSES.QUEUED,
        videoPreviewError: null,
      },
    });

    this.videoPreviewQueue.add(`${shareId}:${fileId}`);
    void this.processVideoPreviewQueue();
  }

  async queueAudioMetadataIfNeeded(
    shareId: string,
    fileId: string,
    fileName?: string | null,
  ) {
    if (!fileName || !this.isAudioFileName(fileName)) return;

    await this.prisma.file.updateMany({
      where: {
        id: fileId,
        shareId,
        metadataStatus: {
          in: [
            FILE_METADATA_STATUSES.NOT_STARTED,
            FILE_METADATA_STATUSES.FAILED,
          ],
        },
      },
      data: {
        metadataStatus: FILE_METADATA_STATUSES.QUEUED,
        metadataError: null,
      },
    });

    this.metadataQueue.add(`${shareId}:${fileId}`);
    void this.processMetadataQueue();
  }

  private async processMetadataQueue() {
    if (this.metadataWorkerRunning) return;
    this.metadataWorkerRunning = true;

    try {
      while (this.metadataQueue.size > 0) {
        const next = this.metadataQueue.values().next().value as
          | string
          | undefined;
        if (!next) break;

        this.metadataQueue.delete(next);
        const [shareId, fileId] = next.split(":");
        await this.generateAudioMetadata(shareId, fileId);
      }
    } finally {
      this.metadataWorkerRunning = false;
    }
  }

  private async generateAudioMetadata(shareId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
      select: { id: true, name: true, metadataStatus: true },
    });

    if (!file || !this.isAudioFileName(file.name)) return;
    if (file.metadataStatus === FILE_METADATA_STATUSES.READY) return;

    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        metadataStatus: FILE_METADATA_STATUSES.PROCESSING,
        metadataStartedAt: new Date(),
        metadataCompletedAt: null,
        metadataError: null,
      },
    });

    try {
      await this.getMetadata(shareId, fileId);
      this.logger.log(`Generated audio metadata for ${shareId}/${fileId}`);
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.warn(
        `Audio metadata generation failed for ${shareId}/${fileId}: ${message}`,
      );
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          metadataStatus: FILE_METADATA_STATUSES.FAILED,
          metadataCompletedAt: new Date(),
          metadataError: message || "Audio metadata generation failed",
        },
      });
    }
  }

  async getVideoPreviewStatus(shareId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
      select: {
        id: true,
        name: true,
        videoPreviewStatus: true,
        videoPreviewStartedAt: true,
        videoPreviewCompletedAt: true,
        videoPreviewError: true,
        videoPreviewQualities: true,
        videoPreviewDuration: true,
      },
    });

    if (!file) throw new NotFoundException("File not found");
    if (!this.isVideoFileName(file.name)) {
      throw new BadRequestException("Not a video file");
    }

    if (file.videoPreviewStatus === VIDEO_PREVIEW_STATUSES.NOT_STARTED) {
      await this.queueVideoPreviewIfNeeded(shareId, fileId, file.name);
    }

    return {
      status:
        file.videoPreviewStatus === VIDEO_PREVIEW_STATUSES.NOT_STARTED
          ? VIDEO_PREVIEW_STATUSES.QUEUED
          : file.videoPreviewStatus,
      qualities: this.parseVideoPreviewQualities(file.videoPreviewQualities),
      duration: file.videoPreviewDuration,
      error: file.videoPreviewError,
      startedAt: file.videoPreviewStartedAt,
      completedAt: file.videoPreviewCompletedAt,
    };
  }

  async getPreviewAdminStatus() {
    const files = await this.prisma.file.findMany({
      select: {
        id: true,
        shareId: true,
        name: true,
        size: true,
        videoPreviewStatus: true,
        videoPreviewStartedAt: true,
        videoPreviewCompletedAt: true,
        videoPreviewError: true,
        metadataStatus: true,
        metadataStartedAt: true,
        metadataCompletedAt: true,
        metadataError: true,
        share: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const videoFiles = files.filter((file) => this.isVideoFileName(file.name));
    const audioFiles = files.filter((file) => this.isAudioFileName(file.name));
    const countStatuses = <T extends { status: string }>(rows: T[]) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {});

    const videoRows = videoFiles.map((file) => ({
      type: "video",
      id: file.id,
      shareId: file.shareId,
      shareName: file.share?.name || null,
      name: file.name,
      size: file.size,
      status: file.videoPreviewStatus || VIDEO_PREVIEW_STATUSES.NOT_STARTED,
      startedAt: file.videoPreviewStartedAt,
      completedAt: file.videoPreviewCompletedAt,
      error: file.videoPreviewError,
    }));

    const audioRows = audioFiles.map((file) => ({
      type: "audio",
      id: file.id,
      shareId: file.shareId,
      shareName: file.share?.name || null,
      name: file.name,
      size: file.size,
      status: file.metadataStatus || FILE_METADATA_STATUSES.NOT_STARTED,
      startedAt: file.metadataStartedAt,
      completedAt: file.metadataCompletedAt,
      error: file.metadataError,
    }));

    return {
      queue: {
        videoQueued: this.videoPreviewQueue.size,
        videoActive: this.videoPreviewWorkerRunning,
        metadataQueued: this.metadataQueue.size,
        metadataActive: this.metadataWorkerRunning,
      },
      video: {
        total: videoRows.length,
        statusCounts: countStatuses(videoRows),
        files: videoRows.slice(0, 100),
      },
      audio: {
        total: audioRows.length,
        statusCounts: countStatuses(audioRows),
        files: audioRows.slice(0, 100),
      },
    };
  }

  async getStorageReconciliationReport(options?: {
    maxObjects?: number;
    limit?: number;
  }) {
    const maxObjects = Math.min(
      Math.max(options?.maxObjects || 20000, 100),
      100000,
    );
    const limit = Math.min(
      Math.max(options?.limit || STORAGE_RECONCILIATION_DEFAULT_LIMIT, 1),
      1000,
    );
    const generatedAt = new Date();

    const files = await this.prisma.file.findMany({
      select: {
        id: true,
        name: true,
        shareId: true,
        storageLocation: true,
      },
    });
    const shares = await this.prisma.share.findMany({
      select: {
        id: true,
        name: true,
        isZipReady: true,
        files: {
          select: { id: true },
        },
      },
    });

    const shareById = new Map(shares.map((share) => [share.id, share]));
    const shareIds = new Set(shares.map((share) => share.id));
    const fileIds = new Set(files.map((file) => file.id));
    const r2Files = files.filter(
      (file) => (file.storageLocation || "s3") === "s3",
    );
    const localFiles = files.filter((file) => file.storageLocation === "local");
    const expectedR2FileKeys = new Set(
      r2Files.map((file) => this.r2Storage.getFileKey(file.shareId, file.id)),
    );

    const r2Objects = this.r2Storage.isEnabled()
      ? await this.r2Storage.listKeys("shares/", maxObjects)
      : [];
    const r2ObjectKeys = new Set(r2Objects.map((object) => object.key));

    const missingR2FilesAll = r2Files
      .filter(
        (file) =>
          !r2ObjectKeys.has(this.r2Storage.getFileKey(file.shareId, file.id)),
      )
      .map((file) => ({
        fileId: file.id,
        shareId: file.shareId,
        name: file.name,
        expectedKey: this.r2Storage.getFileKey(file.shareId, file.id),
      }));

    const missingLocalFilesAll = (
      await Promise.all(
        localFiles.map(async (file) => {
          const expectedPath = path.join(
            SHARE_DIRECTORY,
            file.shareId,
            file.id,
          );
          try {
            await fs.access(expectedPath);
            return null;
          } catch {
            return {
              fileId: file.id,
              shareId: file.shareId,
              name: file.name,
              expectedPath,
            };
          }
        }),
      )
    ).filter((file): file is NonNullable<typeof file> => Boolean(file));

    const orphanedR2ObjectsAll = r2Objects.filter((object) => {
      const match = /^shares\/([^/]+)\/([^/]+)$/.exec(object.key);
      if (!match) return false;
      const [, shareId, objectName] = match;
      if (objectName === "archive.zip") return false;
      return !shareIds.has(shareId) || !expectedR2FileKeys.has(object.key);
    });

    const staleZipObjectsAll = r2Objects
      .filter((object) => object.key.endsWith("/archive.zip"))
      .map((object) => {
        const match = /^shares\/([^/]+)\/archive\.zip$/.exec(object.key);
        const shareId = match?.[1] || "";
        const share = shareById.get(shareId);
        const reason = !share
          ? "share_missing"
          : !share.isZipReady
            ? "db_not_ready"
            : share.files.length <= 1
              ? "single_file_or_empty_share"
              : null;

        return reason
          ? {
              ...object,
              shareId,
              reason,
            }
          : null;
      })
      .filter((object): object is NonNullable<typeof object> =>
        Boolean(object),
      );

    const orphanedPreviewObjectsAll = r2Objects
      .filter((object) => object.key.includes("/previews/"))
      .map((object) => {
        const match = /^shares\/([^/]+)\/previews\/([^/]+)\//.exec(object.key);
        const shareId = match?.[1] || "";
        const fileId = match?.[2] || "";
        const reason = !shareIds.has(shareId)
          ? "share_missing"
          : !fileIds.has(fileId)
            ? "file_missing"
            : null;

        return reason
          ? {
              ...object,
              shareId,
              fileId,
              reason,
            }
          : null;
      })
      .filter((object): object is NonNullable<typeof object> =>
        Boolean(object),
      );

    return {
      generatedAt,
      r2Enabled: this.r2Storage.isEnabled(),
      scanned: {
        dbShares: shares.length,
        dbFiles: files.length,
        dbR2Files: r2Files.length,
        dbLocalFiles: localFiles.length,
        r2Objects: r2Objects.length,
        r2ObjectScanLimit: maxObjects,
      },
      counts: {
        missingR2Files: missingR2FilesAll.length,
        missingLocalFiles: missingLocalFilesAll.length,
        orphanedR2Objects: orphanedR2ObjectsAll.length,
        staleZipObjects: staleZipObjectsAll.length,
        orphanedPreviewObjects: orphanedPreviewObjectsAll.length,
      },
      samples: {
        missingR2Files: missingR2FilesAll.slice(0, limit),
        missingLocalFiles: missingLocalFilesAll.slice(0, limit),
        orphanedR2Objects: orphanedR2ObjectsAll.slice(0, limit),
        staleZipObjects: staleZipObjectsAll.slice(0, limit),
        orphanedPreviewObjects: orphanedPreviewObjectsAll.slice(0, limit),
      },
      note: "Report-only. No objects or database rows were changed.",
    };
  }

  async enqueuePreviewWork(options: {
    type?: "video" | "audio" | "all";
    includeReady?: boolean;
    includeFailed?: boolean;
    shareId?: string;
  }) {
    const type = options.type || "all";
    const includeReady = options.includeReady === true;
    const includeFailed = options.includeFailed !== false;
    let queuedVideos = 0;
    let queuedAudio = 0;

    const files = await this.prisma.file.findMany({
      where: options.shareId ? { shareId: options.shareId } : undefined,
      select: {
        id: true,
        shareId: true,
        name: true,
        videoPreviewStatus: true,
        metadataStatus: true,
      },
      take: 5000,
    });

    for (const file of files) {
      if (
        (type === "video" || type === "all") &&
        this.isVideoFileName(file.name)
      ) {
        const status =
          file.videoPreviewStatus || VIDEO_PREVIEW_STATUSES.NOT_STARTED;
        if (
          includeReady ||
          status === VIDEO_PREVIEW_STATUSES.NOT_STARTED ||
          status === VIDEO_PREVIEW_STATUSES.QUEUED ||
          status === VIDEO_PREVIEW_STATUSES.PROCESSING ||
          (includeFailed && status === VIDEO_PREVIEW_STATUSES.FAILED)
        ) {
          await this.prisma.file.update({
            where: { id: file.id },
            data: {
              videoPreviewStatus: VIDEO_PREVIEW_STATUSES.QUEUED,
              videoPreviewStartedAt: null,
              videoPreviewCompletedAt: null,
              videoPreviewError: null,
            },
          });
          this.videoPreviewQueue.add(`${file.shareId}:${file.id}`);
          queuedVideos++;
        }
      }

      if (
        (type === "audio" || type === "all") &&
        this.isAudioFileName(file.name)
      ) {
        const status =
          file.metadataStatus || FILE_METADATA_STATUSES.NOT_STARTED;
        if (
          includeReady ||
          status === FILE_METADATA_STATUSES.NOT_STARTED ||
          status === FILE_METADATA_STATUSES.QUEUED ||
          status === FILE_METADATA_STATUSES.PROCESSING ||
          (includeFailed && status === FILE_METADATA_STATUSES.FAILED)
        ) {
          await this.prisma.file.update({
            where: { id: file.id },
            data: {
              metadataStatus: FILE_METADATA_STATUSES.QUEUED,
              metadataStartedAt: null,
              metadataCompletedAt: null,
              metadataError: null,
            },
          });
          this.metadataQueue.add(`${file.shareId}:${file.id}`);
          queuedAudio++;
        }
      }
    }

    if (this.videoPreviewQueue.size > 0) void this.processVideoPreviewQueue();
    if (this.metadataQueue.size > 0) void this.processMetadataQueue();

    return { queuedVideos, queuedAudio };
  }

  async getVideoPreviewObject(
    shareId: string,
    fileId: string,
    objectPath: string,
  ) {
    if (!/^[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)?$/.test(objectPath)) {
      throw new BadRequestException("Invalid preview path");
    }

    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
      select: { id: true, name: true, videoPreviewStatus: true },
    });

    if (!file) throw new NotFoundException("File not found");
    if (!this.isVideoFileName(file.name))
      throw new BadRequestException("Not a video file");
    if (file.videoPreviewStatus !== VIDEO_PREVIEW_STATUSES.READY) {
      throw new BadRequestException("Adaptive video preview is not ready");
    }

    const key = this.r2Storage.getVideoPreviewKey(shareId, fileId, objectPath);
    const cachePath = await this.ensureCachedVideoPreviewObject(
      shareId,
      fileId,
      objectPath,
      key,
    );

    return {
      stream: createReadStream(cachePath),
      contentType: this.getVideoPreviewContentType(objectPath),
    };
  }

  private async ensureCachedVideoPreviewObject(
    shareId: string,
    fileId: string,
    objectPath: string,
    key: string,
  ) {
    const cachePath = this.getVideoPreviewObjectCachePath(
      shareId,
      fileId,
      objectPath,
    );

    if (await this.pathExists(cachePath)) return cachePath;

    const lockKey = `${shareId}:${fileId}:${objectPath}`;
    const existingLock = this.videoPreviewObjectLocks.get(lockKey);
    if (existingLock) {
      await existingLock;
      return cachePath;
    }

    const cacheWrite = (async () => {
      const cacheDir = path.dirname(cachePath);
      const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
      const controller = new AbortController();
      let stream: Readable | undefined;
      const timeout = setTimeout(() => {
        controller.abort();
        stream?.destroy(
          new Error("Timed out while opening adaptive video preview"),
        );
      }, PREVIEW_STORAGE_TIMEOUT_MS);

      try {
        await fs.mkdir(cacheDir, { recursive: true });
        stream = await this.r2Storage.getStream(key, {
          abortSignal: controller.signal,
          attempts: 1,
        });
        await pipeline(stream, createWriteStream(tempPath));
        await fs.rename(tempPath, cachePath);
      } catch (error) {
        await fs.rm(tempPath, { force: true }).catch(() => undefined);

        if (controller.signal.aborted) {
          throw new Error("Timed out while opening adaptive video preview");
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    })();

    this.videoPreviewObjectLocks.set(lockKey, cacheWrite);

    try {
      await cacheWrite;
      return cachePath;
    } finally {
      this.videoPreviewObjectLocks.delete(lockKey);
    }
  }

  private async processVideoPreviewQueue() {
    if (this.videoPreviewWorkerRunning) return;
    this.videoPreviewWorkerRunning = true;

    try {
      while (this.videoPreviewQueue.size > 0) {
        const next = this.videoPreviewQueue.values().next().value as
          | string
          | undefined;
        if (!next) break;

        this.videoPreviewQueue.delete(next);
        const [shareId, fileId] = next.split(":");
        await this.generateVideoPreview(shareId, fileId);
      }
    } finally {
      this.videoPreviewWorkerRunning = false;
    }
  }

  private async generateVideoPreview(shareId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
    });

    if (!file || !this.isVideoFileName(file.name)) return;
    if (!this.r2Storage.isEnabled()) return;
    if (file.videoPreviewStatus === VIDEO_PREVIEW_STATUSES.READY) return;

    const workDir = this.getVideoPreviewWorkDir(fileId);
    const outputDir = path.join(workDir, "hls");
    let inputPath = this.getVideoPreviewInputPath(fileId, file.name);

    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        videoPreviewStatus: VIDEO_PREVIEW_STATUSES.PROCESSING,
        videoPreviewStartedAt: new Date(),
        videoPreviewCompletedAt: null,
        videoPreviewError: null,
      },
    });

    try {
      await fs.rm(workDir, { recursive: true, force: true });
      await fs.rm(this.getVideoPreviewObjectCacheDir(shareId, fileId), {
        recursive: true,
        force: true,
      });
      await fs.mkdir(outputDir, { recursive: true });
      await this.r2Storage.deletePrefix(
        this.r2Storage.getVideoPreviewPrefix(shareId, fileId),
      );

      const storageLocation = file.storageLocation || "s3";
      if (storageLocation === "s3") {
        inputPath = await this.r2Storage.getCachedSourceFile(
          this.r2Storage.getFileKey(shareId, fileId),
        );
      } else {
        await fs.copyFile(
          path.join(SHARE_DIRECTORY, shareId, fileId),
          inputPath,
        );
      }

      await this.generateAndStoreVideoThumbnail(shareId, fileId, inputPath);

      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams ${this.shellEscape(inputPath)}`,
        { maxBuffer: 1024 * 1024 * 10 },
      );
      const info = JSON.parse(stdout);
      const videoStream = info.streams?.find(
        (stream: any) => stream.codec_type === "video",
      );
      const sourceHeight = Number.parseInt(
        String(videoStream?.height || "0"),
        10,
      );
      const sourceWidth = Number.parseInt(
        String(videoStream?.width || "0"),
        10,
      );
      const duration = Number.parseFloat(String(info.format?.duration || "0"));
      const qualities = this.getVideoPreviewQualities(sourceHeight);

      for (const quality of qualities) {
        const qualityDir = path.join(outputDir, quality.label);
        await fs.mkdir(qualityDir, { recursive: true });

        await execAsync(
          [
            "ffmpeg -y",
            "-i",
            this.shellEscape(inputPath),
            "-map 0:v:0 -map 0:a:0?",
            `-vf ${this.shellEscape(`scale=w='trunc(iw*min(1\\,${quality.height}/ih)/2)*2':h='trunc(ih*min(1\\,${quality.height}/ih)/2)*2'`)}`,
            "-c:v libx264 -preset veryfast -crf 23",
            `-maxrate ${quality.maxrate} -bufsize ${quality.bufsize}`,
            "-c:a aac -b:a 128k -ac 2",
            "-hls_time 6 -hls_playlist_type vod -hls_flags independent_segments",
            `-hls_segment_filename ${this.shellEscape(path.join(qualityDir, "segment_%05d.ts"))}`,
            this.shellEscape(path.join(qualityDir, "index.m3u8")),
          ].join(" "),
          {
            timeout: 1000 * 60 * 60 * 2,
            maxBuffer: 1024 * 1024 * 20,
          },
        );
      }

      const masterPlaylist = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        ...qualities.flatMap((quality) => {
          const resolutionWidth =
            sourceWidth && sourceHeight
              ? Math.max(
                  2,
                  Math.round(
                    ((sourceWidth / sourceHeight) * quality.height) / 2,
                  ) * 2,
                )
              : 0;
          const resolution = resolutionWidth
            ? `,RESOLUTION=${resolutionWidth}x${quality.height}`
            : "";
          return [
            `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bandwidth}${resolution}`,
            `${quality.label}/index.m3u8`,
          ];
        }),
        "",
      ].join("\n");

      await fs.writeFile(
        path.join(outputDir, "master.m3u8"),
        masterPlaylist,
        "utf-8",
      );
      await this.uploadVideoPreviewDirectory(shareId, fileId, outputDir);

      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          videoPreviewStatus: VIDEO_PREVIEW_STATUSES.READY,
          videoPreviewCompletedAt: new Date(),
          videoPreviewError: null,
          videoPreviewQualities: JSON.stringify(
            qualities.map((quality) => quality.label),
          ),
          videoPreviewDuration: Number.isFinite(duration) ? duration : null,
        },
      });

      this.logger.log(
        `Generated adaptive video preview for ${shareId}/${fileId}`,
      );
    } catch (error) {
      this.logger.error(
        `Adaptive video preview failed for ${shareId}/${fileId}: ${error.message}`,
      );
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          videoPreviewStatus: VIDEO_PREVIEW_STATUSES.FAILED,
          videoPreviewCompletedAt: new Date(),
          videoPreviewError: error.message || "Adaptive video preview failed",
        },
      });
    } finally {
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch {
      }
    }
  }

  private async uploadVideoPreviewDirectory(
    shareId: string,
    fileId: string,
    outputDir: string,
    currentDir = outputDir,
  ) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.uploadVideoPreviewDirectory(
          shareId,
          fileId,
          outputDir,
          entryPath,
        );
        continue;
      }

      const relativePath = path
        .relative(outputDir, entryPath)
        .split(path.sep)
        .join("/");
      const key = this.r2Storage.getVideoPreviewKey(
        shareId,
        fileId,
        relativePath,
      );
      await this.r2Storage.upload(
        key,
        createReadStream(entryPath),
        this.getVideoPreviewContentType(relativePath),
      );
    }
  }

  private async generateAndStoreVideoThumbnail(
    shareId: string,
    fileId: string,
    inputPath: string,
  ) {
    const outputPath = this.getVideoThumbnailCachedPath(fileId);
    await fs.mkdir(VIDEO_THUMBNAIL_CACHE_DIRECTORY, { recursive: true });

    await this.withPreviewTimeout(
      execAsync(
        `ffmpeg -y -ss 0.5 -i "${inputPath}" -frames:v 1 -vf "scale=240:160:force_original_aspect_ratio=decrease" "${outputPath}"`,
      ),
      PREVIEW_PROBE_TIMEOUT_MS,
      "Timed out while generating video thumbnail",
    );

    if (this.r2Storage.isEnabled()) {
      await this.r2Storage.upload(
        this.r2Storage.getVideoPreviewKey(shareId, fileId, "thumbnail.jpg"),
        createReadStream(outputPath),
        "image/jpeg",
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async resumeQueuedVideoPreviews() {
    if (skipScheduledJob(this.logger, "resumeQueuedVideoPreviews")) return;
    if (this.videoPreviewWorkerRunning) return;

    const staleProcessingCutoff = new Date(Date.now() - 1000 * 60 * 30);
    const pendingFiles = await this.prisma.file.findMany({
      where: {
        OR: [
          { videoPreviewStatus: VIDEO_PREVIEW_STATUSES.QUEUED },
          {
            videoPreviewStatus: VIDEO_PREVIEW_STATUSES.PROCESSING,
            videoPreviewStartedAt: { lt: staleProcessingCutoff },
          },
        ],
      },
      select: { id: true, shareId: true, name: true },
      take: 5,
    });

    for (const file of pendingFiles) {
      if (this.isVideoFileName(file.name)) {
        this.videoPreviewQueue.add(`${file.shareId}:${file.id}`);
      }
    }

    if (this.videoPreviewQueue.size > 0) {
      void this.processVideoPreviewQueue();
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async resumeQueuedMetadataPreviews() {
    if (skipScheduledJob(this.logger, "resumeQueuedMetadataPreviews")) return;
    if (this.metadataWorkerRunning) return;

    const staleProcessingCutoff = new Date(Date.now() - 1000 * 60 * 15);
    const pendingFiles = await this.prisma.file.findMany({
      where: {
        OR: [
          { metadataStatus: FILE_METADATA_STATUSES.QUEUED },
          {
            metadataStatus: FILE_METADATA_STATUSES.PROCESSING,
            metadataStartedAt: { lt: staleProcessingCutoff },
          },
        ],
      },
      select: { id: true, shareId: true, name: true },
      take: 10,
    });

    for (const file of pendingFiles) {
      if (this.isAudioFileName(file.name)) {
        this.metadataQueue.add(`${file.shareId}:${file.id}`);
      }
    }

    if (this.metadataQueue.size > 0) {
      void this.processMetadataQueue();
    }
  }

  private static readonly IMAGE_THUMBNAIL_EXTENSIONS = new Set([
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif", ".avif",
    ".heic", ".heif",
  ]);

  private static readonly RENDITION_SIZES = {
    thumb: 480,
    preview: 1600,
  } as const;

  async getImageOrPdfThumbnail(
    shareId: string,
    fileId: string,
    size: "thumb" | "preview" = "thumb",
  ): Promise<Readable> {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!fileMetaData) throw new NotFoundException("File not found");

    const fileExtension = path.extname(fileMetaData.name || "").toLowerCase();
    const isPdf = fileExtension === ".pdf";
    const isImage =
      LocalFileService.IMAGE_THUMBNAIL_EXTENSIONS.has(fileExtension);

    if (!isPdf && !isImage) {
      throw new BadRequestException("No thumbnail available for this file");
    }

    const outputPath = this.getRenditionCachedPath(fileId, size);
    const remoteName = size === "thumb" ? "thumbnail.jpg" : `${size}.jpg`;

    try {
      await fs.access(outputPath);
      return createReadStream(outputPath);
    } catch {
    }

    if (this.r2Storage.isEnabled()) {
      const thumbnailKey = this.r2Storage.getVideoPreviewKey(
        shareId,
        fileId,
        remoteName,
      );
      try {
        if (await this.r2Storage.exists(thumbnailKey)) {
          return await this.r2Storage.getStream(thumbnailKey);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to read stored thumbnail for ${shareId}/${fileId}: ${this.getErrorMessage(error)}`,
        );
      }
    }

    const storageLocation = fileMetaData.storageLocation || "s3";
    let filePath: string;

    if (storageLocation === "s3" && this.r2Storage.isEnabled()) {
      filePath = await this.withPreviewTimeout(
        this.r2Storage.getCachedSourceFile(
          this.r2Storage.getFileKey(shareId, fileId),
        ),
        PREVIEW_STORAGE_TIMEOUT_MS,
        "Timed out while fetching thumbnail source",
      );
    } else {
      filePath = `${SHARE_DIRECTORY}/${shareId}/${fileId}`;
    }

    await fs.mkdir(VIDEO_THUMBNAIL_CACHE_DIRECTORY, { recursive: true });

    const edge = LocalFileService.RENDITION_SIZES[size];
    if (isPdf) {
      await this.generatePdfPageThumbnail(filePath, outputPath, edge);
    } else {
      await this.generateImageThumbnail(
        filePath,
        outputPath,
        edge,
        fileExtension === ".heic" || fileExtension === ".heif",
      );
    }

    if (this.r2Storage.isEnabled()) {
      try {
        await this.r2Storage.upload(
          this.r2Storage.getVideoPreviewKey(shareId, fileId, remoteName),
          createReadStream(outputPath),
          "image/jpeg",
        );
      } catch (error) {
        this.logger.warn(
          `Failed to store thumbnail for ${shareId}/${fileId}: ${this.getErrorMessage(error)}`,
        );
      }
    }

    return createReadStream(outputPath);
  }

  private async generateImageThumbnail(
    sourcePath: string,
    outputPath: string,
    edge: number,
    isHeif = false,
  ) {
    let decodeFrom = sourcePath;
    let decodedTempPath: string | null = null;

    try {
      if (isHeif) {
        decodedTempPath = `${outputPath}.decoded.jpg`;
        await this.withPreviewTimeout(
          execFileAsync("heif-convert", [sourcePath, decodedTempPath]).then(
            () => undefined,
          ),
          PREVIEW_PROBE_TIMEOUT_MS,
          "Timed out while decoding HEIC",
        );

        try {
          await fs.access(decodedTempPath);
        } catch {
          const suffixed = decodedTempPath.replace(/\.jpg$/, "-1.jpg");
          await fs.access(suffixed);
          decodedTempPath = suffixed;
        }
        decodeFrom = decodedTempPath;
      }

      const sharp = (await import("sharp")).default;
      await this.withPreviewTimeout(
        sharp(decodeFrom, { failOn: "none", limitInputPixels: 268402689 })
          .rotate()
          .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 72, mozjpeg: true })
          .toFile(outputPath)
          .then(() => undefined),
        PREVIEW_PROBE_TIMEOUT_MS,
        "Timed out while generating image thumbnail",
      );
    } finally {
      if (decodedTempPath) {
        await fs.rm(decodedTempPath, { force: true }).catch(() => undefined);
      }
    }
  }

  private async generatePdfPageThumbnail(
    sourcePath: string,
    outputPath: string,
    edge: number,
  ) {
    const prefix = `${outputPath}.page`;
    const rendered = `${prefix}-1.jpg`;

    try {
      await this.withPreviewTimeout(
        execFileAsync("pdftoppm", [
          "-jpeg",
          "-f", "1",
          "-l", "1",
          "-scale-to", String(edge),
          sourcePath,
          prefix,
        ]).then(() => undefined),
        PREVIEW_PROBE_TIMEOUT_MS,
        "Timed out while rendering PDF page",
      );
      await fs.rename(rendered, outputPath);
    } finally {
      await fs.rm(rendered, { force: true }).catch(() => undefined);
    }
  }

  async getVideoThumbnail(shareId: string, fileId: string): Promise<Readable> {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    const mimeType = String(mime.lookup(fileMetaData.name) || "").toLowerCase();
    const fileExtension = path.extname(fileMetaData.name || "").toLowerCase();
    const supportedVideoExtensions = new Set([
      ".mp4",
      ".m4v",
      ".mov",
      ".qt",
      ".webm",
      ".mkv",
      ".avi",
      ".ogv",
      ".3gp",
      ".3g2",
      ".mts",
      ".m2ts",
    ]);
    const isVideoMime =
      mimeType.startsWith("video/") ||
      mimeType === "application/mp4" ||
      mimeType === "application/octet-stream";

    if (!isVideoMime && !supportedVideoExtensions.has(fileExtension)) {
      throw new BadRequestException("Not a video file");
    }

    const outputPath = this.getVideoThumbnailCachedPath(fileId);

    try {
      await fs.access(outputPath);
      return createReadStream(outputPath);
    } catch {
    }

    if (this.r2Storage.isEnabled()) {
      const thumbnailKey = this.r2Storage.getVideoPreviewKey(
        shareId,
        fileId,
        "thumbnail.jpg",
      );
      try {
        if (await this.r2Storage.exists(thumbnailKey)) {
          return await this.r2Storage.getStream(thumbnailKey);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to read stored video thumbnail for ${shareId}/${fileId}: ${this.getErrorMessage(error)}`,
        );
      }
    }

    const storageLocation = fileMetaData.storageLocation || "s3";
    let filePath: string;
    let needsCleanup = false;

    try {
      if (storageLocation === "s3" && this.r2Storage.isEnabled()) {
        const r2Key = this.r2Storage.getFileKey(shareId, fileId);
        filePath = await this.withPreviewTimeout(
          this.r2Storage.getCachedSourceFile(r2Key),
          PREVIEW_STORAGE_TIMEOUT_MS,
          "Timed out while fetching video thumbnail source",
        );
      } else {
        filePath = `${SHARE_DIRECTORY}/${shareId}/${fileId}`;
      }

      await fs.mkdir(VIDEO_THUMBNAIL_CACHE_DIRECTORY, { recursive: true });

      await this.withPreviewTimeout(
        execAsync(
          `ffmpeg -y -ss 0.5 -i "${filePath}" -frames:v 1 -vf "scale=240:160:force_original_aspect_ratio=decrease" "${outputPath}"`,
        ),
        PREVIEW_PROBE_TIMEOUT_MS,
        "Timed out while generating video thumbnail",
      );

      if (this.r2Storage.isEnabled()) {
        await this.r2Storage.upload(
          this.r2Storage.getVideoPreviewKey(shareId, fileId, "thumbnail.jpg"),
          createReadStream(outputPath),
          "image/jpeg",
        );
      }

      const stream = createReadStream(outputPath);

      stream.on("close", async () => {
        try {
          if (needsCleanup) {
            await fs.unlink(filePath);
          }
        } catch {
        }
      });

      return stream;
    } catch (error) {
      this.logger.error(
        `Video thumbnail generation failed: ${this.getErrorMessage(error)}`,
      );
      try {
        await fs.unlink(outputPath);
        if (needsCleanup) {
          await fs.unlink(filePath);
        }
      } catch {
      }
      throw new InternalServerErrorException(
        "Failed to generate video thumbnail",
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredShares() {
    if (skipScheduledJob(this.logger, "cleanupExpiredShares")) return;
    this.logger.log("Starting expired share cleanup...");

    let deletedCount = 0;
    let errorCount = 0;

    try {
      const epoch0 = new Date(0);
      const expiredShares = await this.prisma.share.findMany({
        where: {
          expiration: { lt: new Date(), gt: epoch0 },
        },
        include: {
          files: true,
        },
      });

      for (const share of expiredShares) {
        try {
          this.logger.log(
            `Deleting expired share: ${share.id} (expired: ${share.expiration})`,
          );

          for (const file of share.files) {
            try {
              const storageLocation = file.storageLocation || "s3";

              if (storageLocation === "s3" && this.r2Storage.isEnabled()) {
                const r2Key = this.r2Storage.getFileKey(share.id, file.id);
                await this.r2Storage.delete(r2Key);
                await this.r2Storage.deletePrefix(
                  this.r2Storage.getVideoPreviewPrefix(share.id, file.id),
                );
                this.logger.log(`Deleted R2 file: ${file.id}`);
              } else if (storageLocation === "local") {
                const diskPath = `${SHARE_DIRECTORY}/${share.id}/${file.id}`;
                await fs.unlink(diskPath).catch(() => {});
                this.logger.log(`Deleted local file: ${file.id}`);
              }

              await this.prisma.file.delete({
                where: { id: file.id },
              });
            } catch (fileError) {
              this.logger.error(`Failed to delete file ${file.id}:`, fileError);
            }
          }

          try {
            if (this.r2Storage.isEnabled()) {
              const zipKey = this.r2Storage.getZipKey(share.id);
              if (await this.r2Storage.exists(zipKey)) {
                await this.r2Storage.delete(zipKey);
                this.logger.log(`Deleted R2 zip for share: ${share.id}`);
              }
            }

            const diskZipPath = `${SHARE_DIRECTORY}/${share.id}/archive.zip`;
            await fs.unlink(diskZipPath).catch(() => {});
          } catch (zipError) {
            this.logger.error(
              `Failed to delete zip for share ${share.id}:`,
              zipError,
            );
          }

          try {
            const shareDir = `${SHARE_DIRECTORY}/${share.id}`;
            await fs.rm(shareDir, { recursive: true, force: true });
          } catch (dirError) {
          }

          await this.prisma.share.delete({
            where: { id: share.id },
          });

          deletedCount++;
          this.logger.log(`Successfully deleted expired share: ${share.id}`);
        } catch (shareError) {
          this.logger.error(`Failed to delete share ${share.id}:`, shareError);
          errorCount++;
        }
      }

      if (deletedCount > 0 || errorCount > 0) {
        this.logger.log(
          `Cleanup complete: ${deletedCount} shares deleted, ${errorCount} errors`,
        );
      }
    } catch (error) {
      this.logger.error("Cleanup job failed:", error);
    }
  }
}
