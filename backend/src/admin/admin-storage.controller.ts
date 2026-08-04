import { Controller, Delete, Get, Query, UseGuards } from "@nestjs/common";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { CapabilityGuard } from "src/auth/guard/capability.guard";
import { RequireCapability } from "src/auth/decorator/requireCapability.decorator";
import { FileService } from "src/file/file.service";
import { R2StorageService } from "src/r2-storage/r2-storage.service";

@Controller("admin/storage")
@UseGuards(JwtGuard, CapabilityGuard)
export class AdminStorageController {
  constructor(
    private fileService: FileService,
    private r2StorageService: R2StorageService,
  ) {}

  @Get("reconciliation")
  @RequireCapability("storage.view")
  async getReconciliationReport(
    @Query("maxObjects") maxObjects?: string,
    @Query("limit") limit?: string,
  ) {
    return this.fileService.getStorageReconciliationReport({
      maxObjects: this.parseOptionalPositiveInt(maxObjects),
      limit: this.parseOptionalPositiveInt(limit),
    });
  }

  @Get("breakdown")
  @RequireCapability("storage.view")
  async getStorageBreakdown() {
    return this.r2StorageService.getStorageBreakdown();
  }

  @Get("health")
  @RequireCapability("storage.view")
  async getStorageHealth(): Promise<Record<string, unknown>> {
    return {
      ...this.r2StorageService.getStorageHealth(),
      sourceCache: await this.r2StorageService.getSourceCacheStats(),
    };
  }

  @Delete("source-cache")
  @RequireCapability("storage.clear")
  async clearSourceCache() {
    return this.r2StorageService.clearSourceCache();
  }

  private parseOptionalPositiveInt(value?: string) {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
}
