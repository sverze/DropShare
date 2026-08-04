import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtGuard } from "../auth/guard/jwt.guard";
import { CapabilityGuard } from "../auth/guard/capability.guard";
import { RequireCapability } from "../auth/decorator/requireCapability.decorator";
import { ShareService } from "./share.service";

@Controller("api/admin/zip-progress")
@RequireCapability("shares.zip")
@UseGuards(JwtGuard, CapabilityGuard)
export class ZipProgressController {
  constructor(private shareService: ShareService) {}

  @Get(":shareId")
  async getProgress(@Param("shareId") shareId: string) {
    const progress = this.shareService.getZipProgress(shareId);
    if (!progress) {
      return { active: false };
    }
    return {
      active: true,
      ...progress,
    };
  }

  @Get()
  async getAllProgress() {
    const allProgress = this.shareService.getAllZipProgress();
    return {
      count: allProgress.length,
      progress: allProgress,
    };
  }
}
