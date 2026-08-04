import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LocalFileService } from "./local.service";
import { Readable } from "stream";
import { PrismaService } from "../prisma/prisma.service";
import { User } from "@prisma/client";

type ZipResult =
  | { redirectUrl: string; fileName: string }
  | { stream: Readable; fileName: string };

@Injectable()
export class FileService {
  constructor(
    private prisma: PrismaService,
    private localFileService: LocalFileService,
  ) {}

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
    return this.localFileService.create(data, chunk, file, shareId);
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
    return this.localFileService.getUploadUrl(shareId, file);
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
    return this.localFileService.confirmDirectUpload(shareId, file);
  }

  async get(
    shareId: string,
    fileId: string,
    forceDownload = false,
  ): Promise<File> {
    return this.localFileService.get(shareId, fileId, forceDownload);
  }

  async getScanStream(shareId: string, fileId: string): Promise<Readable> {
    return this.localFileService.getScanStream(shareId, fileId);
  }

  async getMetadata(shareId: string, fileId: string) {
    return this.localFileService.getMetadata(shareId, fileId);
  }

  private extractAudioOriginalCreateDate(metadata: any): string | null {
    const candidates: Array<any> = [
      metadata?.common?.date,
      metadata?.common?.originaldate,
      metadata?.common?.creationdate,
      metadata?.common?.year,
    ];

    let bextOriginationDate: unknown = null;
    let bextOriginationTime: unknown = null;

    for (const nativeGroup of Object.values(metadata?.native || {})) {
      if (!Array.isArray(nativeGroup)) continue;

      for (const tag of nativeGroup) {
        const id = String(tag?.id || "").toLowerCase();

        if (id.includes("bext.originationdate")) {
          bextOriginationDate = tag?.value;
        }

        if (id.includes("bext.originationtime")) {
          bextOriginationTime = tag?.value;
        }

        if (
          id.includes("date_time_original") ||
          id.includes("create_date") ||
          id.includes("creation_time") ||
          id.includes("creationdate") ||
          id.includes("creation_date") ||
          id.includes("quicktime.creationdate") ||
          id === "©day"
        ) {
          candidates.push(tag?.value);
        }
      }
    }

    if (bextOriginationDate || bextOriginationTime) {
      candidates.unshift(
        [bextOriginationDate, bextOriginationTime]
          .filter(Boolean)
          .join(" ")
          .trim(),
      );
    }

    for (const candidate of candidates) {
      const normalized = this.normalizeAudioDate(candidate);
      if (normalized) return normalized;
    }

    return null;
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

  async getSpectrum(shareId: string, fileId: string): Promise<Readable> {
    return this.localFileService.getSpectrum(shareId, fileId);
  }

  async getThumbnail(
    shareId: string,
    fileId: string,
    size: "thumb" | "preview" = "thumb",
  ): Promise<Readable> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    const extension = (file?.name || "").toLowerCase().split(".").pop() || "";
    const videoExtensions = new Set([
      "mp4", "m4v", "mov", "qt", "webm", "mkv", "avi", "ogv", "3gp", "3g2",
      "mts", "m2ts",
    ]);

    if (videoExtensions.has(extension)) {
      return this.localFileService.getVideoThumbnail(shareId, fileId);
    }
    return this.localFileService.getImageOrPdfThumbnail(shareId, fileId, size);
  }

  async getVideoThumbnail(shareId: string, fileId: string): Promise<Readable> {
    return this.localFileService.getVideoThumbnail(shareId, fileId);
  }

  async getVideoPreviewStatus(shareId: string, fileId: string) {
    return this.localFileService.getVideoPreviewStatus(shareId, fileId);
  }

  async getPreviewAdminStatus() {
    return this.localFileService.getPreviewAdminStatus();
  }

  async enqueuePreviewWork(options: {
    type?: "video" | "audio" | "all";
    includeReady?: boolean;
    includeFailed?: boolean;
    shareId?: string;
  }) {
    return this.localFileService.enqueuePreviewWork(options);
  }

  async getVideoPreviewObject(
    shareId: string,
    fileId: string,
    objectPath: string,
  ) {
    return this.localFileService.getVideoPreviewObject(
      shareId,
      fileId,
      objectPath,
    );
  }

  async remove(shareId: string, fileId: string) {
    return this.localFileService.remove(shareId, fileId);
  }

  async deleteAllFiles(shareId: string) {
    return this.localFileService.deleteAllFiles(shareId);
  }

  async updateMetadata(
    shareId: string,
    fileId: string,
    data: {
      name?: string;
      order?: number;
      previewGroup?: boolean;
      previewHeader?: string;
      lyricsText?: string;
      lyricsSource?: string;
      lyricsSourceUrl?: string;
      lyricsSyncEnabled?: boolean;
      lyricsSyncedAt?: string;
    },
    actor?: User | null,
  ) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, shareId },
    });

    if (!file) {
      throw new NotFoundException("File not found");
    }

    const nextName = data.name?.trim();
    const nextOrder =
      typeof data.order === "number" && Number.isFinite(data.order)
        ? Math.max(0, Math.trunc(data.order))
        : undefined;
    const nextLyricsText =
      typeof data.lyricsText === "string" ? data.lyricsText.trim() : undefined;
    const nextPreviewHeader =
      typeof data.previewHeader === "string"
        ? data.previewHeader.trim()
        : undefined;
    const nextLyricsSource =
      typeof data.lyricsSource === "string"
        ? data.lyricsSource.trim()
        : undefined;
    const nextLyricsSourceUrl =
      typeof data.lyricsSourceUrl === "string"
        ? data.lyricsSourceUrl.trim()
        : undefined;
    const nextLyricsSyncedAt =
      typeof data.lyricsSyncedAt === "string" && data.lyricsSyncedAt.trim()
        ? new Date(data.lyricsSyncedAt)
        : undefined;

    if (
      !nextName &&
      nextOrder === undefined &&
      data.previewGroup === undefined &&
      nextPreviewHeader === undefined &&
      nextLyricsText === undefined &&
      nextLyricsSource === undefined &&
      nextLyricsSourceUrl === undefined &&
      data.lyricsSyncEnabled === undefined
    ) {
      throw new BadRequestException("Nothing to update");
    }

    const updateData: {
      name?: string;
      relativePath?: string | null;
      order?: number;
      previewGroup?: boolean;
      previewHeader?: string | null;
      lyricsText?: string | null;
      lyricsSource?: string | null;
      lyricsSourceUrl?: string | null;
      lyricsSyncEnabled?: boolean;
      lyricsSyncedAt?: Date | null;
      lyricsSyncStatus?: string;
      lyricsSyncError?: string | null;
    } = {};

    if (nextName) {
      updateData.name = nextName;
      updateData.relativePath = file.relativePath
        ? this.replaceRelativePathLeaf(file.relativePath, nextName)
        : null;
    }

    if (nextOrder !== undefined) {
      updateData.order = nextOrder;
    }

    if (data.previewGroup !== undefined) {
      updateData.previewGroup = data.previewGroup;
    }

    if (nextPreviewHeader !== undefined) {
      updateData.previewHeader = nextPreviewHeader || null;
    }

    if (nextLyricsText !== undefined) {
      updateData.lyricsText = nextLyricsText || null;
      updateData.lyricsSource = nextLyricsText
        ? nextLyricsSource || "manual"
        : null;
      updateData.lyricsSourceUrl =
        nextLyricsText && nextLyricsSourceUrl ? nextLyricsSourceUrl : null;
      if (nextLyricsText && nextLyricsSource?.startsWith("genius-")) {
        updateData.lyricsSyncEnabled = data.lyricsSyncEnabled === true;
        updateData.lyricsSyncedAt = updateData.lyricsSyncEnabled
          ? nextLyricsSyncedAt && Number.isFinite(nextLyricsSyncedAt.getTime())
            ? nextLyricsSyncedAt
            : new Date()
          : file.lyricsSyncedAt;
        updateData.lyricsSyncStatus = updateData.lyricsSyncEnabled
          ? "synced"
          : "edited";
        updateData.lyricsSyncError = null;
      } else {
        updateData.lyricsSyncEnabled = false;
        updateData.lyricsSyncedAt = null;
        updateData.lyricsSyncStatus = nextLyricsText ? "manual" : "not_synced";
        updateData.lyricsSyncError = null;
      }
    } else {
      if (nextLyricsSource !== undefined) {
        updateData.lyricsSource = nextLyricsSource || null;
      }

      if (nextLyricsSourceUrl !== undefined) {
        updateData.lyricsSourceUrl = nextLyricsSourceUrl || null;
      }

      if (data.lyricsSyncEnabled !== undefined) {
        updateData.lyricsSyncEnabled = data.lyricsSyncEnabled;
      }

      if (nextLyricsSyncedAt && Number.isFinite(nextLyricsSyncedAt.getTime())) {
        updateData.lyricsSyncedAt = nextLyricsSyncedAt;
      }
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: updateData,
    });

    const changedFields = this.getFileMetadataChangedFields(file, updatedFile);
    if (changedFields.length > 0) {
      await this.recordShareActivity({
        shareId,
        action: "file_updated",
        actor,
        summary: `Updated file "${updatedFile.name}"`,
        details: changedFields.join(", "),
      });
    }

    return updatedFile;
  }

  private getFileMetadataChangedFields(previous: any, next: any) {
    const changed: string[] = [];

    if (previous.name !== next.name) changed.push("renamed file");
    if ((previous.order ?? 0) !== (next.order ?? 0))
      changed.push("changed order");
    if ((previous.previewGroup ?? true) !== (next.previewGroup ?? true)) {
      changed.push(next.previewGroup ? "grouped preview" : "ungrouped preview");
    }
    if ((previous.previewHeader || "") !== (next.previewHeader || "")) {
      changed.push("updated preview header");
    }
    if ((previous.lyricsText || "") !== (next.lyricsText || "")) {
      changed.push(next.lyricsText ? "updated lyrics" : "removed lyrics");
    }
    if ((previous.lyricsSource || "") !== (next.lyricsSource || "")) {
      changed.push("updated lyrics source");
    }
    if ((previous.lyricsSourceUrl || "") !== (next.lyricsSourceUrl || "")) {
      changed.push("updated lyrics source URL");
    }
    if ((previous.lyricsSyncEnabled ?? false) !== (next.lyricsSyncEnabled ?? false)) {
      changed.push(
        next.lyricsSyncEnabled
          ? "enabled Genius lyrics sync"
          : "disabled Genius lyrics sync",
      );
    }
    if (
      (previous.lyricsSyncedAt?.toISOString?.() || "") !==
      (next.lyricsSyncedAt?.toISOString?.() || "")
    ) {
      changed.push("updated lyrics sync time");
    }

    return changed;
  }

  private async recordShareActivity({
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
    actor?: User | null;
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
        actorUsername: actor?.username || actor?.email || null,
      },
    });
  }

  async getZip(shareId: string): Promise<ZipResult> {
    return this.localFileService.getZip(shareId);
  }

  async getZipContents(shareId: string, fileId: string) {
    return this.localFileService.getZipContents(shareId, fileId);
  }

  async getStorageReconciliationReport(options?: {
    maxObjects?: number;
    limit?: number;
  }) {
    return this.localFileService.getStorageReconciliationReport(options);
  }

  async downloadArchiveSelection(
    shareId: string,
    fileId: string,
    selectedPaths: string[],
  ) {
    return this.localFileService.downloadArchiveSelection(
      shareId,
      fileId,
      selectedPaths,
    );
  }

  private async streamToUint8Array(stream: Readable): Promise<Uint8Array> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
      stream.on("error", reject);
    });
  }

  private replaceRelativePathLeaf(relativePath: string, fileName: string) {
    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length === 0) {
      return fileName;
    }

    parts[parts.length - 1] = fileName;
    return parts.join("/");
  }
}

export interface File {
  metaData: {
    id: string;
    size: string;
    createdAt: Date;
    mimeType: string | false;
    name: string;
    shareId: string;
    relativePath?: string | null;
  };
  file?: Readable;
  redirectUrl?: string;
}
