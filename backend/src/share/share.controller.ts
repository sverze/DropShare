import {
  Body,
  Controller,
  Logger,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { User } from "@prisma/client";
import { Request, Response } from "express";
import * as moment from "moment";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { CapabilityGuard } from "src/auth/guard/capability.guard";
import { RequireCapability } from "src/auth/decorator/requireCapability.decorator";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { ConfigService } from "src/config/config.service";
import { AdminShareDTO } from "./dto/adminShare.dto";
import {
  BulkAssignGroupDTO,
  BulkShareActionDTO,
} from "./dto/bulkShareAction.dto";
import { CreateShareDTO } from "./dto/createShare.dto";
import { MyShareDTO } from "./dto/myShare.dto";
import { MyShareDashboardDTO } from "./dto/myShareDashboard.dto";
import { ShareDTO } from "./dto/share.dto";
import { ShareMetaDataDTO } from "./dto/shareMetaData.dto";
import { SharePasswordDto } from "./dto/sharePassword.dto";
import { CreateShareGuard } from "./guard/createShare.guard";
import { ShareOwnerGuard } from "./guard/shareOwner.guard";
import { ShareSecurityGuard } from "./guard/shareSecurity.guard";
import { ShareTokenSecurity } from "./guard/shareTokenSecurity.guard";
import { ShareService } from "./share.service";
import { CompletedShareDTO } from "./dto/shareComplete.dto";
import { UpdateShareDTO } from "./dto/updateShare.dto";

@Controller("shares")
export class ShareController {
  private readonly logger = new Logger(ShareController.name);

  constructor(
    private shareService: ShareService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  @Get("limit")
  async getShareLimit(@Req() request: Request) {
    const resolved = await this.shareService.resolveUserFromAccessToken(
      request.cookies?.access_token,
    );
    const user = resolved
      ? await this.shareService.getUserById(resolved.id)
      : null;

    return {
      maxShareSize: await this.shareService.getEffectiveShareLimit(user as any),
    };
  }

  @Get("all")
  @RequireCapability("shares.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getAllShares(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("userId") userId?: string,
    @Query("groupId") groupId?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDir") sortDir?: string,
  ) {
    const result = await this.shareService.getAllSharesDashboard({
      page,
      limit,
      search,
      userId,
      groupId,
      sortBy,
      sortDir,
    });
    return {
      shares: new AdminShareDTO().fromList(result.shares),
      pagination: result.pagination,
    };
  }

  @Post("admin/bulk-delete")
  @RequireCapability("shares.delete")
  @UseGuards(JwtGuard, CapabilityGuard)
  async bulkDeleteShares(
    @GetUser() user: User,
    @Body() body: BulkShareActionDTO,
  ) {
    return this.shareService.bulkDeleteShares(user, body);
  }

  @Post("admin/bulk-assign-group")
  @RequireCapability("shares.edit")
  @UseGuards(JwtGuard, CapabilityGuard)
  async bulkAssignGroup(
    @GetUser() user: User,
    @Body() body: BulkAssignGroupDTO,
  ) {
    return this.shareService.bulkAssignGroupShares(user, body);
  }

  @Get()
  @UseGuards(JwtGuard)
  async getMyShares(
    @GetUser() user: User,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
  ) {
    const dashboard = await this.shareService.getMySharesDashboard(user, {
      page,
      limit,
      search,
    });

    return new MyShareDashboardDTO().from({
      ...dashboard,
      shares: new MyShareDTO().fromList(dashboard.shares as any),
    });
  }

  @Get("group/all")
  @UseGuards(JwtGuard)
  async getGroupShares(
    @GetUser() user: User,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("groupId") groupId?: string,
  ) {
    const dashboard = await this.shareService.getGroupSharesDashboard(user, {
      page,
      limit,
      search,
      groupId,
    });

    return new MyShareDashboardDTO().from({
      ...dashboard,
      shares: new MyShareDTO().fromList(dashboard.shares as any),
    });
  }

  @Get(":id")
  @UseGuards(ShareSecurityGuard)
  async get(@Param("id") id: string) {
    return new ShareDTO().from(await this.shareService.get(id));
  }

  @Get(":id/virus-scan")
  @UseGuards(ShareSecurityGuard)
  async getVirusScanStatus(@Param("id") id: string) {
    return this.shareService.getVirusScanStatus(id);
  }

  @Post(":id/virus-scan")
  @HttpCode(202)
  @Throttle({
    default: {
      limit: 6,
      ttl: 15 * 60,
    },
  })
  @UseGuards(ShareSecurityGuard)
  async startVirusScan(@Param("id") id: string) {
    return this.shareService.startVirusScan(id);
  }

  @Get(":id/from-owner")
  @UseGuards(ShareOwnerGuard)
  async getFromOwner(
    @Param("id") id: string,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    const anonymousOwnerToken = request.cookies?.[`share_${id}_owner_token`];
    return new ShareDTO().from(
      await this.shareService.getForOwner(id, user, anonymousOwnerToken),
    );
  }

  @Get(":id/metaData")
  async getMetaData(@Param("id") id: string) {
    return new ShareMetaDataDTO().from(await this.shareService.getMetaData(id));
  }

  @Post()
  @Throttle({
    default: {
      limit: 30,
      ttl: 15 * 60,
    },
  })
  @UseGuards(CreateShareGuard)
  async create(
    @Body() body: CreateShareDTO,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @GetUser() user: User,
  ) {
    const { reverse_share_token } = request.cookies;
    const share = await this.shareService.create(body, user, reverse_share_token);

    if (!user && !share.creatorId) {
      response.cookie(
        `share_${share.id}_owner_token`,
        this.shareService.generateAnonymousOwnerToken(share.id),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: this.configService.get("general.secureCookies"),
          path: "/",
          maxAge: 1000 * 60 * 60 * 24 * 30,
        },
      );
    }

    return new ShareDTO().from(share);
  }

  @Post(":id/complete")
  @HttpCode(202)
  @UseGuards(CreateShareGuard, ShareOwnerGuard)
  async complete(@Param("id") id: string, @Req() request: Request) {
    const { reverse_share_token } = request.cookies;
    return new CompletedShareDTO().from(
      await this.shareService.complete(id, reverse_share_token),
    );
  }

  @Delete(":id/complete")
  @UseGuards(ShareOwnerGuard)
  async revertComplete(@Param("id") id: string) {
    return new ShareDTO().from(await this.shareService.revertComplete(id));
  }

  @Post(":id/relock")
  @UseGuards(ShareOwnerGuard)
  async relockAfterEditFailure(@Param("id") id: string) {
    return new ShareDTO().from(await this.shareService.relockAfterEditFailure(id));
  }

  @Delete(":id")
  @UseGuards(ShareOwnerGuard)
  async remove(
    @Param("id") id: string,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    const anonymousOwnerToken = request.cookies?.[`share_${id}_owner_token`];
    await this.shareService.assertCanDeleteShare(id, user, anonymousOwnerToken);
    const isDeleterAdmin = user?.isAdmin === true;
    await this.shareService.remove(id, isDeleterAdmin);
  }

  @Patch(":id")
  @UseGuards(ShareOwnerGuard)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateShareDTO,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    const anonymousOwnerToken = request.cookies?.[`share_${id}_owner_token`];
    return new ShareDTO().from(
      (await this.shareService.update(id, body, user, anonymousOwnerToken)) as any,
    );
  }

  @Throttle({
    default: {
      limit: 10,
      ttl: 60,
    },
  })
  @Header("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate")
  @Header("Pragma", "no-cache")
  @Get("isShareIdAvailable/:id")
  async isShareIdAvailable(@Param("id") id: string) {
    return this.shareService.isShareIdAvailable(id);
  }

  @HttpCode(200)
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @UseGuards(ShareTokenSecurity)
  @Post(":id/token")
  async getShareToken(
    @Param("id") id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: SharePasswordDto,
  ) {
    const token = await this.shareService.getShareToken(id, body.password);

    this.clearShareTokenCookies(request, response);
    response.cookie(`share_${id}_token`, token, {
      path: "/",
      httpOnly: true,
    });

    return { token };
  }

  private clearShareTokenCookies(request: Request, response: Response) {
    const shareTokenCookies = Object.entries(request.cookies)
      .filter(([key]) => key.startsWith("share_") && key.endsWith("_token"))
      .map(([key, value]) => ({
        key,
        payload: this.jwtService.decode(value),
      }));

    const expiredTokens = shareTokenCookies.filter(
      (cookie) => cookie.payload.exp < moment().unix(),
    );
    const validTokens = shareTokenCookies.filter(
      (cookie) => cookie.payload.exp >= moment().unix(),
    );

    expiredTokens.forEach((cookie) => response.clearCookie(cookie.key));

    if (validTokens.length > 10) {
      validTokens
        .sort((a, b) => a.payload.exp - b.payload.exp)
        .slice(0, -10)
        .forEach((cookie) => response.clearCookie(cookie.key));
    }
  }

  @Post('admin/regenerate-zips')
  @RequireCapability("shares.zip")
  @UseGuards(JwtGuard, CapabilityGuard)
  async regenerateZips() {
    try {
      const result = await this.shareService.startZipRegeneration();

      if (result.alreadyRunning) {
        return {
          success: true,
          alreadyRunning: true,
          total: result.total,
          message: `Zip regeneration is already running (${result.total} shares). Progress updates below.`,
        };
      }

      return {
        success: true,
        started: true,
        total: result.total,
        message:
          result.total === 0
            ? "No shares need zips."
            : `Started background zip creation for ${result.total} share${
                result.total === 1 ? "" : "s"
              }. This runs in the background - the list updates as each finishes.`,
      };
    } catch (error) {
      this.logger.error(`Zip regeneration scan failed: ${error.message}`);
      throw new Error('Failed to scan and regenerate zips');
    }
  }

  @Get('admin/zip-status')
  @RequireCapability("shares.zip")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getZipStatus() {
    try {
      const summary = await this.shareService.getZipStatusSummary();
      const sharesNeedingZips = await this.shareService.getSharesNeedingZips();

      return {
        summary,
        regen: this.shareService.getZipRegenState(),
        sharesNeedingZips: sharesNeedingZips.map(share => ({
          id: share.id,
          name: share.name,
          fileCount: share.fileCount,
          sizeMB: (share.totalSize / 1024 / 1024).toFixed(2),
          createdAt: share.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get zip status: ${error.message}`);
      throw new Error('Failed to get zip status');
    }
  }

  @Post('admin/:shareId/regenerate-zip')
  @RequireCapability("shares.zip")
  @UseGuards(JwtGuard, CapabilityGuard)
  async regenerateSingleZip(@Param('shareId') shareId: string) {
    try {
      const share = await this.shareService.get(shareId);

      if (!share) {
        throw new Error('Share not found');
      }

      const fileCount = share.files?.length || 0;
      const totalSize = share.files?.reduce((acc, file) => acc + parseInt(file.size || '0'), 0) || 0;

      if (fileCount <= 1) {
        throw new Error('Share must have more than 1 file for zip creation');
      }

      await this.shareService.createZip(shareId);
      
      await this.shareService.markZipReady(shareId);

      return {
        success: true,
        message: `Triggered zip creation for share ${shareId}`,
        share: {
          id: share.id,
          name: share.name,
          fileCount: fileCount,
          sizeMB: (totalSize / 1024 / 1024).toFixed(2),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to regenerate zip for ${shareId}: ${error.message}`);
      throw error;
    }
  }
}
