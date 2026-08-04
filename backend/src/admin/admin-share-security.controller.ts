import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { CapabilityGuard } from "src/auth/guard/capability.guard";
import { RequireCapability } from "src/auth/decorator/requireCapability.decorator";
import { ShareService } from "src/share/share.service";
import { CreateRateLimitExemptIpDto } from "./dto/createRateLimitExemptIp.dto";
import { ShareSecurityService } from "./share-security.service";

@Controller("admin/share-security")
export class AdminShareSecurityController {
  constructor(
    private shareSecurityService: ShareSecurityService,
    private shareService: ShareService,
  ) {}

  @Get("summary")
  @RequireCapability("security.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getSummary() {
    return this.shareSecurityService.getSummary();
  }

  @Get("rate-limit-exemptions")
  @RequireCapability("security.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async listRateLimitExemptIps() {
    return this.shareSecurityService.listRateLimitExemptIps();
  }

  @Post("rate-limit-exemptions")
  @RequireCapability("security.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async createRateLimitExemptIp(@Body() dto: CreateRateLimitExemptIpDto) {
    return this.shareSecurityService.createRateLimitExemptIp(dto);
  }

  @Delete("rate-limit-exemptions/:id")
  @RequireCapability("security.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async deleteRateLimitExemptIp(@Param("id") id: string) {
    return this.shareSecurityService.deleteRateLimitExemptIp(id);
  }

  @Get("scan-queue")
  @RequireCapability("security.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getScanQueue() {
    return this.shareService.getVirusScanAdminStatus();
  }

  @Post("restart-scans")
  @RequireCapability("security.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async restartScans(
    @Body("includeFailed") includeFailed?: boolean,
    @Body("includeStale") includeStale?: boolean,
    @Body("includeNotScanned") includeNotScanned?: boolean,
  ) {
    return this.shareService.restartVirusScans({
      includeFailed: includeFailed !== false,
      includeStale: includeStale !== false,
      includeNotScanned: includeNotScanned === true,
    });
  }

  @Get("events")
  @RequireCapability("security.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getEvents(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("outcome") outcome?: string,
    @Query("ip") ip?: string,
    @Query("shareId") shareId?: string,
  ) {
    return this.shareSecurityService.listEvents({
      page,
      limit,
      outcome,
      ip,
      shareId,
    });
  }

  @Get("recoverable-shares")
  @RequireCapability("security.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getRecoverableShares() {
    return this.shareSecurityService.listRecoverableShares();
  }

  @Post("recoverable-shares/:shareId/relock")
  @RequireCapability("security.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async relockRecoverableShare(@Param("shareId") shareId: string) {
    return this.shareService.relockAfterEditFailure(shareId);
  }
}
