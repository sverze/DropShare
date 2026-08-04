import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { CapabilityGuard } from "src/auth/guard/capability.guard";
import { RequireCapability } from "src/auth/decorator/requireCapability.decorator";
import { FileService } from "src/file/file.service";

@Controller("admin/previews")
@RequireCapability("previews.manage")
@UseGuards(JwtGuard, CapabilityGuard)
export class AdminPreviewController {
  constructor(private fileService: FileService) {}

  @Get("status")
  async getStatus() {
    return this.fileService.getPreviewAdminStatus();
  }

  @Post("enqueue")
  async enqueue(
    @Body("type") type?: "video" | "audio" | "all",
    @Body("includeReady") includeReady?: boolean,
    @Body("includeFailed") includeFailed?: boolean,
    @Body("shareId") shareId?: string,
  ) {
    return this.fileService.enqueuePreviewWork({
      type: type || "all",
      includeReady: includeReady === true,
      includeFailed: includeFailed !== false,
      shareId: shareId?.trim() || undefined,
    });
  }
}
