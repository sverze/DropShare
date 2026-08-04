import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { JwtGuard } from "../auth/guard/jwt.guard";
import { CapabilityGuard } from "../auth/guard/capability.guard";
import { RequireCapability } from "../auth/decorator/requireCapability.decorator";
import { GetUser } from "../auth/decorator/getUser.decorator";
import { hasCapability } from "../auth/capabilities";
import { ConfigService } from "../config/config.service";
import { EmailService } from "../email/email.service";
import { EmailTemplatesService } from "./email-templates.service";

@Controller("email-templates")
export class EmailTemplatesController {
  constructor(
    private emailTemplatesService: EmailTemplatesService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  @Post("broadcast/preview")
  @RequireCapability("emails.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async previewBroadcast(
    @Body()
    body: {
      subject?: string;
      headline?: string;
      subheadline?: string;
      bodyHtml?: string;
      ctaUrl?: string;
      ctaText?: string;
    },
  ) {
    return this.emailTemplatesService.renderBroadcastPreview(body || {});
  }

  @Post(":slug/preview")
  @RequireCapability("emails.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async previewTemplate(
    @Param("slug") slug: string,
    @Body() body: { htmlBody?: string; subject?: string; editable?: boolean },
  ) {
    return this.emailService.renderPreview(slug, {
      htmlBody: body?.htmlBody,
      subject: body?.subject,
      editable: body?.editable === true,
    });
  }

  private canSeeAuthLogs(user: User) {
    return hasCapability(
      user,
      "users.view",
      this.config.get("access.managerCapabilities"),
    );
  }

  @Get()
  @RequireCapability("emails.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getAllTemplates() {
    return this.emailTemplatesService.getAllTemplates();
  }

  @Get("logs/all")
  @RequireCapability("emails.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getEmailLogs(
    @GetUser() user: User,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query("search") search?: string,
  ) {
    return this.emailTemplatesService.getEmailLogs({
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      status,
      type,
      search,
      includeAuthTypes: this.canSeeAuthLogs(user),
    });
  }

  @Get("stats/summary")
  @RequireCapability("emails.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getEmailStats(@GetUser() user: User) {
    const includeAuthTypes = this.canSeeAuthLogs(user);
    const [sent, failed, total] = await Promise.all([
      this.emailTemplatesService.getEmailLogs({
        status: "sent",
        limit: 1,
        includeAuthTypes,
      }),
      this.emailTemplatesService.getEmailLogs({
        status: "failed",
        limit: 1,
        includeAuthTypes,
      }),
      this.emailTemplatesService.getEmailLogs({ limit: 1, includeAuthTypes }),
    ]);

    return {
      totalSent: sent.total,
      totalFailed: failed.total,
      total: total.total,
    };
  }

  @Get("brand/:brand")
  @RequireCapability("emails.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getTemplatesByBrand(@Param("brand") brand: string) {
    return this.emailTemplatesService.getTemplatesByBrand(brand);
  }

  @Get(":slug")
  @RequireCapability("emails.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getTemplate(@Param("slug") slug: string) {
    return this.emailTemplatesService.getTemplate(slug);
  }

  @Patch(":id")
  @RequireCapability("emails.edit")
  @UseGuards(JwtGuard, CapabilityGuard)
  async updateTemplate(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      variables?: string[];
      isActive?: boolean;
    },
  ) {
    return this.emailTemplatesService.updateTemplate(id, body);
  }

  @Post()
  @RequireCapability("emails.edit")
  @UseGuards(JwtGuard, CapabilityGuard)
  async createTemplate(
    @Body()
    body: {
      slug: string;
      name: string;
      description?: string;
      brand: string;
      subject: string;
      htmlBody: string;
      textBody?: string;
      variables?: string[];
    },
  ) {
    return this.emailTemplatesService.createTemplate(body);
  }

  @Delete(":id")
  @RequireCapability("emails.edit")
  @UseGuards(JwtGuard, CapabilityGuard)
  async deleteTemplate(@Param("id") id: string) {
    await this.emailTemplatesService.deleteTemplate(id);
    return { success: true };
  }

  @Post(":slug/test")
  @RequireCapability("emails.send")
  @UseGuards(JwtGuard, CapabilityGuard)
  async sendTestEmail(
    @Param("slug") slug: string,
    @Body() body: { email: string },
  ) {
    return this.emailTemplatesService.sendTestEmail(slug, body.email);
  }

  @Post("broadcast")
  @RequireCapability("emails.send")
  @UseGuards(JwtGuard, CapabilityGuard)
  async sendBroadcast(
    @Body()
    body: {
      subject: string;
      brand: string;
      headline: string;
      subheadline: string;
      bodyHtml: string;
      ctaUrl?: string;
      ctaText?: string;
      recipientIds?: string[];
    },
  ) {
    return this.emailTemplatesService.sendBroadcast(body);
  }
}
