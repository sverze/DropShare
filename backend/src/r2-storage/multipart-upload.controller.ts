import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Logger,
  HttpException,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { FileService } from "src/file/file.service";
import { ShareService } from "src/share/share.service";
import { R2StorageService } from "./r2-storage.service";
import type { User } from "@prisma/client";

interface InitMultipartDto {
  shareId: string;
  fileId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  relativePath?: string | null;
  order?: number;
  previewGroup?: boolean;
  previewHeader?: string | null;
}

interface GetPartUrlsDto {
  key: string;
  uploadId: string;
  partNumbers: number[];
}

interface CompleteMultipartDto {
  key: string;
  uploadId: string;
  parts: Array<{ PartNumber: number; ETag: string }>;
}

interface AbortMultipartDto {
  key: string;
  uploadId: string;
}

@Controller("storage/multipart")
export class MultipartUploadController {
  private readonly logger = new Logger(MultipartUploadController.name);

  constructor(
    private readonly storageService: R2StorageService,
    private readonly shareService: ShareService,
    private readonly fileService: FileService,
  ) {}

  @Post("init")
  @Throttle({
    default: {
      limit: 3000,
      ttl: 60,
    },
  })
  async initMultipartUpload(
    @Body() dto: InitMultipartDto,
    @Req() request: Request,
  ) {
    try {
      const {
        shareId,
        fileId,
        fileName,
        contentType,
        fileSize,
        relativePath,
        order,
        previewGroup,
        previewHeader,
      } = dto;
      this.assertValidMultipartInit(dto);

      const user = await this.shareService.resolveUserFromAccessToken(
        request.cookies?.access_token,
      );
      const ownerToken = request.cookies?.[`share_${shareId}_owner_token`];
      await this.shareService.assertCanAddFilesToShare(
        shareId,
        user,
        ownerToken,
      );

      if (!this.storageService.canUseMultipart(fileSize)) {
        throw new HttpException(
          `File size ${fileSize} is too small for multipart upload. Use regular upload.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const key = this.storageService.getFileKey(shareId, fileId);

      this.logger.log(
        `Initiating multipart upload: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
      );

      const result = await this.storageService.createMultipartUpload(
        key,
        contentType,
        fileSize,
      );

      multipartAuthStore.set(result.uploadId, {
        key: result.key,
        shareId,
        fileId,
        fileName,
        fileSize,
        relativePath,
        order,
        previewGroup,
        previewHeader: previewHeader?.trim() || null,
        userId: user?.id,
        actor: user
          ? {
              id: user.id,
              username: user.username,
              email: user.email,
            }
          : null,
        ownerToken,
        expires: Date.now() + 60 * 60 * 1000,
      });

      return {
        success: true,
        uploadId: result.uploadId,
        key: result.key,
        partSize: result.partSize,
        totalParts: result.totalParts,
        threshold: this.storageService.getMultipartThreshold(),
      };
    } catch (error) {
      this.logger.error(`Failed to init multipart upload: ${error.message}`);
      throw new HttpException(
        error.message || "Failed to initialize multipart upload",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("part-urls")
  @Throttle({
    default: {
      limit: 3000,
      ttl: 60,
    },
  })
  async getPartUrls(@Body() dto: GetPartUrlsDto, @Req() request: Request) {
    try {
      const { key, uploadId, partNumbers } = dto;
      await this.assertAuthorizedShareMultipartRequest(request, key, uploadId);

      if (!partNumbers || partNumbers.length === 0) {
        throw new HttpException(
          "partNumbers array is required",
          HttpStatus.BAD_REQUEST,
        );
      }

      if (partNumbers.length > 10000) {
        throw new HttpException(
          "Maximum 10000 part URLs per request",
          HttpStatus.BAD_REQUEST,
        );
      }

      for (const partNumber of partNumbers) {
        if (!Number.isInteger(partNumber) || partNumber <= 0) {
          throw new HttpException(
            "partNumbers must contain positive integers",
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      this.logger.log(`Getting ${partNumbers.length} part URLs for: ${key}`);

      const urls = await this.storageService.getMultiplePartSignedUrls(
        key,
        uploadId,
        partNumbers,
        3600,
      );

      return {
        success: true,
        urls,
      };
    } catch (error) {
      this.logger.error(`Failed to get part URLs: ${error.message}`);
      throw new HttpException(
        error.message || "Failed to get part URLs",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("complete")
  @Throttle({
    default: {
      limit: 3000,
      ttl: 60,
    },
  })
  async completeMultipartUpload(
    @Body() dto: CompleteMultipartDto,
    @Req() request: Request,
  ) {
    try {
      const { key, uploadId, parts } = dto;
      await this.assertAuthorizedShareMultipartRequest(request, key, uploadId);
      const tracked = multipartAuthStore.get(uploadId);

      if (!parts || parts.length === 0) {
        throw new HttpException(
          "parts array is required",
          HttpStatus.BAD_REQUEST,
        );
      }

      for (const part of parts) {
        if (
          !Number.isInteger(part.PartNumber) ||
          part.PartNumber <= 0 ||
          typeof part.ETag !== "string" ||
          part.ETag.length === 0
        ) {
          throw new HttpException(
            "Invalid multipart completion payload",
            HttpStatus.BAD_REQUEST,
          );
        }
      }


      this.logger.log(
        `Completing multipart upload: ${key} with ${parts.length} parts`,
      );

      await this.storageService.completeMultipartUpload(key, uploadId, parts);

      if (tracked) {
        await this.fileService.confirmDirectUpload(tracked.shareId, {
          id: tracked.fileId,
          name: tracked.fileName,
          size: tracked.fileSize,
          relativePath: tracked.relativePath,
          order: tracked.order,
          previewGroup: tracked.previewGroup,
          previewHeader: tracked.previewHeader,
        });

        await this.shareService.recordShareActivity({
          shareId: tracked.shareId,
          action: "file_added",
          actor: tracked.actor,
          summary: `Added file "${tracked.fileName}"`,
          details: `Size ${tracked.fileSize} bytes`,
        });
      }

      multipartAuthStore.delete(uploadId);

      return {
        success: true,
        message: "Multipart upload completed successfully",
        key,
      };
    } catch (error) {
      this.logger.error(
        `Failed to complete multipart upload: ${error.message}`,
      );
      throw new HttpException(
        error.message || "Failed to complete multipart upload",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("abort")
  @Throttle({
    default: {
      limit: 3000,
      ttl: 60,
    },
  })
  async abortMultipartUpload(
    @Body() dto: AbortMultipartDto,
    @Req() request: Request,
  ) {
    try {
      const { key, uploadId } = dto;
      await this.assertAuthorizedShareMultipartRequest(request, key, uploadId);

      this.logger.log(`Aborting multipart upload: ${key}`);

      await this.storageService.abortMultipartUpload(key, uploadId);
      multipartAuthStore.delete(uploadId);

      return {
        success: true,
        message: "Multipart upload aborted",
        key,
      };
    } catch (error) {
      this.logger.error(`Failed to abort multipart upload: ${error.message}`);
      return {
        success: false,
        message: "Failed to abort multipart upload",
        key: dto.key,
      };
    }
  }

  @Post("config")
  async getMultipartConfig() {
    return {
      enabled: this.storageService.isEnabled(),
      threshold: this.storageService.getMultipartThreshold(),
      partSize: this.storageService.getPartSize(),
      maxPartsPerRequest: 10000,
    };
  }

  private assertValidMultipartInit(dto: InitMultipartDto) {
    if (
      !dto.shareId ||
      !dto.fileId ||
      !dto.fileName ||
      !dto.contentType ||
      !Number.isFinite(dto.fileSize) ||
      dto.fileSize <= 0 ||
      (dto.order !== undefined &&
        (!Number.isFinite(dto.order) || dto.order < 0)) ||
      (dto.previewGroup !== undefined &&
        typeof dto.previewGroup !== "boolean") ||
      (dto.previewHeader !== undefined &&
        (typeof dto.previewHeader !== "string" ||
          dto.previewHeader.length > 160))
    ) {
      throw new BadRequestException("Invalid multipart init payload");
    }
  }

  private async assertAuthorizedShareMultipartRequest(
    request: Request,
    key: string,
    uploadId: string,
  ) {
    if (!key?.startsWith("shares/")) {
      return;
    }

    const tracked = multipartAuthStore.get(uploadId);
    if (!tracked || tracked.key !== key || tracked.expires < Date.now()) {
      multipartAuthStore.delete(uploadId);
      throw new HttpException(
        "Multipart upload session is invalid or expired",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const currentOwnerToken =
      request.cookies?.[`share_${tracked.shareId}_owner_token`];
    const currentUser = await this.shareService.resolveUserFromAccessToken(
      request.cookies?.access_token,
    );

    const ownerTokenMatches =
      tracked.ownerToken &&
      currentOwnerToken &&
      tracked.ownerToken === currentOwnerToken;
    const accessTokenMatches =
      tracked.userId && currentUser && tracked.userId === currentUser.id;

    if (!ownerTokenMatches && !accessTokenMatches) {
      throw new HttpException(
        "Not allowed to use this multipart upload session",
        HttpStatus.FORBIDDEN,
      );
    }
  }
}

const multipartAuthStore = new Map<
  string,
  {
    key: string;
    shareId: string;
    fileId: string;
    fileName: string;
    fileSize: number;
    relativePath?: string | null;
    order?: number;
    previewGroup?: boolean;
    previewHeader?: string | null;
    userId?: string;
    actor?: Pick<User, "id" | "username" | "email"> | null;
    ownerToken?: string;
    expires: number;
  }
>();

setInterval(() => {
  const now = Date.now();
  for (const [uploadId, value] of multipartAuthStore.entries()) {
    if (value.expires < now) {
      multipartAuthStore.delete(uploadId);
    }
  }
}, 60_000);
