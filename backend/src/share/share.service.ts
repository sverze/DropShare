import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
} from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { Prisma, Share, User } from "@prisma/client";
import * as archiver from "archiver";
import * as argon from "argon2";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as moment from "moment";
import { ClamScanService } from "src/clamscan/clamscan.service";
import { ConfigService } from "src/config/config.service";
import { Capability, hasCapability } from "src/auth/capabilities";
import { isTokenRevoked } from "src/auth/ban.util";
import { EmailService } from "src/email/email.service";
import { FileService } from "src/file/file.service";
import { LyricsService } from "src/file/lyrics.service";
import { PrismaService } from "src/prisma/prisma.service";
import { R2StorageService } from "src/r2-storage/r2-storage.service";
import { ReverseShareService } from "src/reverseShare/reverseShare.service";
import { parseRelativeDateToAbsolute } from "src/utils/date.util";
import { CreateShareDTO } from "./dto/createShare.dto";
import { Readable, PassThrough } from "stream";
import * as path from "path";
import { SHARE_DIRECTORY } from "../constants";

export interface ZipProgress {
  shareId: string;
  status: "downloading" | "archiving" | "uploading" | "complete" | "error";
  currentFile: number;
  totalFiles: number;
  currentFileName: string;
  downloadedBytes: number;
  totalBytes: number;
  uploadPercent: number;
  error?: string;
  startedAt: Date;
}

const zipProgressMap = new Map<string, ZipProgress>();

export type ShareVirusScanStatus =
  | "not_scanned"
  | "scanning"
  | "clean"
  | "infected"
  | "too_large"
  | "failed";

type ShareEditablePermissions = {
  canAccessEditor: boolean;
  canEditShareThemeColor: boolean;
  canEditShareName: boolean;
  canEditShareDescription: boolean;
  canEditShareFileOrder: boolean;
  canAddFiles: boolean;
  canRemoveFiles: boolean;
};

type GroupMembershipPermissions = {
  role: string;
  groupId: string;
  allowEditShares: boolean;
  canEditShareThemeColor: boolean;
  canEditShareName: boolean;
  canEditShareDescription: boolean;
  canEditShareFileOrder: boolean;
  canAddFiles: boolean;
  canRemoveFiles: boolean;
};

type VirusScanQueueTask = {
  label: string;
  queuedAt: number;
  run: () => Promise<void>;
};

type ActiveVirusScanTask = {
  label: string;
  startedAt: number;
};

type ShareActivityActor =
  | Pick<User, "id" | "username" | "email">
  | null
  | undefined;

type VirusScannableFile = {
  id: string;
  virusScanStatus: string | null;
  virusScanStartedAt?: Date | null;
  virusScanCompletedAt?: Date | null;
  virusScanThreats?: string | null;
  virusScanError?: string | null;
};

