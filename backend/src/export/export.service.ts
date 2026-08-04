import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Response } from "express";
import * as archiver from "archiver";
import { createReadStream } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { SHARE_DIRECTORY } from "../constants";
import { Readable } from "stream";
import { PrismaService } from "../prisma/prisma.service";
import { R2StorageService } from "../r2-storage/r2-storage.service";
import { ConfigService } from "../config/config.service";

export const BULK_ZIP_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

export const BULK_ZIP_LIMIT_SHARES = 500;

const FILE_SELECT = {
  id: true,
  name: true,
  size: true,
  order: true,
  previewHeader: true,
  relativePath: true,
  lyricsText: true,
  lyricsSource: true,
  lyricsSourceUrl: true,
  storageLocation: true,
} as const;

type ExportFile = {
  id: string;
  name: string;
  size: string;
  order: number;
  previewHeader: string | null;
  relativePath: string | null;
  lyricsText: string | null;
  lyricsSource: string | null;
  lyricsSourceUrl: string | null;
  storageLocation: string;
};

type ExportShare = {
  id: string;
  name: string | null;
  description: string | null;
  createdAt: Date;
  files: ExportFile[];
};

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: R2StorageService,
    private readonly config: ConfigService,
  ) {}

  private appName(): string {
    return this.config.get("general.appName") || "This site";
  }

  private bytesOf(files: { size: string }[]): number {
    return files.reduce((sum, f) => {
      const n = Number(f.size);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  private humanSize(bytes: number): string {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} bytes`;
  }

  private safeName(input: string | null | undefined, fallback: string): string {
    const cleaned = (input ?? "")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    return cleaned || fallback;
  }

  private displayName(share: {
    name: string | null;
    files: { name: string }[];
  }): string {
    const named = share.name?.trim();
    if (named) return named;

    const first = share.files[0]?.name?.trim();
    if (!first) return "Untitled share";

    return share.files.length > 1 ? `${first} + more` : first;
  }

  private unique(used: Set<string>, name: string): string {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const ext = path.extname(name);
    const base = name.slice(0, name.length - ext.length);
    let n = 2;
    let candidate = `${base} (${n})${ext}`;
    while (used.has(candidate)) {
      n += 1;
      candidate = `${base} (${n})${ext}`;
    }
    used.add(candidate);
    return candidate;
  }

  async listShares(userId: string) {
    const shares = await this.prisma.share.findMany({
      where: { creatorId: userId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        expiration: true,
        files: {
          select: { name: true, size: true },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return shares.map((s) => {
      const size = this.bytesOf(s.files);
      return {
        id: s.id,
        name: s.name,
        displayName: this.displayName(s),
        description: s.description,
        createdAt: s.createdAt,
        fileCount: s.files.length,
        size,
        sizeLabel: this.humanSize(size),
      };
    });
  }

  private async computeBatches(userId: string) {
    const shares = await this.prisma.share.findMany({
      where: { creatorId: userId },
      select: { id: true, files: { select: { size: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const batches: { shareIds: string[]; bytes: number }[] = [];
    let current: { shareIds: string[]; bytes: number } | null = null;

    for (const share of shares) {
      const bytes = this.bytesOf(share.files);
      const fits =
        current !== null &&
        current.shareIds.length < BULK_ZIP_LIMIT_SHARES &&
        current.bytes + bytes <= BULK_ZIP_LIMIT_BYTES;

      if (fits) {
        current.shareIds.push(share.id);
        current.bytes += bytes;
      } else {
        current = { shareIds: [share.id], bytes };
        batches.push(current);
      }
    }

    return batches;
  }

  async listBatches(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    if (!user) throw new NotFoundException("User not found.");

    const batches = await this.computeBatches(userId);
    const totalBytes = batches.reduce((sum, b) => sum + b.bytes, 0);

    return {
      userId: user.id,
      username: user.username,
      totalBytes,
      totalSizeLabel: this.humanSize(totalBytes),
      batches: batches.map((b, i) => ({
        index: i + 1,
        shareCount: b.shareIds.length,
        bytes: b.bytes,
        sizeLabel: this.humanSize(b.bytes),
      })),
    };
  }

  async streamBatchZip(userId: string, batchIndex: number, res: Response) {
    const batches = await this.computeBatches(userId);
    const batch = batches[batchIndex - 1];
    if (!batch) {
      throw new NotFoundException("That download part does not exist.");
    }

    const all = await this.prisma.share.findMany({
      where: { creatorId: userId },
      select: {
        id: true,
        name: true,
        files: { select: { name: true }, orderBy: { order: "asc" } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const usedNames = new Set<string>();
    const folderById = new Map<string, string>();
    for (const s of all) {
      folderById.set(
        s.id,
        this.unique(
          usedNames,
          this.safeName(this.displayName(s), `share-${s.id.slice(0, 8)}`),
        ),
      );
    }

    const shares = await this.getOwnedShares(userId, batch.shareIds);
    const byId = new Map(shares.map((s) => [s.id, s]));
    const ordered = batch.shareIds.map((id) => byId.get(id)) as ExportShare[];

    await this.streamSharesAsZip(
      ordered,
      res,
      `dropshare-part-${batchIndex}-of-${batches.length}.zip`,
      (share) => folderById.get(share.id) ?? `share-${share.id.slice(0, 8)}`,
    );
  }

  private async getOwnedShares(
    userId: string,
    shareIds: string[],
  ): Promise<ExportShare[]> {
    const shares = await this.prisma.share.findMany({
      where: { id: { in: shareIds }, creatorId: userId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        files: { select: FILE_SELECT, orderBy: { order: "asc" } },
      },
    });

    if (shares.length !== shareIds.length) {
      const found = new Set(shares.map((s) => s.id));
      const missing = shareIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Share not found or not yours: ${missing.slice(0, 3).join(", ")}`,
      );
    }

    return shares as ExportShare[];
  }

  private async getFileStream(
    shareId: string,
    file: ExportFile,
  ): Promise<Readable> {
    if (file.storageLocation === "s3" && this.r2Storage.isEnabled()) {
      return this.r2Storage.getStream(this.r2Storage.getFileKey(shareId, file.id));
    }

    const diskPath = `${SHARE_DIRECTORY}/${shareId}/${file.id}`;
    await fs.access(diskPath);
    return createReadStream(diskPath);
  }

  buildInfoText(share: ExportShare): string {
    const totalBytes = this.bytesOf(share.files);
    const L: string[] = [];

    L.push(`${this.appName()} export`);
    L.push("================");
    L.push("");
    L.push(`Title:       ${this.displayName(share)}`);
    L.push(`Share ID:    ${share.id}`);
    L.push(`Created:     ${share.createdAt.toISOString()}`);
    L.push(`Files:       ${share.files.length}`);
    L.push(`Total size:  ${this.humanSize(totalBytes)}`);
    L.push("");
    L.push("Description");
    L.push("-----------");
    L.push(share.description?.trim() || "(none)");
    L.push("");

    const sections = new Map<string, ExportFile[]>();
    for (const f of share.files) {
      const key = f.previewHeader?.trim() || "";
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key).push(f);
    }

    L.push("Contents");
    L.push("--------");
    let index = 0;
    for (const [section, files] of sections) {
      if (section) {
        L.push("");
        L.push(`[ ${section} ]`);
      }
      for (const f of files) {
        index += 1;
        const size = this.humanSize(Number(f.size) || 0);
        const location = f.relativePath ? `  (${f.relativePath})` : "";
        L.push(`${String(index).padStart(3, " ")}. ${f.name}  -  ${size}${location}`);
      }
    }

    const withLyrics = share.files.filter((f) => f.lyricsText?.trim());
    if (withLyrics.length) {
      L.push("");
      L.push("");
      L.push("Lyrics");
      L.push("------");
      for (const f of withLyrics) {
        L.push("");
        L.push(`### ${f.name}`);
        if (f.lyricsSource || f.lyricsSourceUrl) {
          L.push(
            `Source: ${[f.lyricsSource, f.lyricsSourceUrl].filter(Boolean).join(" - ")}`,
          );
        }
        L.push("");
        L.push(f.lyricsText.trim());
      }
    }

    L.push("");
    L.push("");
    L.push(`Exported from ${this.appName()}.`);
    L.push("");
    return L.join("\n");
  }

  private setZipHeaders(res: Response, filename: string) {
    const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
    const encoded = encodeURIComponent(filename);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
    );
  }

  private newArchive(res: Response) {
    const archive = archiver("zip", { zlib: { level: 0 } });

    archive.on("warning", (err) => {
      this.logger.warn(`archive warning: ${err.message}`);
    });
    archive.on("error", (err) => {
      this.logger.error(`archive error: ${err.message}`);
      res.destroy(err);
    });
    res.on("close", () => archive.destroy());

    archive.pipe(res);
    return archive;
  }

  private waitForEntry(
    archive: archiver.Archiver,
    res: Response,
    name: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        archive.off("entry", onEntry);
        archive.off("error", onError);
        res.off("close", onClose);
      };
      const onEntry = (entry: archiver.EntryData) => {
        if (entry.name === name) {
          cleanup();
          resolve();
        }
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onClose = () => {
        cleanup();
        reject(new Error("client disconnected"));
      };
      archive.on("entry", onEntry);
      archive.once("error", onError);
      res.once("close", onClose);
    });
  }

  private async appendShare(
    archive: archiver.Archiver,
    res: Response,
    share: ExportShare,
    prefix = "",
  ) {
    const used = new Set<string>();

    for (const file of share.files) {
      const entryName = this.unique(used, this.safeName(file.name, file.id));

      let stream: Readable;
      try {
        stream = await this.getFileStream(share.id, file);
      } catch (e) {
        this.logger.error(
          `export: missing object for share ${share.id} file ${file.id}: ${e.message}`,
        );
        archive.append(
          `This file could not be retrieved from storage at export time.\nFile: ${file.name}\nID: ${file.id}\n`,
          { name: `${prefix}${entryName}.MISSING.txt` },
        );
        continue;
      }

      const written = this.waitForEntry(archive, res, `${prefix}${entryName}`);
      archive.append(stream, { name: `${prefix}${entryName}` });
      await written;
    }

    archive.append(this.buildInfoText(share), { name: `${prefix}info.txt` });
  }

  async streamShareZip(userId: string, shareId: string, res: Response) {
    const [share] = await this.getOwnedShares(userId, [shareId]);
    const base = this.safeName(
      this.displayName(share),
      `share-${share.id.slice(0, 8)}`,
    );

    this.setZipHeaders(res, `${base}.zip`);
    const archive = this.newArchive(res);
    await this.appendShare(archive, res, share);
    await archive.finalize();
  }

  async streamBulkZip(userId: string, shareIds: string[], res: Response) {
    if (!Array.isArray(shareIds) || shareIds.length === 0) {
      throw new BadRequestException("Select at least one share.");
    }
    if (shareIds.length > BULK_ZIP_LIMIT_SHARES) {
      throw new BadRequestException(
        `One download is limited to ${BULK_ZIP_LIMIT_SHARES} shares. Select fewer and try again.`,
      );
    }

    const shares = await this.getOwnedShares(userId, shareIds);

    const total = shares.reduce((sum, s) => sum + this.bytesOf(s.files), 0);
    if (total > BULK_ZIP_LIMIT_BYTES) {
      throw new BadRequestException(
        `That selection is ${this.humanSize(total)}, over the ${this.humanSize(
          BULK_ZIP_LIMIT_BYTES,
        )} limit for one download. Select fewer shares.`,
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    await this.streamSharesAsZip(shares, res, `dropshare-export-${stamp}.zip`);
  }

  private async streamSharesAsZip(
    shares: ExportShare[],
    res: Response,
    filename: string,
    folderOf?: (share: ExportShare) => string,
  ) {
    this.setZipHeaders(res, filename);
    const archive = this.newArchive(res);
    const usedFolders = new Set<string>();

    for (const share of shares) {
      const folder = folderOf
        ? folderOf(share)
        : this.unique(
            usedFolders,
            this.safeName(
              this.displayName(share),
              `share-${share.id.slice(0, 8)}`,
            ),
          );
      await this.appendShare(archive, res, share, `${folder}/`);
    }

    await archive.finalize();
  }
}
