import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { Response } from "express";
import { GetUser } from "../auth/decorator/getUser.decorator";
import { JwtGuard } from "../auth/guard/jwt.guard";
import {
  BULK_ZIP_LIMIT_BYTES,
  BULK_ZIP_LIMIT_SHARES,
  ExportService,
} from "./export.service";

@Controller("export")
@UseGuards(JwtGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  private targetUserId(user: User, forUser?: string): string {
    if (forUser !== undefined && typeof forUser !== "string") {
      throw new BadRequestException("forUser must be a single value.");
    }
    if (!forUser || forUser === user.id) return user.id;
    if (!user.isAdmin) {
      throw new ForbiddenException(
        "Only admins can view another user's export.",
      );
    }
    return forUser;
  }

  @Get("shares")
  async listShares(
    @GetUser() user: User,
    @Query("forUser") forUser?: string,
  ) {
    const shares = await this.exportService.listShares(
      this.targetUserId(user, forUser),
    );
    return {
      bulkLimitBytes: BULK_ZIP_LIMIT_BYTES,
      bulkLimitShares: BULK_ZIP_LIMIT_SHARES,
      totalShares: shares.length,
      totalBytes: shares.reduce((sum, s) => sum + s.size, 0),
      shares,
    };
  }

  @Get("batches")
  async listBatches(
    @GetUser() user: User,
    @Query("forUser") forUser?: string,
  ) {
    return this.exportService.listBatches(this.targetUserId(user, forUser));
  }

  @Get("batches/:index/zip")
  async downloadBatch(
    @GetUser() user: User,
    @Param("index", ParseIntPipe) index: number,
    @Res() res: Response,
    @Query("forUser") forUser?: string,
  ) {
    await this.exportService.streamBatchZip(
      this.targetUserId(user, forUser),
      index,
      res,
    );
  }

  @Get("shares/:id/zip")
  async downloadShare(
    @GetUser() user: User,
    @Param("id") id: string,
    @Res() res: Response,
    @Query("forUser") forUser?: string,
  ) {
    await this.exportService.streamShareZip(
      this.targetUserId(user, forUser),
      id,
      res,
    );
  }

  @Post("bulk-zip")
  async downloadBulk(
    @GetUser() user: User,
    @Body() body: { shareIds?: string[] },
    @Res() res: Response,
    @Query("forUser") forUser?: string,
  ) {
    await this.exportService.streamBulkZip(
      this.targetUserId(user, forUser),
      body?.shareIds ?? [],
      res,
    );
  }
}