const STALE_VIRUS_SCAN_MS = 60 * 60 * 1000;
const CLAMAV_MAX_SCAN_BYTES = Number(
  process.env.CLAMAV_MAX_SCAN_BYTES || 10 * 1024 * 1024 * 1024,
);

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);
  private zipRegen: {
    running: boolean;
    total: number;
    processed: number;
    successful: number;
    failed: number;
    startedAt: Date | null;
    finishedAt: Date | null;
  } = {
    running: false,
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    startedAt: null,
    finishedAt: null,
  };
  private virusScanQueue: VirusScanQueueTask[] = [];
  private activeVirusScanTasks: ActiveVirusScanTask[] = [];
  private activeVirusScans = 0;
  private readonly maxConcurrentVirusScans = Math.max(
    1,
    Number(process.env.VIRUS_SCAN_CONCURRENCY || 1),
  );
  private readonly virusScanRetryAttempts = Math.max(
    1,
    Number(process.env.VIRUS_SCAN_RETRY_ATTEMPTS || 3),
  );
  private readonly virusScanRetryBaseDelayMs = Math.max(
    250,
    Number(process.env.VIRUS_SCAN_RETRY_BASE_DELAY_MS || 3000),
  );
  private readonly geniusLyricsRefreshMs = Math.max(
    60 * 60 * 1000,
    Number(process.env.GENIUS_LYRICS_REFRESH_MS || 24 * 60 * 60 * 1000),
  );
  private readonly geniusLyricsInlineRefreshTimeoutMs = Math.max(
    250,
    Number(process.env.GENIUS_LYRICS_INLINE_REFRESH_TIMEOUT_MS || 2500),
  );
  private activeGeniusLyricsSyncs = new Map<string, Promise<any>>();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private fileService: FileService,
    private emailService: EmailService,
    private config: ConfigService,
    private jwtService: JwtService,
    private reverseShareService: ReverseShareService,
    private clamScanService: ClamScanService,
    private r2Storage: R2StorageService,
    private lyricsService: LyricsService,
  ) {}

  private isLimitedRegisteredUser(
    user?: Pick<User, "isAdmin" | "canCreateShares"> | null,
  ) {
    return !!user && !user.isAdmin && user.canCreateShares === false;
  }

  private assertLimitedRegisteredSharesAllowed(user?: User | null) {
    if (
      this.isLimitedRegisteredUser(user) &&
      !this.config.get("share.allowUninvitedRegisteredShares")
    ) {
      throw new ForbiddenException(
        "This account needs an invite code before it can create shares.",
      );
    }
  }

  private getEffectiveMaxExpiration(
    user?: Pick<User, "isAdmin" | "canCreateShares"> | null,
  ) {
    if (!user) {
      return this.config.get("share.maxAnonymousExpiration");
    }

    if (this.isLimitedRegisteredUser(user)) {
      return this.config.get("share.maxUninvitedRegisteredExpiration");
    }

    return this.config.get("share.maxExpiration");
  }

  generateAnonymousOwnerToken(shareId: string) {
    return this.jwtService.sign(
      {
        shareId,
        scope: "anonymous-share-owner",
      },
      {
        expiresIn: "30d",
        secret: this.config.get("internal.jwtSecret"),
      } as JwtSignOptions,
    );
  }

  verifyAnonymousOwnerToken(shareId: string, token?: string | null) {
    if (!token) return false;

    try {
      const payload = this.jwtService.verify<{
        shareId?: string;
        scope?: string;
      }>(token, {
        secret: this.config.get("internal.jwtSecret"),
      });

      return (
        payload.scope === "anonymous-share-owner" && payload.shareId === shareId
      );
    } catch {
      return false;
    }
  }

  private enqueueVirusScan(label: string, task: () => Promise<void>) {
    this.virusScanQueue.push({
      label,
      queuedAt: Date.now(),
      run: task,
    });
    this.logger.log(
      `[virusScan] Queued ${label}; active=${this.activeVirusScans}, queued=${this.virusScanQueue.length}`,
    );
    this.processVirusScanQueue();
  }

  private processVirusScanQueue() {
    while (
      this.activeVirusScans < this.maxConcurrentVirusScans &&
      this.virusScanQueue.length > 0
    ) {
      const task = this.virusScanQueue.shift();
      if (!task) return;

      this.activeVirusScans++;
      const startedAt = Date.now();
      const activeTask: ActiveVirusScanTask = {
        label: task.label,
        startedAt,
      };
      this.activeVirusScanTasks.push(activeTask);
      const waitMs = startedAt - task.queuedAt;
      this.logger.log(
        `[virusScan] Starting ${task.label}; waited=${waitMs}ms, active=${this.activeVirusScans}, queued=${this.virusScanQueue.length}`,
      );
      task
        .run()
        .then(() => {
          const elapsedMs = Date.now() - startedAt;
          this.logger.log(
            `[virusScan] Finished ${task.label}; duration=${elapsedMs}ms, queued=${this.virusScanQueue.length}`,
          );
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[virusScan] Queued scan task failed for ${task.label}: ${message}`,
          );
        })
        .finally(() => {
          this.activeVirusScans--;
          this.activeVirusScanTasks = this.activeVirusScanTasks.filter(
            (item) => item !== activeTask,
          );
          setTimeout(() => this.processVirusScanQueue(), 250);
        });
    }
  }

  private async deleteZipArchive(shareId: string, reason: string) {
    if (this.r2Storage.isEnabled()) {
      try {
        const zipKey = this.r2Storage.getZipKey(shareId);
        if (await this.r2Storage.exists(zipKey)) {
          await this.r2Storage.delete(zipKey);
          this.logger.log(
            `[zip] Deleted R2 archive for ${shareId} after ${reason}`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[zip] Failed to delete R2 archive for ${shareId}: ${message}`,
        );
      }
    }

    try {
      await fsPromises.unlink(`${SHARE_DIRECTORY}/${shareId}/archive.zip`);
      this.logger.log(
        `[zip] Deleted local archive for ${shareId} after ${reason}`,
      );
    } catch {
    }
  }

  private async invalidateShareZip(shareId: string, reason: string) {
    const updatedShare = await this.prisma.share.update({
      where: { id: shareId },
      data: { isZipReady: false },
    });
    await this.deleteZipArchive(shareId, reason);
    return updatedShare;
  }

  private isRetryableVirusScanError(error: unknown) {
    if (
      error instanceof BadRequestException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException
    ) {
      return false;
    }

    const message = error instanceof Error ? error.message : String(error);
    const retryableNeedles = [
      "No files could be downloaded",
      "could not be downloaded for zip creation",
      "TimeoutError",
      "timed out",
      "ECONNRESET",
      "ECONNREFUSED",
      "EPIPE",
      "ETIMEDOUT",
      "ENOTFOUND",
      "socket",
      "connection",
      "stream unavailable",
    ];

    return retryableNeedles.some((needle) =>
      message.toLowerCase().includes(needle.toLowerCase()),
    );
  }

  private isVirusScanTooLargeError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    return (
      normalized.includes("instream size limit exceeded") ||
      normalized.includes("size limit exceeded") ||
      normalized.includes("size limit reached") ||
      normalized.includes("heuristics.limits.exceeded")
    );
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isGeniusLyricsSource(source?: string | null) {
    return source === "genius-link" || source === "genius-search";
  }

  private shouldRefreshGeniusLyrics(file: any) {
    if (
      !this.isGeniusLyricsSource(file.lyricsSource) ||
      !file.lyricsSourceUrl ||
      !file.lyricsSyncEnabled ||
      file.lyricsSyncStatus === "checking"
    ) {
      return false;
    }

    if (!file.lyricsSyncedAt) return true;

    const syncedAt = new Date(file.lyricsSyncedAt).getTime();
    if (!Number.isFinite(syncedAt)) return true;

    return Date.now() - syncedAt >= this.geniusLyricsRefreshMs;
  }

  private refreshGeniusLyricsFile(file: any) {
    const activeSync = this.activeGeniusLyricsSyncs.get(file.id);
    if (activeSync) return activeSync;

    const sync = (async () => {
      try {
        await this.prisma.file.update({
          where: { id: file.id },
          data: {
            lyricsSyncStatus: "checking",
            lyricsSyncError: null,
          },
        });

        const imported = await this.lyricsService.importFromGenius(
          file.lyricsSourceUrl,
        );
        const updatedFile = await this.prisma.file.update({
          where: { id: file.id },
          data: {
            lyricsText: imported.lyricsText,
            lyricsSourceUrl: imported.url,
            lyricsSyncEnabled: true,
            lyricsSyncedAt: new Date(),
            lyricsSyncStatus: "synced",
            lyricsSyncError: null,
          },
        });

        this.logger.log(
          `[lyrics] Synced Genius lyrics for file ${file.id} from ${imported.url}`,
        );

        return updatedFile;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[lyrics] Failed to sync Genius lyrics for file ${file.id}: ${message}`,
        );
        await this.prisma.file
          .update({
            where: { id: file.id },
            data: {
              lyricsSyncStatus: "failed",
              lyricsSyncError: message.slice(0, 1000),
            },
          })
          .catch(() => undefined);

        return null;
      } finally {
        this.activeGeniusLyricsSyncs.delete(file.id);
      }
    })();

    this.activeGeniusLyricsSyncs.set(file.id, sync);
    return sync;
  }

  private async refreshStaleGeniusLyricsForShare(share: any) {
    const files = Array.isArray(share?.files) ? share.files : [];
    const staleFiles = files.filter((file) =>
      this.shouldRefreshGeniusLyrics(file),
    );

    if (staleFiles.length === 0) return;

    const refresh = Promise.all(
      staleFiles.map(async (file) => {
        const updatedFile = await this.refreshGeniusLyricsFile(file);
        if (updatedFile) Object.assign(file, updatedFile);
      }),
    );

    await Promise.race([
      refresh,
      this.sleep(this.geniusLyricsInlineRefreshTimeoutMs),
    ]);
  }

  private async withVirusScanRetries(label: string, task: () => Promise<void>) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.virusScanRetryAttempts; attempt++) {
      try {
        await task();
        return;
      } catch (error) {
        lastError = error;
        if (
          attempt >= this.virusScanRetryAttempts ||
          !this.isRetryableVirusScanError(error)
        ) {
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        const delay = this.virusScanRetryBaseDelayMs * attempt;
        this.logger.warn(
          `[virusScan] ${label} failed on attempt ${attempt}/${this.virusScanRetryAttempts}; retrying in ${delay}ms: ${message}`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private deriveShareVirusScan(files: VirusScannableFile[]) {
    if (files.length === 0) {
      return {
        virusScanStatus: "not_scanned" as ShareVirusScanStatus,
        virusScanStartedAt: null,
        virusScanCompletedAt: null,
        virusScanThreats: null,
        virusScanError: null,
      };
    }

    const statuses = files.map((file) => file.virusScanStatus || "not_scanned");
    const status: ShareVirusScanStatus = statuses.includes("infected")
      ? "infected"
      : statuses.includes("scanning")
        ? "scanning"
        : statuses.includes("failed")
          ? "failed"
          : statuses.includes("not_scanned")
            ? "not_scanned"
            : statuses.includes("too_large")
              ? "too_large"
              : "clean";

    const startedDates = files
      .map((file) => file.virusScanStartedAt)
      .filter((date): date is Date => !!date);
    const completedDates = files
      .map((file) => file.virusScanCompletedAt)
      .filter((date): date is Date => !!date);
    const threatList = files.flatMap((file) =>
      this.parseVirusScanThreats(file.virusScanThreats),
    );
    const errorList = files
      .map((file) => file.virusScanError)
      .filter((error): error is string => !!error);

    return {
      virusScanStatus: status,
      virusScanStartedAt: startedDates.length
        ? new Date(Math.max(...startedDates.map((date) => date.getTime())))
        : null,
      virusScanCompletedAt:
        status !== "scanning" && completedDates.length
          ? new Date(Math.max(...completedDates.map((date) => date.getTime())))
          : null,
      virusScanThreats: threatList.length ? JSON.stringify(threatList) : null,
      virusScanError: errorList.length ? errorList.join("; ") : null,
    };
  }

  private async updateShareVirusScanFromFiles(shareId: string) {
    const files = await this.prisma.file.findMany({
      where: { shareId },
      select: {
        id: true,
        virusScanStatus: true,
        virusScanStartedAt: true,
        virusScanCompletedAt: true,
        virusScanThreats: true,
        virusScanError: true,
      },
    });

    const derived = this.deriveShareVirusScan(files);
    await this.prisma.share.update({
      where: { id: shareId },
      data: derived,
    });

    return derived;
  }

  private queueFileVirusScan(shareId: string, fileId: string) {
    this.enqueueVirusScan(`file ${shareId}/${fileId}`, async () => {
      await this.withVirusScanRetries(`file ${shareId}/${fileId}`, () =>
        this.scanFile(shareId, fileId),
      ).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[virusScan] File scan failed for ${shareId}/${fileId}: ${message}`,
        );
        return this.prisma.file
          .update({
            where: { id: fileId },
            data: {
              virusScanStatus: this.isVirusScanTooLargeError(error)
                ? "too_large"
                : "failed",
              virusScanCompletedAt: new Date(),
              virusScanError: message || "Scan failed",
            },
          })
          .then(() => this.updateShareVirusScanFromFiles(shareId))
          .catch((updateError) =>
            this.logger.error(
              `[virusScan] Failed to persist file scan failure for ${fileId}: ${updateError.message}`,
            ),
          );
      });
    });
  }

  async getVirusScanAdminStatus() {
    const staleCutoff = new Date(Date.now() - STALE_VIRUS_SCAN_MS);
    const [shares, fileStatuses, staleFileScans, failedFileScans, clamav] =
      await Promise.all([
        this.prisma.share.findMany({
          where: { uploadLocked: true },
          select: {
            id: true,
            name: true,
            files: {
              select: {
                id: true,
                virusScanStatus: true,
                virusScanStartedAt: true,
                virusScanCompletedAt: true,
                virusScanThreats: true,
                virusScanError: true,
              },
            },
          },
        }),
        this.prisma.file.groupBy({
          by: ["virusScanStatus"],
          _count: { _all: true },
        }),
        this.prisma.file.findMany({
          where: {
            virusScanStatus: "scanning",
            virusScanStartedAt: {
              lt: staleCutoff,
            },
          },
          select: {
            id: true,
            shareId: true,
            name: true,
            virusScanStartedAt: true,
            virusScanError: true,
          },
          orderBy: { virusScanStartedAt: "asc" },
          take: 10,
        }),
        this.prisma.file.findMany({
          where: {
            virusScanStatus: "failed",
          },
          select: {
            id: true,
            shareId: true,
            name: true,
            virusScanCompletedAt: true,
            virusScanError: true,
          },
          orderBy: { virusScanCompletedAt: "desc" },
          take: 10,
        }),
        this.clamScanService.getStatus(),
      ]);

    const derivedShares = shares.map((share) => ({
      id: share.id,
      name: share.name,
      fileCount: share.files.length,
      ...this.deriveShareVirusScan(share.files),
    }));
    const shareStatusCounts = derivedShares.reduce<Record<string, number>>(
      (acc, share) => {
        acc[share.virusScanStatus] = (acc[share.virusScanStatus] || 0) + 1;
        return acc;
      },
      {},
    );
    const staleShareScans = derivedShares
      .filter(
        (share) =>
          share.virusScanStatus === "scanning" &&
          share.virusScanStartedAt &&
          share.virusScanStartedAt < staleCutoff,
      )
      .sort(
        (a, b) =>
          (a.virusScanStartedAt?.getTime() || 0) -
          (b.virusScanStartedAt?.getTime() || 0),
      )
      .slice(0, 10);
    const failedShareScans = derivedShares
      .filter((share) => share.virusScanStatus === "failed")
      .sort(
        (a, b) =>
          (b.virusScanCompletedAt?.getTime() || 0) -
          (a.virusScanCompletedAt?.getTime() || 0),
      )
      .slice(0, 10);

    const mapCounts = (
      rows: Array<{ virusScanStatus: string | null; _count: { _all: number } }>,
    ) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.virusScanStatus || "not_scanned"] = row._count._all;
        return acc;
      }, {});

    return {
      clamav,
      queue: {
        active: this.activeVirusScans,
        queued: this.virusScanQueue.length,
        maxConcurrent: this.maxConcurrentVirusScans,
        retryAttempts: this.virusScanRetryAttempts,
        retryBaseDelayMs: this.virusScanRetryBaseDelayMs,
        autoStartEnabled:
          this.config.get("share.virusScanEnabled") !== false &&
          process.env.VIRUS_SCAN_AUTO_START === "true",
        queuedJobs: this.virusScanQueue.slice(0, 10).map((task) => ({
          label: task.label,
          queuedAt: new Date(task.queuedAt).toISOString(),
          waitMs: Date.now() - task.queuedAt,
        })),
        activeJobs: this.activeVirusScanTasks.map((task) => ({
          label: task.label,
          startedAt: new Date(task.startedAt).toISOString(),
          elapsedMs: Date.now() - task.startedAt,
        })),
      },
      shares: {
        statusCounts: shareStatusCounts,
        staleScanning: staleShareScans,
        failedScans: failedShareScans.map((share) => ({
          id: share.id,
          name: share.name,
          fileCount: share.fileCount,
          virusScanCompletedAt: share.virusScanCompletedAt,
          virusScanError: share.virusScanError,
        })),
      },
      files: {
        statusCounts: mapCounts(fileStatuses),
        staleScanning: staleFileScans,
        failedScans: failedFileScans,
      },
    };
  }

  async restartVirusScans(options: {
    includeFailed?: boolean;
    includeStale?: boolean;
    includeNotScanned?: boolean;
  }) {
    const staleCutoff = new Date(Date.now() - STALE_VIRUS_SCAN_MS);
    const restartFailed = options.includeFailed !== false;
    const restartStale = options.includeStale !== false;
    const restartNotScanned = options.includeNotScanned === true;

    if (!restartFailed && !restartStale && !restartNotScanned) {
      return {
        queuedShares: 0,
        queuedFiles: 0,
        skippedShares: 0,
        skippedFiles: 0,
      };
    }

    const statusFilters = [
      restartNotScanned ? { virusScanStatus: "not_scanned" } : null,
      restartFailed ? { virusScanStatus: "failed" } : null,
      restartStale
        ? {
            virusScanStatus: "scanning",
            virusScanStartedAt: { lt: staleCutoff },
          }
        : null,
    ].filter(Boolean) as Array<Record<string, unknown>>;

    const fileCandidates = await this.prisma.file.findMany({
      where: {
        OR: statusFilters,
        share: { uploadLocked: true },
      },
      include: { share: true },
    });

    const touchedShareIds = new Set<string>();
    let queuedFiles = 0;
    let skippedFiles = 0;

    for (const file of fileCandidates) {
      await this.prisma.file.update({
        where: { id: file.id },
        data: {
          virusScanStatus: "scanning",
          virusScanStartedAt: new Date(),
          virusScanCompletedAt: null,
          virusScanThreats: null,
          virusScanError: null,
        },
      });
      this.queueFileVirusScan(file.shareId, file.id);
      touchedShareIds.add(file.shareId);
      queuedFiles++;
    }

    for (const shareId of touchedShareIds) {
      await this.updateShareVirusScanFromFiles(shareId);
    }

    this.logger.log(
      `[virusScan] Admin restarted scans: files=${queuedFiles}, skippedFiles=${skippedFiles}, includeNotScanned=${restartNotScanned}`,
    );

    return {
      queuedShares: 0,
      queuedFiles,
      skippedShares: 0,
      skippedFiles,
    };
  }

  async resolveUserFromAccessToken(accessToken?: string | null) {
    if (!accessToken) return null;

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        iat?: number;
      }>(accessToken, {
        secret: this.config.get("internal.jwtSecret"),
      });

      if (!payload?.sub) return null;

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (isTokenRevoked(user, payload.iat)) return null;
      return user;
    } catch {
      return null;
    }
  }

  private getFullShareEditablePermissions(): ShareEditablePermissions {
    return {
      canAccessEditor: true,
      canEditShareThemeColor: true,
      canEditShareName: true,
      canEditShareDescription: true,
      canEditShareFileOrder: true,
      canAddFiles: true,
      canRemoveFiles: true,
    };
  }

  private getNoShareEditablePermissions(): ShareEditablePermissions {
    return {
      canAccessEditor: false,
      canEditShareThemeColor: false,
      canEditShareName: false,
      canEditShareDescription: false,
      canEditShareFileOrder: false,
      canAddFiles: false,
      canRemoveFiles: false,
    };
  }

  private membershipToShareEditablePermissions(
    membership?: GroupMembershipPermissions | null,
  ): ShareEditablePermissions {
    if (!membership) {
      return this.getNoShareEditablePermissions();
    }

    if (membership.role === "leader") {
      return this.getFullShareEditablePermissions();
    }

    const canAccessEditor =
      Boolean(membership.allowEditShares) &&
      Boolean(
        membership.canEditShareThemeColor ||
        membership.canEditShareName ||
        membership.canEditShareDescription ||
        membership.canEditShareFileOrder ||
        membership.canAddFiles ||
        membership.canRemoveFiles,
      );

    return {
      canAccessEditor,
      canEditShareThemeColor:
        canAccessEditor && Boolean(membership.canEditShareThemeColor),
      canEditShareName: canAccessEditor && Boolean(membership.canEditShareName),
      canEditShareDescription:
        canAccessEditor && Boolean(membership.canEditShareDescription),
      canEditShareFileOrder:
        canAccessEditor && Boolean(membership.canEditShareFileOrder),
      canAddFiles: canAccessEditor && Boolean(membership.canAddFiles),
      canRemoveFiles: canAccessEditor && Boolean(membership.canRemoveFiles),
    };
  }

  private async getShareMutationContext(shareId: string, user?: User | null) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: {
        id: true,
        creatorId: true,
        groupId: true,
      },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    if (!user || !share.groupId) {
      return { share, membership: null };
    }

    const membership = await this.prisma.userGroupMembership.findFirst({
      where: { userId: user.id, groupId: share.groupId },
      select: {
        role: true,
        groupId: true,
        allowEditShares: true,
        canEditShareThemeColor: true,
        canEditShareName: true,
        canEditShareDescription: true,
        canEditShareFileOrder: true,
        canAddFiles: true,
        canRemoveFiles: true,
      },
    });

    if (!membership) {
      return { share, membership: null };
    }

    return { share, membership };
  }

  async getShareEditablePermissions(
    shareId: string,
    user?: User | null,
    anonymousOwnerToken?: string | null,
  ): Promise<ShareEditablePermissions> {
    const { share, membership } = await this.getShareMutationContext(
      shareId,
      user,
    );

    if (!user) {
      if (!share.creatorId) {
        return this.verifyAnonymousOwnerToken(shareId, anonymousOwnerToken)
          ? this.getFullShareEditablePermissions()
          : this.getNoShareEditablePermissions();
      }

      return this.getNoShareEditablePermissions();
    }

    if (
      user.isAdmin ||
      this.hasShareCap(user, "shares.edit") ||
      share.creatorId === user.id
    ) {
      return this.getFullShareEditablePermissions();
    }

    if (!share.creatorId) {
      return this.verifyAnonymousOwnerToken(shareId, anonymousOwnerToken)
        ? this.getFullShareEditablePermissions()
        : this.getNoShareEditablePermissions();
    }

    return this.membershipToShareEditablePermissions(membership);
  }

  private async assertSharePermission(
    shareId: string,
    permission: keyof ShareEditablePermissions,
    user?: User | null,
    anonymousOwnerToken?: string | null,
  ) {
    const permissions = await this.getShareEditablePermissions(
      shareId,
      user,
      anonymousOwnerToken,
    );

    if (!permissions[permission]) {
      throw new ForbiddenException(
        "Not allowed to modify this part of the share",
      );
    }

    return permissions;
  }

  async assertCanEditShareDetails(
    shareId: string,
    changes: {
      name?: unknown;
      description?: unknown;
      accentColor?: unknown;
      creatorId?: unknown;
      shareWithGroup?: unknown;
    },
    user?: User | null,
    anonymousOwnerToken?: string | null,
  ) {
    const share = await this.assertCanMutateShare(
      shareId,
      user,
      anonymousOwnerToken,
    );
    const permissions = await this.getShareEditablePermissions(
      shareId,
      user,
      anonymousOwnerToken,
    );

    if (
      changes.accentColor !== undefined &&
      !permissions.canEditShareThemeColor
    ) {
      throw new ForbiddenException("Not allowed to edit share theme color");
    }

    if (changes.name !== undefined && !permissions.canEditShareName) {
      throw new ForbiddenException("Not allowed to edit share name");
    }

    if (
      changes.description !== undefined &&
      !permissions.canEditShareDescription
    ) {
      throw new ForbiddenException("Not allowed to edit share description");
    }

    if (
      (changes.creatorId !== undefined ||
        changes.shareWithGroup !== undefined) &&
      !user?.isAdmin &&
      share.creatorId !== user?.id
    ) {
      throw new ForbiddenException(
        "Only the share owner or admins can change share ownership settings",
      );
    }

    return { share, permissions };
  }

  async assertCanAddFilesToShare(
    shareId: string,
    user?: User | null,
    anonymousOwnerToken?: string | null,
  ) {

    return this.assertSharePermission(
      shareId,
      "canAddFiles",
      user,
      anonymousOwnerToken,
    );
  }

  private hasShareCap(
    user: Pick<User, "isAdmin" | "role"> | null | undefined,
    capability: Capability,
  ): boolean {
    return hasCapability(
      user,
      capability,
      this.config.get("access.managerCapabilities"),
    );
  }

  async assertCanDeleteShare(
    shareId: string,
    user?: User | null,
    anonymousOwnerToken?: string | null,
  ) {
    const { share, membership } = await this.getShareMutationContext(
      shareId,
      user,
    );

    if (user?.isAdmin || this.hasShareCap(user, "shares.delete")) {
      return share;
    }

    if (!user) {
      if (!share.creatorId) {
        if (!this.verifyAnonymousOwnerToken(shareId, anonymousOwnerToken)) {
          throw new ForbiddenException("Invalid share owner token");
        }

        return share;
      }

      throw new ForbiddenException("Authentication required");
    }

    if (share.creatorId === user.id) {
      return share;
    }

    if (!share.creatorId) {
      if (!this.verifyAnonymousOwnerToken(shareId, anonymousOwnerToken)) {
        throw new ForbiddenException("Invalid share owner token");
      }

      return share;
    }

    if (membership?.role === "leader") {
      return share;
    }

    throw new ForbiddenException("Not allowed to delete this share");
  }

  async assertCanRemoveFilesFromShare(
    shareId: string,
    user?: User | null,
    anonymousOwnerToken?: string | null,
  ) {
    return this.assertSharePermission(
      shareId,
      "canRemoveFiles",
      user,
      anonymousOwnerToken,
    );
  }

  async assertCanEditShareFileOrder(
    shareId: string,
    user?: User | null,
    anonymousOwnerToken?: string | null,
  ) {
    return this.assertSharePermission(
      shareId,
      "canEditShareFileOrder",
      user,
      anonymousOwnerToken,
    );
  }

  async assertCanMutateShare(
    shareId: string,
    user?: User | null,
    anonymousOwnerToken?: string | null,
  ) {
    const { share } = await this.getShareMutationContext(shareId, user);

    if (user?.isAdmin || this.hasShareCap(user, "shares.edit")) {
      return share;
    }

    if (!user) {
      if (!share.creatorId) {
        if (!this.verifyAnonymousOwnerToken(shareId, anonymousOwnerToken)) {
          throw new ForbiddenException("Invalid share owner token");
        }

        return share;
      }

      throw new ForbiddenException("Authentication required");
    }

    if (share.creatorId === user.id) {
      return share;
    }

    if (!share.creatorId) {
      if (!this.verifyAnonymousOwnerToken(shareId, anonymousOwnerToken)) {
        throw new ForbiddenException("Invalid share owner token");
      }

      return share;
    }

    const permissions = await this.getShareEditablePermissions(
      shareId,
      user,
      anonymousOwnerToken,
    );
    if (permissions.canAccessEditor) {
      return share;
    }

    throw new ForbiddenException("Not allowed to modify this share");
  }

  async create(share: CreateShareDTO, user?: User, reverseShareToken?: string) {
    if (!(await this.isShareIdAvailable(share.id)).isAvailable)
      throw new BadRequestException("Share id already in use");

    if (!share.security || Object.keys(share.security).length == 0)
      share.security = undefined;

    if (share.security?.password) {
      share.security.password = await argon.hash(share.security.password);
    }

    let expirationDate: Date;

    const reverseShare =
      await this.reverseShareService.getByToken(reverseShareToken);
    if (reverseShare) {
      expirationDate = reverseShare.shareExpiration;
    } else {
      this.assertLimitedRegisteredSharesAllowed(user);

      const parsedExpiration = parseRelativeDateToAbsolute(share.expiration);

      const expiresNever = moment(0).toDate() == parsedExpiration;

      const maxExpiration = this.getEffectiveMaxExpiration(user);
      if (
        maxExpiration.value !== 0 &&
        (expiresNever ||
          parsedExpiration >
            moment().add(maxExpiration.value, maxExpiration.unit).toDate())
      ) {
        throw new BadRequestException(
          "Expiration date exceeds maximum expiration date",
        );
      }

      expirationDate = parsedExpiration;
    }

    let selectedGroupId: string | null = null;
    if (user && share.shareWithGroup !== false) {
      if (share.groupId) {
        const membership = await this.prisma.userGroupMembership.findFirst({
          where: { userId: user.id, groupId: share.groupId },
          select: { groupId: true },
        });

        if (!membership) {
          throw new ForbiddenException("User is not assigned to this group");
        }

        selectedGroupId = membership.groupId;
      } else {
        const membership = await this.prisma.userGroupMembership.findFirst({
          where: { userId: user.id },
          select: { groupId: true },
          orderBy: { createdAt: "asc" },
        });
        selectedGroupId = membership?.groupId || null;
      }
    }

    let shareTuple: Share;
    try {
      shareTuple = await this.prisma.share.create({
        data: {
          id: share.id,
          name: share.name,
          description: share.description,
          expiration: expirationDate,
          creator: user
            ? { connect: { id: user.id } }
            : reverseShare
              ? { connect: { id: reverseShare.creatorId } }
              : undefined,
          group: selectedGroupId
            ? { connect: { id: selectedGroupId } }
            : undefined,
          security: share.security && {
            create: {
              ...share.security,
            },
          },
          accentColor: share.accentColor,
          previewStyle: this.normalizePreviewStyle(share.previewStyle),
          recipients: {
            create: share.recipients
              ? share.recipients.map((email) => ({ email }))
              : [],
          },
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Share id already in use");
      }
      throw e;
    }

    if (reverseShare) {
      await this.prisma.reverseShare.update({
        where: { token: reverseShareToken },
        data: {
          shares: {
            connect: { id: shareTuple.id },
          },
        },
      });
    }

    return shareTuple;
  }

  private async downloadFileToTemp(
    shareId: string,
    file: { id: string; name: string; storageLocation: string },
    tempDir: string,
  ): Promise<string> {
    const localPath = path.join(tempDir, file.id);

    if (file.storageLocation === "s3" && this.r2Storage.isEnabled()) {
      const r2Key = this.r2Storage.getFileKey(shareId, file.id);
      await this.r2Storage.downloadQueuedToFile(r2Key, localPath);
    } else {
      const diskPath = `${SHARE_DIRECTORY}/${shareId}/${file.id}`;
      await fsPromises.copyFile(diskPath, localPath);
    }

    return localPath;
  }

  async createZip(shareId: string) {
    this.logger.log(`[createZip] Starting zip creation for share ${shareId}`);
    const startTime = Date.now();
    const tempDir = `./data/zip-temp/${shareId}`;

    const files = await this.prisma.file.findMany({
      where: { shareId },
      select: {
        id: true,
        name: true,
        relativePath: true,
        storageLocation: true,
        size: true,
      },
    });

    this.logger.log(
      `[createZip] Found ${files.length} files for share ${shareId}`,
    );

    if (files.length === 0) {
      this.logger.warn(`[createZip] No files found for share ${shareId}`);
      return;
    }

    const totalSize = files.reduce(
      (sum, f) => sum + parseInt(f.size || "0"),
      0,
    );
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    this.logger.log(`[createZip] Total size: ${totalSizeMB} MB`);

    zipProgressMap.set(shareId, {
      shareId,
      status: "downloading",
      currentFile: 0,
      totalFiles: files.length,
      currentFileName: "",
      downloadedBytes: 0,
      totalBytes: totalSize,
      uploadPercent: 0,
      startedAt: new Date(),
    });

    try {
      await fsPromises.mkdir(tempDir, { recursive: true });
      this.logger.log(`[createZip] Created temp directory: ${tempDir}`);

      const zipPath = `${tempDir}/archive.zip`;
      const archive = archiver("zip", {
        zlib: { level: this.config.get("share.zipCompressionLevel") },
      });
      const writeStream = fs.createWriteStream(zipPath);

      let zipError: Error | null = null;
      archive.on("error", (err) => {
        this.logger.error(`[createZip] Archive error: ${err.message}`);
        zipError = err;
      });
      writeStream.on("error", (err) => {
        this.logger.error(`[createZip] WriteStream error: ${err.message}`);
        zipError = err;
      });

      archive.pipe(writeStream);

      let processedFiles = 0;
      let downloadedBytes = 0;
      let failedFiles: string[] = [];

      for (const file of files) {
        const zipEntryPath = file.relativePath || file.name;
        const fileSize = parseInt(file.size || "0");

        zipProgressMap.set(shareId, {
          ...zipProgressMap.get(shareId)!,
          currentFile: processedFiles + 1,
          currentFileName: file.name,
        });

        try {
          this.logger.log(
            `[createZip] [${processedFiles + 1}/${files.length}] Downloading: ${file.name} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
          );

          const localPath = await this.downloadFileToTemp(
            shareId,
            file,
            tempDir,
          );

          archive.file(localPath, { name: zipEntryPath });

          downloadedBytes += fileSize;
          processedFiles++;

          zipProgressMap.set(shareId, {
            ...zipProgressMap.get(shareId)!,
            currentFile: processedFiles,
            downloadedBytes,
          });

          const progress = ((downloadedBytes / totalSize) * 100).toFixed(1);
          this.logger.log(
            `[createZip] [${processedFiles}/${files.length}] Added: ${file.name} (${progress}% complete)`,
          );
        } catch (error) {
          this.logger.error(
            `[createZip] Failed to download ${file.name}: ${error.message}`,
          );
          failedFiles.push(file.name);
        }
      }

      if (failedFiles.length > 0) {
        this.logger.warn(
          `[createZip] ${failedFiles.length} files failed to download: ${failedFiles.slice(0, 5).join(", ")}${failedFiles.length > 5 ? "..." : ""}`,
        );
        archive.abort();
        writeStream.destroy();
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        throw new Error(
          `${failedFiles.length} file${failedFiles.length === 1 ? "" : "s"} could not be downloaded for zip creation`,
        );
      }

      if (processedFiles === 0) {
        this.logger.error(
          `[createZip] No files could be downloaded for share ${shareId}`,
        );
        archive.abort();
        writeStream.destroy();
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        throw new Error("No files could be downloaded for zip creation");
      }

      zipProgressMap.set(shareId, {
        ...zipProgressMap.get(shareId)!,
        status: "archiving",
        currentFileName: "Creating archive...",
      });

      this.logger.log(
        `[createZip] Finalizing archive with ${processedFiles} files...`,
      );
      await archive.finalize();

      await new Promise<void>((resolve, reject) => {
        writeStream.on("close", () => {
          this.logger.log(`[createZip] WriteStream closed`);
          resolve();
        });
        writeStream.on("error", reject);

        setTimeout(
          () => reject(new Error("Zip creation timeout")),
          30 * 60 * 1000,
        );
      });

      if (zipError) {
        throw zipError;
      }

      const zipStats = await fsPromises.stat(zipPath);
      const zipSizeMB = (zipStats.size / 1024 / 1024).toFixed(2);
      const zipSizeGB = zipStats.size / (1024 * 1024 * 1024);
      this.logger.log(
        `[createZip] Zip file created: ${zipSizeMB} MB at ${zipPath}`,
      );

      if (zipStats.size === 0) {
        this.logger.error(`[createZip] Zip file is empty!`);
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        throw new Error("Zip file is empty");
      }

      zipProgressMap.set(shareId, {
        ...zipProgressMap.get(shareId)!,
        status: "uploading",
        currentFileName: `Uploading ${zipSizeMB} MB to R2...`,
        uploadPercent: 0,
      });

      if (this.r2Storage.isEnabled()) {
        const zipKey = this.r2Storage.getZipKey(shareId);

        if (zipSizeGB > 0.1) {
          this.logger.log(
            `[createZip] Uploading ${zipSizeMB} MB zip to R2 using multipart...`,
          );
          await this.r2Storage.uploadLargeFile(
            zipKey,
            zipPath,
            "application/zip",
            (percent) => {
              zipProgressMap.set(shareId, {
                ...zipProgressMap.get(shareId)!,
                uploadPercent: percent,
                currentFileName: `Uploading to R2: ${percent}%`,
              });
              if (percent % 10 === 0) {
                this.logger.log(`[createZip] Upload progress: ${percent}%`);
              }
            },
          );
          this.logger.log(
            `[createZip] Uploaded zip for share ${shareId} to R2`,
          );
        } else {
          this.logger.log(`[createZip] Uploading ${zipSizeMB} MB zip to R2...`);
          const zipStream = fs.createReadStream(zipPath);
          await this.r2Storage.upload(zipKey, zipStream, "application/zip");
          this.logger.log(
            `[createZip] Uploaded zip for share ${shareId} to R2`,
          );
        }
      } else {
        this.logger.log(`[createZip] Saving zip to local disk...`);
        const diskDir = `${SHARE_DIRECTORY}/${shareId}`;
        await fsPromises.mkdir(diskDir, { recursive: true });
        await fsPromises.rename(zipPath, `${diskDir}/archive.zip`);
        this.logger.log(`[createZip] Saved zip for share ${shareId} to local disk`);
      }

      await fsPromises.rm(tempDir, { recursive: true, force: true });
      this.logger.log(
        `[createZip] Cleaned temp directory for share ${shareId}: ${tempDir}`,
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `[createZip] Complete for ${shareId}: ${processedFiles} files, ${zipSizeMB} MB, ${elapsed}s`,
      );

      zipProgressMap.set(shareId, {
        ...zipProgressMap.get(shareId)!,
        status: "complete",
        currentFileName: "Complete!",
        uploadPercent: 100,
      });

      setTimeout(() => zipProgressMap.delete(shareId), 30000);
    } catch (error) {
      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        this.logger.log(
          `[createZip] Cleaned temp directory after failure for share ${shareId}: ${tempDir}`,
        );
      } catch (cleanupError) {
        const cleanupMessage =
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError);
        this.logger.warn(
          `[createZip] Failed to clean temp directory for share ${shareId}: ${cleanupMessage}`,
        );
      }

      zipProgressMap.set(shareId, {
        ...zipProgressMap.get(shareId)!,
        status: "error",
        error: error.message,
        currentFileName: `Error: ${error.message}`,
      });

      setTimeout(() => zipProgressMap.delete(shareId), 60000);

      throw error;
    }
  }

  getZipProgress(shareId: string): ZipProgress | null {
    return zipProgressMap.get(shareId) || null;
  }

  getAllZipProgress(): ZipProgress[] {
    return Array.from(zipProgressMap.values());
  }

  async getVirusScanStatus(id: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
      select: {
        id: true,
        files: {
          select: {
            id: true,
            virusScanStatus: true,
            virusScanStartedAt: true,
            virusScanCompletedAt: true,
            virusScanThreats: true,
            virusScanError: true,
          },
        },
      },
    });

    if (!share) throw new NotFoundException("Share not found");

    const derived = this.deriveShareVirusScan(share.files);

    return {
      id: share.id,
      virusScanStatus: derived.virusScanStatus,
      virusScanStartedAt: derived.virusScanStartedAt,
      virusScanCompletedAt: derived.virusScanCompletedAt,
      virusScanThreats: this.parseVirusScanThreats(derived.virusScanThreats),
      virusScanError: derived.virusScanError,
      fileCount: share.files.length,
    };
  }

  async startVirusScan(id: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!share || !share.uploadLocked) {
      throw new NotFoundException("Share not found");
    }

    // Same off switch the automatic path honours. Without this a request could
    // still queue a scan that can never finish, leaving every file stuck on
    // "scanning", which blocks downloads.
    if (this.config.get("share.virusScanEnabled") === false) {
      return this.getVirusScanStatus(id);
    }

    const derived = this.deriveShareVirusScan(share.files);
    if (derived.virusScanStatus === "scanning") {
      return this.getVirusScanStatus(id);
    }

    const scanStartedAt = new Date();
    await this.prisma.file.updateMany({
      where: { shareId: id },
      data: {
        virusScanStatus: "scanning",
        virusScanStartedAt: scanStartedAt,
        virusScanCompletedAt: null,
        virusScanThreats: null,
        virusScanError: null,
      },
    });

    await this.prisma.share.update({
      where: { id },
      data: {
        virusScanStatus: "scanning",
        virusScanStartedAt: scanStartedAt,
        virusScanCompletedAt: null,
        virusScanThreats: null,
        virusScanError: null,
      },
    });

    for (const file of share.files) {
      this.queueFileVirusScan(id, file.id);
    }

    return this.getVirusScanStatus(id);
  }

  private async startAutomaticVirusScans(id: string, reason: string) {
    // Admin-facing off switch, checked before the env flag. An install with no
    // reachable ClamAV can turn scanning off here instead of queueing scans
    // that can never complete.
    if (this.config.get("share.virusScanEnabled") === false) {
      this.logger.log(
        `[virusScan] Automatic scan skipped for ${id} after ${reason}: disabled in configuration`,
      );
      return;
    }

    if (process.env.VIRUS_SCAN_AUTO_START !== "true") {
      this.logger.log(
        `[virusScan] Automatic scan skipped for ${id} after ${reason}: VIRUS_SCAN_AUTO_START is not enabled`,
      );
      return;
    }

    try {
      const share = await this.prisma.share.findUnique({
        where: { id },
        include: { files: true },
      });

      if (!share || !share.uploadLocked) return;

      this.logger.log(
        `[virusScan] Auto-starting file scans for ${id} after ${reason}`,
      );
      await this.startVirusScan(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[virusScan] Automatic scan skipped for ${id}: ${message}`,
      );
    }
  }

  async assertZipDownloadAllowed(shareId: string) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: {
        files: {
          select: {
            id: true,
            virusScanStatus: true,
            virusScanStartedAt: true,
            virusScanCompletedAt: true,
            virusScanThreats: true,
            virusScanError: true,
          },
        },
      },
    });

    if (!share) throw new NotFoundException("Share not found");
    const derived = this.deriveShareVirusScan(share.files);

    if (derived.virusScanStatus === "scanning") {
      throw new ConflictException("File virus scan is still running");
    }

    if (derived.virusScanStatus === "infected") {
      const threats = this.parseVirusScanThreats(derived.virusScanThreats);
      throw new ForbiddenException(
        `Download blocked because a threat was detected${threats.length ? `: ${threats.join(", ")}` : ""}`,
      );
    }
  }

  async getFileVirusScanStatus(shareId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
      select: {
        id: true,
        name: true,
        virusScanStatus: true,
        virusScanStartedAt: true,
        virusScanCompletedAt: true,
        virusScanThreats: true,
        virusScanError: true,
      },
    });

    if (!file) throw new NotFoundException("File not found");

    return {
      id: file.id,
      virusScanStatus: file.virusScanStatus as ShareVirusScanStatus,
      virusScanStartedAt: file.virusScanStartedAt,
      virusScanCompletedAt: file.virusScanCompletedAt,
      virusScanThreats: this.parseVirusScanThreats(file.virusScanThreats),
      virusScanError: file.virusScanError,
      canScan: true,
    };
  }

  async startFileVirusScan(shareId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
      include: { share: true },
    });

    if (!file || !file.share?.uploadLocked) {
      throw new NotFoundException("File not found");
    }

    // See startVirusScan: a queued scan with no scanner never completes, and a
    // file stuck on "scanning" cannot be downloaded.
    if (this.config.get("share.virusScanEnabled") === false) {
      return this.getFileVirusScanStatus(shareId, fileId);
    }

    if (file.virusScanStatus === "scanning") {
      return this.getFileVirusScanStatus(shareId, fileId);
    }

    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        virusScanStatus: "scanning",
        virusScanStartedAt: new Date(),
        virusScanCompletedAt: null,
        virusScanThreats: null,
        virusScanError: null,
      },
    });
    await this.updateShareVirusScanFromFiles(shareId);

    this.enqueueVirusScan(`file ${shareId}/${fileId}`, async () => {
      await this.withVirusScanRetries(`file ${shareId}/${fileId}`, () =>
        this.scanFile(shareId, fileId),
      ).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[virusScan] File scan failed for ${shareId}/${fileId}: ${message}`,
        );
        return this.prisma.file
          .update({
            where: { id: fileId },
            data: {
              virusScanStatus: this.isVirusScanTooLargeError(error)
                ? "too_large"
                : "failed",
              virusScanCompletedAt: new Date(),
              virusScanError: message || "Scan failed",
            },
          })
          .then(() => this.updateShareVirusScanFromFiles(shareId))
          .catch((updateError) =>
            this.logger.error(
              `[virusScan] Failed to persist file scan failure for ${fileId}: ${updateError.message}`,
            ),
          );
      });
    });

    return this.getFileVirusScanStatus(shareId, fileId);
  }

  async assertFileDownloadAllowed(shareId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
      select: {
        virusScanStatus: true,
        virusScanThreats: true,
      },
    });

    if (!file) throw new NotFoundException("File not found");

    if (file.virusScanStatus === "scanning") {
      throw new ConflictException("File virus scan is still running");
    }

    if (file.virusScanStatus === "infected") {
      const threats = this.parseVirusScanThreats(file.virusScanThreats);
      throw new ForbiddenException(
        `File download blocked because a threat was detected${threats.length ? `: ${threats.join(", ")}` : ""}`,
      );
    }
  }

  private async scanFile(shareId: string, fileId: string) {
    const scanStartedAt = Date.now();
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
      select: { id: true, name: true, size: true },
    });

    if (!file) throw new NotFoundException("File not found");

    const sizeBytes = Number(file.size || 0);
    this.logger.log(
      `[virusScan] File ${shareId}/${fileId} scan started; name=${file.name}, bytes=${sizeBytes}`,
    );

    if (sizeBytes > CLAMAV_MAX_SCAN_BYTES) {
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          virusScanStatus: "too_large",
          virusScanStartedAt: new Date(scanStartedAt),
          virusScanCompletedAt: new Date(),
          virusScanThreats: null,
          virusScanError: `File is ${sizeBytes} bytes, above the ${CLAMAV_MAX_SCAN_BYTES} byte scanner limit`,
        },
      });
      await this.updateShareVirusScanFromFiles(shareId);
      this.logger.warn(
        `[virusScan] File ${shareId}/${fileId} marked too_large before scanning; bytes=${sizeBytes}, limit=${CLAMAV_MAX_SCAN_BYTES}`,
      );
      return;
    }

    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        virusScanStatus: "scanning",
        virusScanStartedAt: new Date(),
        virusScanCompletedAt: null,
        virusScanError: null,
      },
    });
    await this.updateShareVirusScanFromFiles(shareId);

    const stream = await this.fileService.getScanStream(shareId, fileId);
    const result = await this.clamScanService.scanStream(stream);
    const elapsedMs = Date.now() - scanStartedAt;
    const status =
      result.status === "too_large"
        ? "too_large"
        : result.status === "infected"
          ? "infected"
          : "clean";

    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        virusScanStatus: status,
        virusScanCompletedAt: new Date(),
        virusScanThreats: result.threats.length
          ? JSON.stringify(result.threats)
          : null,
        virusScanError: null,
      },
    });
    await this.updateShareVirusScanFromFiles(shareId);

    this.logger.log(
      `[virusScan] File ${shareId}/${fileId} scan completed with status ${status}; bytes=${sizeBytes}, duration=${elapsedMs}ms`,
    );
  }

  private isArchiveFileName(name: string) {
    const lower = name.toLowerCase();
    return [".zip", ".7z", ".rar", ".tar", ".gz", ".tar.gz", ".tgz"].some(
      (ext) => lower.endsWith(ext),
    );
  }

  private parseVirusScanThreats(value?: string | null): string[] {
    if (!value) return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
      return [value];
    }
  }

  async complete(id: string, reverseShareToken?: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
      include: {
        files: true,
        recipients: true,
        creator: true,
        reverseShare: { include: { creator: true } },
      },
    });

    if (await this.isShareCompleted(id))
      throw new BadRequestException("Share already completed");

    if (share.files.length == 0)
      throw new BadRequestException(
        "You need at least on file in your share to complete it.",
      );

    for (const recipient of share.recipients) {
      await this.emailService.sendMailToShareRecipients(
        recipient.email,
        share.id,
        share.creator,
        share.description,
        share.expiration,
      );
    }

    const notifyReverseShareCreator = share.reverseShare
      ? this.config.get("smtp.enabled") &&
        share.reverseShare.sendEmailNotification
      : undefined;

    if (notifyReverseShareCreator) {
      await this.emailService.sendMailToReverseShareCreator(
        share.reverseShare.creator.email,
        share.id,
      );
    }

    void this.clamScanService.checkAndRemove(share.id).catch((error) => {
      this.logger.warn(
        `[complete] Local ClamAV cleanup skipped for share ${share.id}: ${error.message}`,
      );
    });

    if (share.reverseShare) {
      await this.prisma.reverseShare.update({
        where: { token: reverseShareToken },
        data: { remainingUses: { decrement: 1 } },
      });
    }

    const updatedShare = await this.prisma.share.update({
      where: { id },
      data: { uploadLocked: true },
    });

    void this.startAutomaticVirusScans(id, "share completion");

    return {
      ...updatedShare,
      notifyReverseShareCreator,
    };
  }

  async revertComplete(id: string) {
    await this.prisma.share.update({
      where: { id },
      data: { uploadLocked: false },
    });
    return this.invalidateShareZip(id, "share reopened");
  }

  async relockAfterEditFailure(id: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!share) throw new NotFoundException("Share not found");

    if (share.files.length === 0) {
      throw new BadRequestException(
        "You need at least one file in your share to complete it.",
      );
    }

    const updatedShare = await this.prisma.share.update({
      where: { id },
      data: { uploadLocked: true },
    });

    void this.startAutomaticVirusScans(id, "edit failure relock");

    return updatedShare;
  }

  async getShares() {
    const shares = await this.prisma.share.findMany({
      orderBy: {
        expiration: "desc",
      },
      include: { files: true, creator: true, group: true },
    });

    return shares.map((share) => {
      return {
        ...share,
        recipients: [],
        files: share.files.map((file) => {
          return {
            ...file,
            metaData: undefined,
          };
        }),
        size: this.getShareSize(share),
      };
    });
  }

  async getAllSharesDashboard(query: {
    page?: string;
    limit?: string;
    search?: string;
    userId?: string;
    groupId?: string;
    sortBy?: string;
    sortDir?: string;
  }) {
    const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit || "25", 10) || 25),
    );
    const sortDir: "asc" | "desc" = query.sortDir === "asc" ? "asc" : "desc";

    const where = this.buildAdminShareWhere(query);

    const mapShare = (share: any) => ({
      ...share,
      recipients: [],
      files: (share.files || []).map((file: any) => ({
        ...file,
        metaData: undefined,
      })),
      size: this.getShareSize(share),
    });

    const pageInfo = (total: number) => ({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });

    if (query.sortBy === "size") {
      const matching = await this.prisma.share.findMany({
        where,
        select: { id: true, files: { select: { size: true } } },
      });
      const sized = matching
        .map((s) => ({
          id: s.id,
          total: s.files.reduce(
            (n, f) => n + parseInt(f.size || "0", 10),
            0,
          ),
        }))
        .sort((a, b) =>
          sortDir === "asc" ? a.total - b.total : b.total - a.total,
        );
      const pageIds = sized
        .slice((page - 1) * limit, page * limit)
        .map((s) => s.id);
      const rows = await this.prisma.share.findMany({
        where: { id: { in: pageIds } },
        include: { files: true, creator: true, group: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const shares = pageIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map(mapShare);
      return { shares, pagination: pageInfo(sized.length) };
    }

    const orderByMap: Record<string, Prisma.ShareOrderByWithRelationInput> = {
      id: { id: sortDir },
      name: { name: sortDir },
      username: { creator: { username: sortDir } },
      group: { group: { name: sortDir } },
      views: { views: sortDir },
      downloads: { downloads: sortDir },
      expires: { expiration: sortDir },
      createdAt: { createdAt: sortDir },
      editedAt: { editedAt: sortDir },
    };
    const orderBy = orderByMap[query.sortBy || ""] || { expiration: "desc" };

    const [rows, total] = await Promise.all([
      this.prisma.share.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { files: true, creator: true, group: true },
      }),
      this.prisma.share.count({ where }),
    ]);

    return { shares: rows.map(mapShare), pagination: pageInfo(total) };
  }

  private buildAdminShareWhere(q: {
    search?: string;
    userId?: string;
    groupId?: string;
  }): Prisma.ShareWhereInput {
    const search = q.search?.trim();
    const conditions: Prisma.ShareWhereInput[] = [];
    if (search) {
      conditions.push({
        OR: [
          { id: { contains: search } },
          { name: { contains: search } },
          { description: { contains: search } },
          { creator: { username: { contains: search } } },
          { creator: { email: { contains: search } } },
          { group: { name: { contains: search } } },
        ],
      });
    }
    if (q.userId) {
      conditions.push(
        q.userId === "__anonymous__"
          ? { creatorId: null }
          : { creatorId: q.userId },
      );
    }
    if (q.groupId) {
      conditions.push(
        q.groupId === "__no_group__"
          ? { groupId: null }
          : { groupId: q.groupId },
      );
    }
    return conditions.length ? { AND: conditions } : {};
  }

  private async resolveBulkShareIds(body: {
    ids?: string[];
    all?: boolean;
    search?: string;
    userId?: string;
    groupId?: string;
  }): Promise<string[]> {
    if (body.all) {
      const rows = await this.prisma.share.findMany({
        where: this.buildAdminShareWhere(body),
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    return Array.isArray(body.ids)
      ? body.ids.filter((x) => typeof x === "string")
      : [];
  }

  async bulkDeleteShares(
    user: User,
    body: {
      ids?: string[];
      all?: boolean;
      search?: string;
      userId?: string;
      groupId?: string;
    },
  ): Promise<{ deleted: number; failed: number }> {
    const ids = await this.resolveBulkShareIds(body);
    let deleted = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await this.assertCanDeleteShare(id, user);
        await this.remove(id, user?.isAdmin === true);
        deleted++;
      } catch {
        failed++;
      }
    }
    return { deleted, failed };
  }

  async bulkAssignGroupShares(
    user: User,
    body: {
      ids?: string[];
      all?: boolean;
      search?: string;
      userId?: string;
      groupId?: string;
      targetGroupId?: string | null;
    },
  ): Promise<{ updated: number; failed: number }> {
    const ids = await this.resolveBulkShareIds(body);
    const groupId = body.targetGroupId || null;
    let updated = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await this.assertCanMutateShare(id, user);
        await this.update(id, { groupId } as any, user);
        updated++;
      } catch {
        failed++;
      }
    }
    return { updated, failed };
  }

  async getSharesByUser(userId: string) {
    const shares = await this.prisma.share.findMany({
      where: {
        creator: { id: userId },
        uploadLocked: true,
        OR: [
          { expiration: { gt: new Date() } },
          { expiration: { equals: moment(0).toDate() } },
        ],
      },
      orderBy: {
        expiration: "desc",
      },
      include: { files: true, recipients: true },
    });

    return shares.map((share) => {
      return {
        ...share,
        recipients: share.recipients.map((recipients) => recipients.email),
        size: this.getShareSize(share),
      };
    });
  }

  async getMySharesDashboard(
    user: User,
    query: { page?: string; limit?: string; search?: string },
  ) {
    const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit || "30", 10) || 30),
    );
    const search = query.search?.trim();

    const activeShareWhere = {
      creatorId: user.id,
      uploadLocked: true,
      OR: [
        { expiration: { gt: new Date() } },
        { expiration: { equals: moment(0).toDate() } },
      ],
    };

    const pagedWhere = search
      ? {
          AND: [
            activeShareWhere,
            {
              OR: [
                { id: { contains: search } },
                { name: { contains: search } },
                { description: { contains: search } },
              ],
            },
          ],
        }
      : activeShareWhere;

    const [sharePage, total, shareStats, shareFiles] = await Promise.all([
      this.prisma.share.findMany({
        where: pagedWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          files: true,
          recipients: true,
          security: true,
        },
      }),
      this.prisma.share.count({
        where: pagedWhere,
      }),
      this.prisma.share.aggregate({
        where: activeShareWhere,
        _count: { id: true },
        _sum: {
          views: true,
          downloads: true,
        },
      }),
      this.prisma.file.findMany({
        where: {
          share: {
            is: activeShareWhere,
          },
        },
        select: {
          size: true,
        },
      }),
    ]);

    const mappedShares = sharePage.map((share) => ({
      ...share,
      recipients: share.recipients.map((recipient) => recipient.email),
      size: this.getShareSize(share),
    }));

    return {
      shares: mappedShares,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        totalShares: shareStats._count.id ?? 0,
        totalFiles: shareFiles.length,
        totalViews: shareStats._sum.views ?? 0,
        totalDownloads: shareStats._sum.downloads ?? 0,
        totalSize: shareFiles.reduce(
          (sum, file) => sum + parseInt(file.size || "0", 10),
          0,
        ),
        uniqueVisitors30d: 0,
      },
    };
  }

  async getGroupSharesDashboard(
    user: User,
    query: { page?: string; limit?: string; search?: string; groupId?: string },
  ) {
    const membership = await this.prisma.userGroupMembership.findFirst({
      where: {
        userId: user.id,
        ...(query.groupId ? { groupId: query.groupId } : {}),
      },
      select: {
        role: true,
        groupId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!membership?.groupId) {
      return {
        shares: [],
        pagination: {
          page: 1,
          limit: Math.min(
            100,
            Math.max(1, parseInt(query.limit || "30", 10) || 30),
          ),
          total: 0,
          totalPages: 1,
        },
        stats: {
          totalShares: 0,
          totalFiles: 0,
          totalViews: 0,
          totalDownloads: 0,
          totalSize: 0,
          uniqueVisitors30d: 0,
        },
      };
    }

    const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit || "30", 10) || 30),
    );
    const search = query.search?.trim();

    const activeShareWhere = {
      groupId: membership.groupId,
      uploadLocked: true,
      OR: [
        { expiration: { gt: new Date() } },
        { expiration: { equals: moment(0).toDate() } },
      ],
    };

    const pagedWhere = search
      ? {
          AND: [
            activeShareWhere,
            {
              OR: [
                { id: { contains: search } },
                { name: { contains: search } },
                { description: { contains: search } },
              ],
            },
          ],
        }
      : activeShareWhere;

    const [sharePage, total, shareStats, shareFiles] = await Promise.all([
      this.prisma.share.findMany({
        where: pagedWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: true,
          files: true,
          recipients: true,
          security: true,
        },
      }),
      this.prisma.share.count({
        where: pagedWhere,
      }),
      this.prisma.share.aggregate({
        where: activeShareWhere,
        _count: { id: true },
        _sum: {
          views: true,
          downloads: true,
        },
      }),
      this.prisma.file.findMany({
        where: {
          share: {
            is: activeShareWhere,
          },
        },
        select: {
          size: true,
        },
      }),
    ]);

    const mappedShares = sharePage.map((share) => ({
      ...share,
      recipients: share.recipients.map((recipient) => recipient.email),
      size: this.getShareSize(share),
      canEdit: membership.role === "leader",
    }));

    return {
      shares: mappedShares,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        totalShares: shareStats._count.id ?? 0,
        totalFiles: shareFiles.length,
        totalViews: shareStats._sum.views ?? 0,
        totalDownloads: shareStats._sum.downloads ?? 0,
        totalSize: shareFiles.reduce(
          (sum, file) => sum + parseInt(file.size || "0", 10),
          0,
        ),
        uniqueVisitors30d: 0,
      },
    };
  }

  async get(id: string): Promise<any> {
    let share: any = await this.prisma.share.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
        creator: true,
        security: true,
      },
    });

    if (!share || !share.uploadLocked)
      throw new NotFoundException("Share not found");

    await this.refreshStaleGeniusLyricsForShare(share);

    const derivedScan = this.deriveShareVirusScan(share.files);
    share = {
      ...share,
      ...derivedScan,
      downloadCount: share.downloads,
      views: share.views,
      hasPassword: !!share.security?.password,
    };

    return share;
  }

  async getForOwner(
    id: string,
    user?: User | null,
    anonymousOwnerToken?: string | null,
  ): Promise<any> {
    const share = await this.get(id);

    return {
      ...share,
      editablePermissions: await this.getShareEditablePermissions(
        id,
        user,
        anonymousOwnerToken,
      ),
    };
  }

  async getMetaData(id: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            size: true,
            virusScanStatus: true,
            virusScanStartedAt: true,
            virusScanCompletedAt: true,
            virusScanThreats: true,
            virusScanError: true,
          },
        },
        security: {
          select: {
            password: true,
          },
        },
      },
    });

    if (!share || !share.uploadLocked)
      throw new NotFoundException("Share not found");

    const totalSize = share.files.reduce(
      (acc, file) => acc + parseInt(file.size),
      0,
    );

    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const firstImage = share.files.find((f) =>
      imageExtensions.some((ext) => f.name.toLowerCase().endsWith(ext)),
    );

    const firstFile = share.files[0];
    const firstFileFacts = firstFile
      ? this.buildFirstFileFacts(firstFile.name, firstFile.size)
      : null;

    return {
      id: share.id,
      name: share.name,
      description: share.description,
      hasPassword: !!share.security?.password,
      isZipReady: share.isZipReady,
      virusScanStatus: this.deriveShareVirusScan(share.files).virusScanStatus,
      fileCount: share.files.length,
      totalSize,
      previewImageId: firstImage?.id || null,
      accentColor: share.accentColor,
      firstFileName: firstFile?.name || null,
      firstFileFacts,
    };
  }

  private buildFirstFileFacts(
    fileName: string,
    fileSize?: string | number | null,
  ): string | null {
    const extension = fileName.split(".").pop()?.trim();
    const facts: string[] = [];

    if (extension) {
      facts.push(extension.toLowerCase());
    }

    const numericSize =
      typeof fileSize === "number"
        ? fileSize
        : parseInt(String(fileSize || "0"), 10);
    if (Number.isFinite(numericSize) && numericSize > 0) {
      facts.push(this.formatCompactBytes(numericSize));
    }

    return facts.length > 0 ? facts.join(" • ") : null;
  }

  private formatCompactBytes(bytes: number) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
  }

  async recordShareActivity({
    shareId,
    action,
    summary,
    details,
    actor,
  }: {
    shareId: string;
    action: string;
    summary: string;
    details?: string;
    actor?: ShareActivityActor;
  }) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: { id: true, name: true },
    });

    await this.prisma.shareActivity.create({
      data: {
        shareId: share?.id,
        shareName: share?.name || shareId,
        action,
        summary,
        details: details || null,
        actorId: actor?.id || null,
        actorUsername: actor?.username || actor?.email || "Guest",
      },
    });
  }

  async remove(shareId: string, isDeleterAdmin = false) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    if (!share) throw new NotFoundException("Share not found");

    if (!share.creatorId && !isDeleterAdmin)
      throw new ForbiddenException("Anonymous shares can't be deleted");

    await this.fileService.deleteAllFiles(shareId);
    await this.prisma.share.delete({ where: { id: shareId } });
  }

  async update(
    shareId: string,
    data: {
      name?: string;
      description?: string;
      accentColor?: string;
      creatorId?: string;
      shareWithGroup?: boolean;
      groupId?: string | null;
      previewStyle?: string;
    },
    actor?: User | null,
    anonymousOwnerToken?: string | null,
  ) {
    const { share } = await this.assertCanEditShareDetails(
      shareId,
      data,
      actor,
      anonymousOwnerToken,
    );

    const isDirectGroupAssignment =
      data.groupId !== undefined && data.shareWithGroup === undefined;

    if (
      (data.creatorId !== undefined || isDirectGroupAssignment) &&
      !actor?.isAdmin
    ) {
      throw new ForbiddenException("Only admins can transfer share ownership");
    }

    if (data.creatorId) {
      const newOwner = await this.prisma.user.findUnique({
        where: { id: data.creatorId },
        select: { id: true },
      });

      if (!newOwner) {
        throw new NotFoundException("New share owner not found");
      }
    }

    let nextGroupRelation:
      | { connect: { id: string } }
      | { disconnect: true }
      | undefined;

    if (isDirectGroupAssignment) {
      if (!actor?.isAdmin) {
        throw new ForbiddenException(
          "Only admins can directly assign share groups",
        );
      }

      if (data.groupId) {
        const targetGroup = await this.prisma.userGroup.findUnique({
          where: { id: data.groupId },
          select: { id: true },
        });

        if (!targetGroup) {
          throw new NotFoundException("Target group not found");
        }

        nextGroupRelation = { connect: { id: data.groupId } };
      } else {
        nextGroupRelation = { disconnect: true };
      }
    } else if (data.shareWithGroup !== undefined) {
      if (!actor) {
        throw new ForbiddenException("Authentication required");
      }

      const membership = await this.prisma.userGroupMembership.findFirst({
        where: {
          userId: actor.id,
          ...(data.groupId ? { groupId: data.groupId } : {}),
        },
        select: { groupId: true, role: true },
        orderBy: { createdAt: "asc" },
      });

      if (data.shareWithGroup) {
        if (!membership?.groupId) {
          throw new ForbiddenException("User is not assigned to a group");
        }

        if (!actor.isAdmin && share.creatorId !== actor.id) {
          throw new ForbiddenException(
            "Not allowed to add this share to a group",
          );
        }

        nextGroupRelation = { connect: { id: membership.groupId } };
      } else {
        if (!actor.isAdmin && share.creatorId !== actor.id) {
          throw new ForbiddenException(
            "Not allowed to remove this share from a group",
          );
        }

        nextGroupRelation = { disconnect: true };
      }
    }

    const updatedShare = await this.prisma.share.update({
      where: { id: shareId },
      data: {
        name: data.name === undefined ? undefined : data.name?.trim() || null,
        description:
          data.description === undefined
            ? undefined
            : data.description?.trim() || null,
        accentColor:
          data.accentColor === undefined ? undefined : data.accentColor || null,
        previewStyle:
          data.previewStyle === undefined
            ? undefined
            : this.normalizePreviewStyle(data.previewStyle),
        creator: data.creatorId
          ? { connect: { id: data.creatorId } }
          : undefined,
        group: nextGroupRelation,
        editedAt: new Date(),
      },
      include: {
        files: {
          orderBy: { createdAt: "asc" },
        },
        creator: true,
      },
    });

    const changedFields = this.describeShareDetailChanges(share, updatedShare);
    if (changedFields.length > 0) {
      await this.recordShareActivity({
        shareId,
        action: "share_updated",
        actor,
        summary: `Updated share "${updatedShare.name || updatedShare.id}"`,
        details: changedFields.join(", "),
      });
    }

    return updatedShare;
  }

  private describeShareDetailChanges(previous: any, next: any) {
    const changed: string[] = [];

    if ((previous.name || "") !== (next.name || ""))
      changed.push("renamed share");
    if ((previous.description || "") !== (next.description || "")) {
      changed.push("updated description");
    }
    if ((previous.accentColor || "") !== (next.accentColor || "")) {
      changed.push("updated theme color");
    }
    if ((previous.previewStyle || "full") !== (next.previewStyle || "full")) {
      changed.push("updated preview style");
    }
    if ((previous.creatorId || "") !== (next.creatorId || "")) {
      changed.push("changed owner");
    }
    if ((previous.groupId || "") !== (next.groupId || "")) {
      changed.push(next.groupId ? "assigned group" : "removed group");
    }

    return changed;
  }

  private normalizePreviewStyle(value?: string | null) {
    return value === "consolidated" ? "consolidated" : "full";
  }

  async isShareCompleted(id: string) {
    return (await this.prisma.share.findUnique({ where: { id } })).uploadLocked;
  }

  async isShareIdAvailable(id: string) {
    const share = await this.prisma.share.findUnique({ where: { id } });
    return { isAvailable: !share };
  }

  getShareSize(share: any) {
    return share.files.reduce(
      (acc: number, file: { size: string }) => acc + parseInt(file.size),
      0,
    );
  }

  async increaseViewCount(share: Share) {
    this.recordEngagement("view", share.id);
    await this.prisma.share.update({
      where: { id: share.id },
      data: { views: share.views + 1 },
    });
  }

  async incrementViewById(shareId: string) {
    this.recordEngagement("view", shareId);
    return await this.prisma.share.update({
      where: { id: shareId },
      data: { views: { increment: 1 } },
    });
  }

  async increaseDownloadCount(shareId: string) {
    this.recordEngagement("download", shareId);
    return await this.prisma.share.update({
      where: { id: shareId },
      data: { downloads: { increment: 1 } },
    });
  }

  private recordEngagement(type: "view" | "download", shareId: string) {
    this.prisma.shareEngagementEvent
      .create({ data: { type, shareId } })
      .catch(() => {
      });
  }

  async getShareToken(shareId: string, password: string) {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      include: {
        security: true,
      },
    });

    if (!share || !share.uploadLocked)
      throw new NotFoundException("Share not found");

    if (
      share.expiration &&
      moment(share.expiration).diff(new Date()) < 0 &&
      !moment(share.expiration).isSame(moment(0))
    )
      throw new NotFoundException("Share expired");

    if (share?.security?.password) {
      if (!password) {
        throw new ForbiddenException(
          "This share is password protected",
          "share_password_required",
        );
      }

      const isPasswordValid = await argon.verify(
        share.security.password,
        password,
      );
      if (!isPasswordValid) {
        throw new ForbiddenException("Wrong password", "wrong_password");
      }
    }

    if (share.security?.maxViews && share.security.maxViews <= share.views) {
      throw new ForbiddenException(
        "Maximum views exceeded",
        "share_max_views_exceeded",
      );
    }

    const token = await this.generateShareToken(shareId);
    await this.increaseViewCount(share);
    return token;
  }

  async generateShareToken(shareId: string) {
    const { expiration, createdAt } = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    const tokenPayload = {
      shareId,
      shareCreatedAt: moment(createdAt).unix(),
      iat: moment().unix(),
    };

    const tokenOptions: JwtSignOptions = {
      secret: this.config.get("internal.jwtSecret"),
    };

    if (!moment(expiration).isSame(0)) {
      tokenOptions.expiresIn = moment(expiration).diff(new Date(), "seconds");
    }

    return this.jwtService.sign(tokenPayload, tokenOptions);
  }

  async verifyShareToken(shareId: string, token: string) {
    const { expiration, createdAt } = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    try {
      const claims = this.jwtService.verify(token, {
        secret: this.config.get("internal.jwtSecret"),
        ignoreExpiration: moment(expiration).isSame(0),
      });

      return (
        claims.shareId == shareId &&
        claims.shareCreatedAt == moment(createdAt).unix()
      );
    } catch {
      return false;
    }
  }

  async getUserById(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        groupMemberships: {
          select: {
            groupId: true,
            role: true,
          },
        },
      },
    });
  }

  async getEffectiveShareLimit(
    user?:
      | (User & {
          groupMembership?: { groupId: string; role: string } | null;
          groupMemberships?: { groupId: string; role: string }[];
          maxFileSizeOverride?: bigint | null;
        })
      | null,
  ) {
    if (!user) {
      return this.configService.get("share.maxAnonymousSize");
    }

    if (this.isLimitedRegisteredUser(user)) {
      return this.configService.get("share.maxUninvitedRegisteredSize");
    }

    let effectiveLimit = this.configService.get("share.maxSize");

    const groupIds = user.groupMemberships?.length
      ? user.groupMemberships.map((membership) => membership.groupId)
      : user.groupMembership?.groupId
        ? [user.groupMembership.groupId]
        : [];

    if (groupIds.length > 0) {
      const groups = await this.prisma.userGroup.findMany({
        where: { id: { in: groupIds } },
        select: { shareSizeLimit: true },
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

    if (user.maxFileSizeOverride) {
      effectiveLimit = Math.max(
        effectiveLimit,
        Number(user.maxFileSizeOverride),
      );
    }

    return effectiveLimit;
  }

  async markZipReady(shareId: string) {
    return await this.prisma.share.update({
      where: { id: shareId },
      data: { isZipReady: true },
    });
  }

  getZipRegenState() {
    return { ...this.zipRegen };
  }

  async startZipRegeneration(): Promise<{
    started: boolean;
    alreadyRunning: boolean;
    total: number;
  }> {
    if (this.zipRegen.running) {
      return { started: false, alreadyRunning: true, total: this.zipRegen.total };
    }

    this.zipRegen = {
      running: true,
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      startedAt: new Date(),
      finishedAt: null,
    };

    let shareIds: string[];
    try {
      const shares = await this.getSharesNeedingZips();
      shareIds = shares.map((s) => s.id);
      this.zipRegen.total = shareIds.length;
    } catch (error) {
      this.zipRegen.running = false;
      this.zipRegen.finishedAt = new Date();
      throw error;
    }

    void this.runZipRegeneration(shareIds).catch((error) =>
      this.logger.error(`[zipRegen] Unexpected failure: ${error?.message || error}`),
    );

    return { started: true, alreadyRunning: false, total: shareIds.length };
  }

  private async runZipRegeneration(shareIds: string[]) {
    this.logger.log(
      `[zipRegen] Starting background zip creation for ${shareIds.length} shares`,
    );
    try {
      for (const id of shareIds) {
        let timer: NodeJS.Timeout | undefined;
        try {
          await Promise.race([
            (async () => {
              await this.createZip(id);
              await this.markZipReady(id);
            })(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("zip creation timed out after 60 min")),
                60 * 60 * 1000,
              );
            }),
          ]);
          this.zipRegen.successful++;
        } catch (error) {
          this.zipRegen.failed++;
          this.logger.error(
            `[zipRegen] Failed for ${id}: ${error?.message || error}`,
          );
        } finally {
          if (timer) clearTimeout(timer);
          this.zipRegen.processed++;
        }
      }
    } finally {
      this.zipRegen.running = false;
      this.zipRegen.finishedAt = new Date();
      this.logger.log(
        `[zipRegen] Complete: ${this.zipRegen.successful} succeeded, ${this.zipRegen.failed} failed`,
      );
    }
  }

  async getSharesNeedingZips(): Promise<
    Array<{
      id: string;
      name: string;
      fileCount: number;
      totalSize: number;
      createdAt: Date;
    }>
  > {
    const shares = await this.prisma.share.findMany({
      where: {
        isZipReady: false,
        uploadLocked: true,
      },
      include: {
        files: {
          select: {
            id: true,
            size: true,
          },
        },
      },
    });

    return shares
      .filter((share) => share.files.length > 1)
      .map((share) => ({
        id: share.id,
        name: share.name,
        fileCount: share.files.length,
        totalSize: share.files.reduce(
          (acc, file) => acc + parseInt(file.size),
          0,
        ),
        createdAt: share.createdAt,
      }))
      .sort((a, b) => b.fileCount - a.fileCount);
  }

  async getZipStatusSummary(): Promise<{
    totalShares: number;
    sharesWithZips: number;
    multiFileShares: number;
    sharesNeedingZips: number;
    percentComplete: number;
  }> {
    const [totalShares, completedShares] = await Promise.all([
      this.prisma.share.count(),
      this.prisma.share.findMany({
        where: { uploadLocked: true },
        include: {
          files: {
            select: { id: true },
          },
        },
      }),
    ]);

    const multiFileShares = completedShares.filter(
      (share) => share.files.length > 1,
    );
    const sharesWithZips = multiFileShares.filter(
      (share) => share.isZipReady,
    ).length;
    const sharesNeedingZips = multiFileShares.filter(
      (share) => !share.isZipReady,
    ).length;

    return {
      totalShares,
      sharesWithZips,
      multiFileShares: multiFileShares.length,
      sharesNeedingZips,
      percentComplete:
        multiFileShares.length > 0
          ? Math.round((sharesWithZips / multiFileShares.length) * 100)
          : 100,
    };
  }
}
