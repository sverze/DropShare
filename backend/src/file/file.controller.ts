import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import * as contentDisposition from "content-disposition";
import { Request, Response } from "express";
import { Readable } from "stream";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { ShareOwnerGuard } from "src/share/guard/shareOwner.guard";
import { ShareService } from "src/share/share.service";
import { UpdateFileDTO } from "./dto/updateFile.dto";
import { FileService } from "./file.service";
import { FileSecurityGuard } from "./guard/fileSecurity.guard";
import * as mime from "mime-types";
import { User } from "@prisma/client";

@Controller("shares/:shareId/files")
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(
    private fileService: FileService,
    private shareService: ShareService,
  ) {}

  @Post("track-view")
  @Throttle({
    default: {
      limit: 60,
      ttl: 60,
    },
  })
  async trackView(@Param("shareId") shareId: string) {
    try {
      const updated = await this.shareService.incrementViewById(shareId);
      return {
        success: true,
        views: updated.views,
        downloads: updated.downloads,
      };
    } catch (e) {
      this.logger.error(`Failed to track view for share ${shareId}`, e);
      return { success: false };
    }
  }

  @Post("track-download")
  @Throttle({
    default: {
      limit: 60,
      ttl: 60,
    },
  })
  async trackDownload(@Param("shareId") shareId: string) {
    try {
      const updated = await this.shareService.increaseDownloadCount(shareId);
      return {
        success: true,
        views: updated.views,
        downloads: updated.downloads,
      };
    } catch (e) {
      this.logger.error(`Failed to track download for share ${shareId}`, e);
      return { success: false };
    }
  }

  @Post("upload-url")
  @Throttle({
    default: {
      limit: 3000,
      ttl: 60,
    },
  })
  @UseGuards(ShareOwnerGuard)
  async getUploadUrl(
    @Query()
    query: {
      id: string;
      name: string;
      size: string;
      relativePath?: string;
      order?: string;
      previewGroup?: string;
      previewHeader?: string;
    },
    @Param("shareId") shareId: string,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    await this.shareService.assertCanAddFilesToShare(
      shareId,
      user,
      request.cookies?.[`share_${shareId}_owner_token`],
    );
    const { id, name, size, relativePath, order, previewGroup, previewHeader } =
      query;
    return await this.fileService.getUploadUrl(shareId, {
      id,
      name,
      size: this.parseNonNegativeInt(size, "size"),
      relativePath: this.validateRelativePath(relativePath),
      order: this.parseOptionalNonNegativeInt(order, "order"),
      previewGroup: this.parseOptionalBoolean(previewGroup, "previewGroup"),
      previewHeader: this.validatePreviewHeader(previewHeader),
    });
  }

  @Post("confirm-upload")
  @Throttle({
    default: {
      limit: 3000,
      ttl: 60,
    },
  })
  @UseGuards(ShareOwnerGuard)
  async confirmUpload(
    @Query()
    query: {
      id: string;
      name: string;
      size: string;
      relativePath?: string;
      order?: string;
      previewGroup?: string;
      previewHeader?: string;
    },
    @Param("shareId") shareId: string,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    await this.shareService.assertCanAddFilesToShare(
      shareId,
      user,
      request.cookies?.[`share_${shareId}_owner_token`],
    );
    const { id, name, size, relativePath, order, previewGroup, previewHeader } =
      query;
    const confirmedFile = await this.fileService.confirmDirectUpload(shareId, {
      id,
      name,
      size: this.parseNonNegativeInt(size, "size"),
      relativePath: this.validateRelativePath(relativePath),
      order: this.parseOptionalNonNegativeInt(order, "order"),
      previewGroup: this.parseOptionalBoolean(previewGroup, "previewGroup"),
      previewHeader: this.validatePreviewHeader(previewHeader),
    });

    await this.shareService.recordShareActivity({
      shareId,
      action: "file_added",
      actor: user,
      summary: `Added file "${name}"`,
      details: `Size ${size} bytes`,
    });

    return confirmedFile;
  }

  @Post()
  @SkipThrottle()
  @UseGuards(ShareOwnerGuard)
  async create(
    @Query()
    query: {
      id: string;
      name: string;
      chunkIndex: string;
      totalChunks: string;
      relativePath?: string;
      order?: string;
      previewGroup?: string;
      previewHeader?: string;
    },
    @Body() body: string,
    @Param("shareId") shareId: string,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    await this.shareService.assertCanAddFilesToShare(
      shareId,
      user,
      request.cookies?.[`share_${shareId}_owner_token`],
    );
    const {
      id,
      name,
      chunkIndex,
      totalChunks,
      relativePath,
      order,
      previewGroup,
      previewHeader,
    } = query;

    const createdFile = await this.fileService.create(
      body,
      {
        index: this.parseNonNegativeInt(chunkIndex, "chunkIndex"),
        total: this.parsePositiveInt(totalChunks, "totalChunks"),
      },
      {
        id,
        name,
        relativePath: this.validateRelativePath(relativePath),
        order: this.parseOptionalNonNegativeInt(order, "order"),
        previewGroup: this.parseOptionalBoolean(previewGroup, "previewGroup"),
        previewHeader: this.validatePreviewHeader(previewHeader),
      },
      shareId,
    );

    if (
      this.parseNonNegativeInt(chunkIndex, "chunkIndex") ===
      this.parsePositiveInt(totalChunks, "totalChunks") - 1
    ) {
      await this.shareService.recordShareActivity({
        shareId,
        action: "file_added",
        actor: user,
        summary: `Added file "${name}"`,
      });
    }

    return createdFile;
  }

  private parsePositiveInt(value: string, name: string) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`${name} must be a positive integer`);
    }

    return parsed;
  }

  private parseNonNegativeInt(value: string, name: string) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`${name} must be a non-negative integer`);
    }

    return parsed;
  }

  private parseOptionalNonNegativeInt(value: string | undefined, name: string) {
    if (value === undefined) return undefined;
    return this.parseNonNegativeInt(value, name);
  }

  private parseOptionalBoolean(value: string | undefined, name: string) {
    if (value === undefined) return undefined;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new BadRequestException(`${name} must be true or false`);
  }

  private validateRelativePath(relativePath?: string) {
    if (!relativePath) return null;

    const pathParts = relativePath.split(/[\\/]+/);

    if (
      relativePath.startsWith("/") ||
      relativePath.startsWith("\\") ||
      pathParts.some((part) => part === "..")
    ) {
      throw new BadRequestException("Invalid relativePath");
    }

    return relativePath;
  }

  private validatePreviewHeader(previewHeader?: string) {
    if (previewHeader === undefined) return undefined;
    const trimmed = previewHeader.trim();
    if (trimmed.length > 160) {
      throw new BadRequestException(
        "previewHeader must be 160 characters or fewer",
      );
    }
    return trimmed || null;
  }

  @Get("zip")
  @UseGuards(FileSecurityGuard)
  async getZip(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
  ) {
    await this.shareService.assertZipDownloadAllowed(shareId);

    const result = await this.fileService.getZip(shareId);

    await this.shareService.increaseDownloadCount(shareId);

    if ("redirectUrl" in result && result.redirectUrl) {
      res.redirect(result.redirectUrl as string);
      return;
    }

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(result.fileName),
    });

    if (!("stream" in result)) {
      throw new BadRequestException("Zip stream unavailable");
    }

    return new StreamableFile(result.stream);
  }

  @Get(":fileId/virus-scan")
  @UseGuards(FileSecurityGuard)
  async getFileVirusScanStatus(
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
  ) {
    return this.shareService.getFileVirusScanStatus(shareId, fileId);
  }

  @Post(":fileId/virus-scan")
  @UseGuards(FileSecurityGuard)
  async startFileVirusScan(
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
  ) {
    return this.shareService.startFileVirusScan(shareId, fileId);
  }

  @Get(":fileId/video-preview")
  @UseGuards(FileSecurityGuard)
  async getVideoPreviewStatus(
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
  ) {
    return this.fileService.getVideoPreviewStatus(shareId, fileId);
  }

  @Get(":fileId/hls/master.m3u8")
  @UseGuards(FileSecurityGuard)
  async getVideoPreviewMasterPlaylist(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
  ) {
    const result = await this.fileService.getVideoPreviewObject(
      shareId,
      fileId,
      "master.m3u8",
    );

    res.set({
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=300",
    });

    return new StreamableFile(result.stream);
  }

  @Get(":fileId/hls/:variant/index.m3u8")
  @UseGuards(FileSecurityGuard)
  async getVideoPreviewVariantPlaylist(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
    @Param("variant") variant: string,
  ) {
    const result = await this.fileService.getVideoPreviewObject(
      shareId,
      fileId,
      `${variant}/index.m3u8`,
    );

    res.set({
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=300",
    });

    return new StreamableFile(result.stream);
  }

  @Get(":fileId/hls/:variant/:segment")
  @UseGuards(FileSecurityGuard)
  async getVideoPreviewSegment(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
    @Param("variant") variant: string,
    @Param("segment") segment: string,
  ) {
    const result = await this.fileService.getVideoPreviewObject(
      shareId,
      fileId,
      `${variant}/${segment}`,
    );

    res.set({
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=86400",
    });

    return new StreamableFile(result.stream);
  }

  @Get(":fileId")
  @UseGuards(FileSecurityGuard)
  async getFile(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
    @Query("download") download = "true",
  ) {
    const forceDownload = download === "true";

    if (forceDownload) {
      await this.shareService.assertFileDownloadAllowed(shareId, fileId);
    }

    const file = await this.fileService.get(shareId, fileId, forceDownload);

    if (forceDownload) {
      await this.shareService.increaseDownloadCount(shareId);
    }

    if (file.redirectUrl) {
      if (forceDownload) {
        res.setHeader(
          "Content-Disposition",
          contentDisposition(file.metaData.name),
        );
      } else {
        res.setHeader("Cache-Control", "private, no-store, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.removeHeader("Content-Disposition");
        res.setHeader(
          "Content-Disposition",
          contentDisposition(file.metaData.name, {
            type: "inline",
          }),
        );
      }
      res.redirect(file.redirectUrl);
      return;
    }

    const headers: Record<string, string | number> = {
      "Content-Type":
        mime?.lookup?.(file.metaData.name) || "application/octet-stream",
      "Content-Length": file.metaData.size,
      "Content-Security-Policy": "sandbox",
    };

    if (forceDownload) {
      headers["Content-Disposition"] = contentDisposition(file.metaData.name);
    } else {
      headers["Content-Disposition"] = contentDisposition(file.metaData.name, {
        type: "inline",
      });
      headers["Cache-Control"] = "private, no-store, max-age=0";
      headers["Pragma"] = "no-cache";
    }

    res.set(headers);

    return new StreamableFile(file.file as Readable);
  }

  @Get(":fileId/metadata")
  @UseGuards(FileSecurityGuard)
  async getFileMetadata(
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
  ) {
    return this.fileService.getMetadata(shareId, fileId);
  }

  @Get(":fileId/spectrum")
  @UseGuards(FileSecurityGuard)
  async getFileSpectrum(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
  ) {
    const spectrumStream = await this.fileService.getSpectrum(shareId, fileId);

    res.set({
      "Content-Type": "image/png",
      "Content-Disposition": contentDisposition(`${fileId}_spectrum.png`, {
        type: "inline",
      }),
      "Cache-Control": "public, max-age=86400",
    });

    return new StreamableFile(spectrumStream);
  }

  @Get(":fileId/thumbnail")
  @UseGuards(FileSecurityGuard)
  async getFileThumbnail(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
    @Query("size") size?: string,
  ) {
    const thumbnailStream = await this.fileService.getThumbnail(
      shareId,
      fileId,
      size === "preview" ? "preview" : "thumb",
    );

    res.set({
      "Content-Type": "image/jpeg",
      "Content-Disposition": contentDisposition(`${fileId}_thumb.jpg`, {
        type: "inline",
      }),
      "Cache-Control": "public, max-age=86400",
    });

    return new StreamableFile(thumbnailStream);
  }

  @Get(":fileId/zip-contents")
  @UseGuards(FileSecurityGuard)
  async getZipContents(
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
  ) {
    return this.fileService.getZipContents(shareId, fileId);
  }

  @Post(":fileId/archive-download")
  @UseGuards(FileSecurityGuard)
  async downloadArchiveSelection(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
    @Body() body: { paths?: string[] },
  ) {
    const result = await this.fileService.downloadArchiveSelection(
      shareId,
      fileId,
      body?.paths || [],
    );

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(result.fileName),
      "Cache-Control": "no-store",
    });

    return new StreamableFile(result.stream);
  }

  @Delete(":fileId")
  @SkipThrottle()
  @UseGuards(ShareOwnerGuard)
  async remove(
    @Param("fileId") fileId: string,
    @Param("shareId") shareId: string,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    await this.shareService.assertCanRemoveFilesFromShare(
      shareId,
      user,
      request.cookies?.[`share_${shareId}_owner_token`],
    );
    const removedFile = await this.fileService.remove(shareId, fileId);
    await this.shareService.recordShareActivity({
      shareId,
      action: "file_removed",
      actor: user,
      summary: `Removed file "${removedFile?.name || fileId}"`,
    });
  }

  @Patch(":fileId")
  @SkipThrottle()
  @UseGuards(ShareOwnerGuard)
  async update(
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
    @Body() body: UpdateFileDTO,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    await this.shareService.assertCanEditShareFileOrder(
      shareId,
      user,
      request.cookies?.[`share_${shareId}_owner_token`],
    );
    return this.fileService.updateMetadata(shareId, fileId, body, user);
  }
}
