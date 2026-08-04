import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SkipThrottle } from "@nestjs/throttler";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { CapabilityGuard } from "src/auth/guard/capability.guard";
import { ConfigCategoryGuard } from "src/auth/guard/configCategory.guard";
import { RequireCapability } from "src/auth/decorator/requireCapability.decorator";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { EmailService } from "src/email/email.service";
import { ConfigService } from "./config.service";
import { AdminConfigDTO } from "./dto/adminConfig.dto";
import { ConfigDTO } from "./dto/config.dto";
import { TestEmailDTO } from "./dto/testEmail.dto";
import UpdateConfigDTO from "./dto/updateConfig.dto";
import { LogoService } from "./logo.service";

@Controller("configs")
export class ConfigController {
  constructor(
    private configService: ConfigService,
    private logoService: LogoService,
    private emailService: EmailService,
  ) {}

  @Get()
  @SkipThrottle()
  async list() {
    return new ConfigDTO().fromList(await this.configService.list());
  }

  @Get("admin/:category")
  @UseGuards(JwtGuard, ConfigCategoryGuard)
  async getByCategory(@Param("category") category: string) {
    return new AdminConfigDTO().fromList(
      await this.configService.getByCategory(category),
    );
  }

  @Patch("admin")
  @UseGuards(JwtGuard, ConfigCategoryGuard)
  async updateMany(@Body() data: UpdateConfigDTO[]) {
    return new AdminConfigDTO().fromList(
      await this.configService.updateMany(data),
    );
  }

  @Post("admin/testEmail")
  @UseGuards(JwtGuard, AdministratorGuard)
  async testEmail(@Body() { email }: TestEmailDTO) {
    await this.emailService.sendTestMail(email);
  }

  @Post("admin/logo")
  @UseInterceptors(FileInterceptor("file"))
  @RequireCapability("config.general")
  @UseGuards(JwtGuard, CapabilityGuard)
  async uploadLogo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(png|jpeg|jpg|webp|svg\+xml)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return await this.logoService.create(file.buffer);
  }
}
