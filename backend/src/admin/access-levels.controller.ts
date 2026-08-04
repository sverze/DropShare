import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { AccessLevelsService } from "./access-levels.service";

@Controller("admin/access-levels")
@UseGuards(JwtGuard, AdministratorGuard)
export class AccessLevelsController {
  constructor(private readonly accessLevels: AccessLevelsService) {}

  @Get()
  get() {
    return this.accessLevels.getSettings();
  }

  @Patch()
  update(@Body() body: { capabilities?: Record<string, boolean> }) {
    return this.accessLevels.updateCapabilities(body?.capabilities ?? {});
  }
}
