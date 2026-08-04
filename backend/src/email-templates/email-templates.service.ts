import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import {
  renderSections,
  sectionPresence,
  stripSectionMarkers,
} from "../email/template-sections";
import * as nodemailer from "nodemailer";
import {
  resolveEmailTheme,
  splitBrandName,
  tintTowardsWhite,
} from "../email/email-theme";
import {
  AUTH_URL,
  DROPSHARE_URL,
  buildPublicUrl,
} from "../utils/public-url.util";

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyVars(
  input: string | undefined,
  vars: Record<string, string>,
  escape: boolean,
): string {
  if (!input) return input ?? "";
  const lookup = new Map(
    Object.entries(vars).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return input.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match, name: string) => {
      const key = name.toLowerCase();
      if (!lookup.has(key)) return match;
      const value = String(lookup.get(key) ?? "");
      return escape ? escapeHtml(value) : value;
    },
  );
}

function formatBroadcastBody(input: string): string {
  const body = (input ?? "").trim();
  if (!body) return "";
  if (/<(p|div|table|ul|ol|h[1-6]|br|blockquote)\b/i.test(body)) return body;
  return body.replace(/\r\n|\r|\n/g, "<br />");
}

const SHIPPED_BRAND = {
  color: "#00ff5a",
  colorDark: "#00cc48",
  bgGradientStart: "#f0fdf4",
  bgGradientEnd: "#f8fafc",
  footerGradientStart: "#f8fff8",
  footerGradientEnd: "#f0fdf4",
  glowColor: "0, 255, 90",
  buttonTextColor: "#000000",
};

const BRAND_CONFIG = {
  dropshare: {
    ...SHIPPED_BRAND,
    name: "DropShare",
    logo: buildPublicUrl(DROPSHARE_URL, "/img/logo.png"),
    url: DROPSHARE_URL,
    borderOpacity: "0.4",
  },
};

const BRAND_URLS: Record<string, string> = {
  dropshare: DROPSHARE_URL,
};

export interface SendEmailOptions {
  to: string;
  templateSlug?: string;
  subject?: string;
  variables?: Record<string, string>;
  customHtml?: string;
  customText?: string;
  userId?: string;
  type?: string;
}

export interface EmailTemplateData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
}

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    try {
      const smtpEnabled = await this.config.get("smtp.enabled");
      if (!smtpEnabled) {
        this.logger.warn("SMTP is not enabled");
        return;
      }

      const host = await this.config.get("smtp.host");
      const port = await this.config.get("smtp.port");
      const username = await this.config.get("smtp.username");
      const password = await this.config.get("smtp.password");

      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: parseInt(port) === 465,
        auth: {
          user: username,
          pass: password,
        },
      });

      this.logger.log("Email transporter initialized");
    } catch (error) {
      this.logger.error("Failed to initialize email transporter", error);
    }
  }

  async getAllTemplates(): Promise<EmailTemplateData[]> {
    const templates = await this.prisma.emailTemplate.findMany({
      orderBy: [{ brand: "asc" }, { name: "asc" }],
    });

    return templates.map((t) => ({
      ...t,
      variables: JSON.parse(t.variables || "[]"),
    }));
  }

  async getTemplate(slug: string): Promise<EmailTemplateData | null> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { slug },
    });

    if (!template) return null;

    return {
      ...template,
      variables: JSON.parse(template.variables || "[]"),
    };
  }

  async getTemplatesByBrand(brand: string): Promise<EmailTemplateData[]> {
    const templates = await this.prisma.emailTemplate.findMany({
      where: { brand },
      orderBy: { name: "asc" },
    });

    return templates.map((t) => ({
      ...t,
      variables: JSON.parse(t.variables || "[]"),
    }));
  }

  async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      variables?: string[];
      isActive?: boolean;
    },
  ): Promise<EmailTemplateData> {
    const template = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...data,
        variables: data.variables ? JSON.stringify(data.variables) : undefined,
        updatedAt: new Date(),
      },
    });

    return {
      ...template,
      variables: JSON.parse(template.variables || "[]"),
    };
  }

  async createTemplate(data: {
    slug: string;
    name: string;
    description?: string;
    brand: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    variables?: string[];
  }): Promise<EmailTemplateData> {
    const template = await this.prisma.emailTemplate.create({
      data: {
        ...data,
        variables: JSON.stringify(data.variables || []),
        isSystem: false,
      },
    });

    return {
      ...template,
      variables: JSON.parse(template.variables || "[]"),
    };
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException("Template not found");
    }

    if (template.isSystem) {
      throw new Error("Cannot delete system templates");
    }

    await this.prisma.emailTemplate.delete({ where: { id } });
  }

  async getTemplatePreview(slug: string): Promise<{ html: string }> {
    const template = await this.getTemplate(slug);
    if (!template) {
      throw new NotFoundException(`Template '${slug}' not found`);
    }

    const testVariables: Record<string, string> = {
      recipientName: "Test User",
      username: "testuser",
      senderName: "John Doe",
      fileName: "example-document.pdf",
      fileSize: "2.5 MB",
      expiresIn: "7 days",
      percentUsed: "85",
      usedStorage: "8.5 GB",
      totalStorage: "10 GB",
      message: "Here is the file you requested!",
    };

    const baseUrl = BRAND_URLS[template.brand] || DROPSHARE_URL;

    testVariables.shareUrl = buildPublicUrl(baseUrl, "/s/test-share-id");
    testVariables.driveUrl = buildPublicUrl(baseUrl, "/");
    testVariables.resetUrl = `${buildPublicUrl(AUTH_URL, "/auth/reset-password")}?token=test-token`;
    testVariables.verifyUrl = `${buildPublicUrl(AUTH_URL, "/auth/verify-email")}?token=test-token`;
    testVariables.loginUrl = buildPublicUrl(AUTH_URL, "/auth/signIn");

    const bodyContent = this.renderTemplate(template.htmlBody, testVariables);
    const subject = this.renderTemplate(template.subject, testVariables);

    let ctaUrl: string | undefined;
    let ctaText: string | undefined;

    if (template.variables.includes("shareUrl")) {
      ctaUrl = testVariables.shareUrl;
      ctaText = "View File";
    } else if (template.variables.includes("driveUrl")) {
      ctaUrl = testVariables.driveUrl;
      ctaText = "Open Drive";
    } else if (template.variables.includes("resetUrl")) {
      ctaUrl = testVariables.resetUrl;
      ctaText = "Reset Password";
    } else if (template.variables.includes("verifyUrl")) {
      ctaUrl = testVariables.verifyUrl;
      ctaText = "Verify Email";
    } else if (template.variables.includes("loginUrl")) {
      ctaUrl = testVariables.loginUrl;
      ctaText = "Sign In";
    }

    const isStorageWarning = template.slug.startsWith('storage-warning');
    let storagePercent: number | undefined;
    let usedStorage: string | undefined;
    let totalStorage: string | undefined;

    if (isStorageWarning) {
      storagePercent = parseInt(testVariables.percentUsed, 10);
      usedStorage = testVariables.usedStorage;
      totalStorage = testVariables.totalStorage;
      ctaUrl = testVariables.driveUrl;
      ctaText = storagePercent >= 100 ? "Upgrade Now" : "Manage Storage";
    }

    const html = this.buildEmailHtml(
      template.brand as keyof typeof BRAND_CONFIG,
      subject,
      "",
      bodyContent,
      ctaUrl,
      ctaText,
      undefined,
      undefined,
      storagePercent,
      usedStorage,
      totalStorage,
    );

    return { html };
  }

  renderTemplate(
    template: string,
    variables: Record<string, string>,
  ): string {
    let rendered = renderSections(template, sectionPresence(variables));

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      rendered = rendered.replace(regex, value);
    }

    rendered = rendered.replace(/{{[^}]+}}/g, "");

    return stripSectionMarkers(rendered);
  }

  private resolveBrandConfig() {
    const t = resolveEmailTheme(this.config);

    let appName = "This site";
    let appUrl = DROPSHARE_URL;
    let logoVersion = "1";
    try {
      appName = this.config.get("general.appName") || appName;
      appUrl = this.config.get("general.appUrl") || appUrl;
      logoVersion = this.config.get("general.themeLogoVersion") || logoVersion;
    } catch {
    }

    const untouched = t.accent === SHIPPED_BRAND.color;

    return {
      name: appName,
      url: appUrl,
      // themeLogoVersion is stamped by LogoService on upload, so a replaced
      // logo gets a new URL rather than sitting behind a year-long cache.
      logo: buildPublicUrl(
        appUrl,
        `/img/logo.png?v=${encodeURIComponent(logoVersion)}`,
      ),
      color: t.accent,
      colorDark: t.accentDeep,
      glowColor: t.accentRgb,
      borderOpacity: "0.4",
      buttonTextColor: untouched ? SHIPPED_BRAND.buttonTextColor : t.onAccent,
      bgGradientStart: untouched
        ? SHIPPED_BRAND.bgGradientStart
        : tintTowardsWhite(t.accent, 0.94),
      bgGradientEnd: SHIPPED_BRAND.bgGradientEnd,
      footerGradientStart: untouched
        ? SHIPPED_BRAND.footerGradientStart
        : tintTowardsWhite(t.accent, 0.97),
      footerGradientEnd: untouched
        ? SHIPPED_BRAND.footerGradientEnd
        : tintTowardsWhite(t.accent, 0.94),
    };
  }

  buildEmailHtml(
    brand: keyof typeof BRAND_CONFIG,
    headline: string,
    subheadline: string,
    bodyHtml: string,
    ctaUrl?: string,
    ctaText?: string,
    footerText?: string,
    headerImageUrl?: string,
    storagePercent?: number,
    usedStorage?: string,
    totalStorage?: string,
  ): string {
    const config = this.resolveBrandConfig();
    const { head: brandHead, tail: brandName } = splitBrandName(config.name);

    let storageBarHtml = '';
    if (storagePercent !== undefined && usedStorage && totalStorage) {
      const isWarning = storagePercent < 100;
      const barColor = isWarning 
        ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' 
        : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
      const glowColor = isWarning 
        ? 'rgba(245, 158, 11, 0.5)' 
        : 'rgba(239, 68, 68, 0.5)';
      const textColor = isWarning ? '#d97706' : '#dc2626';
      
      storageBarHtml = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
          <tr>
            <td>
              <div style="background-color: #f3f4f6; border-radius: 10px; height: 20px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);">
                <div style="background: ${barColor}; width: ${Math.min(storagePercent, 100)}%; height: 100%; border-radius: 10px; box-shadow: 0 0 10px ${glowColor};"></div>
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 8px;">
                <tr>
                  <td style="font-size: 13px; color: #6b7280; text-align: left;">${usedStorage} used</td>
                  <td style="font-size: 13px; color: #6b7280; text-align: right;">${totalStorage} total</td>
                </tr>
              </table>
              <p style="margin: 8px 0 0 0; font-size: 15px; font-weight: 600; color: ${textColor};">${storagePercent}% of storage used</p>
            </td>
          </tr>
        </table>
      `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${headline}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background: linear-gradient(180deg, ${config.bgGradientStart} 0%, ${config.bgGradientEnd} 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, ${config.bgGradientStart} 0%, ${config.bgGradientEnd} 100%);">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        
        <!-- Main Card with Glowing Border -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 2px solid rgba(${config.glowColor}, ${config.borderOpacity}); box-shadow: 0 0 15px rgba(${config.glowColor}, 0.4), 0 0 30px rgba(${config.glowColor}, 0.3), 0 0 45px rgba(${config.glowColor}, 0.2), 0 4px 24px rgba(0, 0, 0, 0.1);">
          
          <!-- Logo & Brand -->
          <tr>
            <td style="padding: 32px 36px 24px 36px; text-align: center;">
              <!--
                Accent-coloured tile with the site logo on top. The logo asset is
                a white silhouette on transparency, so the tile is what makes it
                visible on the white card - and it means a newly uploaded logo
                shows up in email automatically, with no second asset to maintain.
                The URL carries themeLogoVersion, which LogoService stamps on
                upload, so replacing the logo busts the cache instead of leaving
                recipients on the old one.
                Note: this depends on general.appUrl being reachable from the
                recipient's machine. While it is unset or localhost the image
                cannot load and the tile shows the alt text instead.
              -->
              <div style="display: inline-block; background-color: ${config.color}; border-radius: 16px; padding: 12px; margin: 0 auto 16px auto; line-height: 0; box-shadow: 0 4px 12px rgba(${config.glowColor}, 0.3);">
                <img src="${config.logo}" alt="" width="48" height="48" style="display: block; width: 48px; height: 48px;">
              </div>
              <span style="font-size: 20px; font-weight: 700; color: #1a1a1a;">${brandHead}<span style="color: ${config.color};">${brandName}</span></span>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 36px 32px 36px; text-align: center;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #111827; line-height: 1.3;">
                ${headline}
              </h1>
              ${subheadline ? `<p style="margin: 0 0 16px 0; font-size: 15px; color: #6b7280;">${subheadline}</p>` : ''}
              
              ${storageBarHtml}
              
              <div style="font-size: 15px; color: #4b5563; line-height: 1.7;">
                ${bodyHtml}
              </div>
              
              ${ctaUrl && ctaText ? `
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, ${config.color} 0%, ${config.colorDark} 100%); color: ${config.buttonTextColor}; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 50px; box-shadow: 0 4px 14px rgba(${config.glowColor}, 0.4);">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px; background: linear-gradient(180deg, ${config.footerGradientStart} 0%, ${config.footerGradientEnd} 100%); border-top: 1px solid rgba(${config.glowColor}, 0.15); text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                ${footerText || 'You received this email from ' + config.name}
              </p>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #6b7280;">
                © ${new Date().getFullYear()} <span style="color: ${config.colorDark}; font-weight: 600;">${config.name}</span> · 
                <a href="${config.url}/legal" style="color: #6b7280; text-decoration: underline;">Privacy</a>
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
        if (!this.transporter) {
          throw new Error("Email transporter not configured");
        }
      }

      let subject: string;
      let html: string;
      let text: string | undefined;
      let resolvedTemplateId: string | null = null;

      if (options.templateSlug) {
        const template = await this.getTemplate(options.templateSlug);
        if (!template) {
          throw new NotFoundException(`Template '${options.templateSlug}' not found`);
        }
        resolvedTemplateId = template.id;

        if (!template.isActive) {
          throw new Error(`Template '${options.templateSlug}' is disabled`);
        }

        const vars = options.variables || {};
        subject = this.renderTemplate(template.subject, vars);
        const bodyContent = this.renderTemplate(template.htmlBody, vars);
        text = template.textBody ? this.renderTemplate(template.textBody, vars) : undefined;

        const headline = subject;
        const subheadline = "";

        let ctaUrl: string | undefined;
        let ctaText: string | undefined;

        if (template.variables.includes("shareUrl") && vars.shareUrl) {
          ctaUrl = vars.shareUrl;
          ctaText = "View File";
        } else if (template.variables.includes("driveUrl") && vars.driveUrl) {
          ctaUrl = vars.driveUrl;
          ctaText = "Open Drive";
        } else if (template.variables.includes("resetUrl") && vars.resetUrl) {
          ctaUrl = vars.resetUrl;
          ctaText = "Reset Password";
        } else if (template.variables.includes("verifyUrl") && vars.verifyUrl) {
          ctaUrl = vars.verifyUrl;
          ctaText = "Verify Email";
        } else if (template.variables.includes("loginUrl") && vars.loginUrl) {
          ctaUrl = vars.loginUrl;
          ctaText = "Sign In";
        }

        const isStorageWarning = template.slug.startsWith('storage-warning');
        let storagePercent: number | undefined;
        let usedStorage: string | undefined;
        let totalStorage: string | undefined;

        if (isStorageWarning && vars.percentUsed) {
          storagePercent = parseInt(vars.percentUsed, 10);
          usedStorage = vars.usedStorage;
          totalStorage = vars.totalStorage;
          ctaUrl =
            vars.driveUrl ||
            buildPublicUrl(
              BRAND_CONFIG[template.brand as keyof typeof BRAND_CONFIG]?.url || DROPSHARE_URL,
              "/drive",
            );
          ctaText = storagePercent >= 100 ? "Upgrade Now" : "Manage Storage";
        }

        html = this.buildEmailHtml(
          template.brand as keyof typeof BRAND_CONFIG,
          headline,
          subheadline,
          bodyContent,
          ctaUrl,
          ctaText,
          undefined,
          undefined,
          storagePercent,
          usedStorage,
          totalStorage,
        );
      } else {
        if (!options.subject || !options.customHtml) {
          throw new Error("Subject and HTML content required for custom emails");
        }
        subject = options.subject;
        html = options.customHtml;
        text = options.customText;
      }

      const fromEmail = await this.config.get("smtp.email");
      const fromName = await this.config.get("general.appName");

      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject,
        html,
        text,
      });

      await this.writeEmailLog({
        templateId: resolvedTemplateId,
        recipientId: options.userId,
        recipient: options.to,
        subject,
        type: options.type ?? (options.templateSlug ? "template" : null),
        status: "sent",
      });

      this.logger.log(`Email sent to ${options.to}: ${subject}`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${options.to}`, error);

      await this.writeEmailLog({
        recipientId: options.userId,
        recipient: options.to,
        subject: options.subject || "Unknown",
        type: options.type ?? (options.templateSlug ? "template" : null),
        status: "failed",
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  private async writeEmailLog(data: {
    templateId?: string | null;
    recipientId?: string | null;
    recipient: string;
    subject: string;
    type?: string | null;
    status: string;
    error?: string | null;
  }) {
    try {
      await this.prisma.emailLog.create({ data });
    } catch (err: any) {
      this.logger.error(`Failed to write email log: ${err?.message || err}`);
    }
  }

  async sendBroadcast(options: {
    subject: string;
    brand: string;
    headline: string;
    subheadline: string;
    bodyHtml: string;
    ctaUrl?: string;
    ctaText?: string;
    recipientIds?: string[];
  }): Promise<{ sent: number; failed: number }> {
    let users;

    if (options.recipientIds && options.recipientIds.length > 0) {
      users = await this.prisma.user.findMany({
        where: { id: { in: options.recipientIds } },
        select: { id: true, email: true, username: true },
      });
    } else {
      users = await this.prisma.user.findMany({
        select: { id: true, email: true, username: true },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      const vars = this.broadcastVars(user);
      const html = this.buildEmailHtml(
        options.brand as keyof typeof BRAND_CONFIG,
        applyVars(options.headline, vars, true),
        applyVars(options.subheadline, vars, true),
        formatBroadcastBody(applyVars(options.bodyHtml, vars, true)),
        applyVars(options.ctaUrl, vars, true),
        applyVars(options.ctaText, vars, true),
      );

      const result = await this.sendEmail({
        to: user.email,
        subject: applyVars(options.subject, vars, false),
        customHtml: html,
        userId: user.id,
        type: "broadcast",
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return { sent, failed };
  }

  private broadcastVars(user: { username: string; email: string }) {
    return {
      username: user.username,
      email: user.email,
      appName: this.config.get("general.appName") || "DropShare",
      appUrl: this.config.get("general.appUrl") || DROPSHARE_URL,
    };
  }

  async renderBroadcastPreview(options: {
    subject?: string;
    headline?: string;
    subheadline?: string;
    bodyHtml?: string;
    ctaUrl?: string;
    ctaText?: string;
  }): Promise<{ subject: string; html: string }> {
    const vars = this.broadcastVars({
      username: "alexcarter",
      email: "alex@example.com",
    });

    return {
      subject: applyVars(options.subject || "(no subject)", vars, false),
      html: this.buildEmailHtml(
        "dropshare",
        applyVars(options.headline || "", vars, true),
        applyVars(options.subheadline || "", vars, true),
        formatBroadcastBody(applyVars(options.bodyHtml || "", vars, true)),
        applyVars(options.ctaUrl, vars, true),
        applyVars(options.ctaText, vars, true),
      ),
    };
  }

  private static readonly AUTH_LOG_TYPES = ["login-code", "password-reset"];

  async getEmailLogs(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    type?: string;
    search?: string;
    includeAuthTypes?: boolean;
  }): Promise<{ logs: any[]; total: number }> {
    const where: any = {};
    if (options?.status) where.status = options.status;
    if (options?.type) where.type = options.type;
    if (options?.search?.trim()) {
      const search = options.search.trim();
      where.OR = [
        { recipient: { contains: search } },
        { subject: { contains: search } },
      ];
    }

    if (options?.includeAuthTypes === false) {
      const blocked = EmailTemplatesService.AUTH_LOG_TYPES;
      if (options.type && blocked.includes(options.type)) {
        return { logs: [], total: 0 };
      }
      where.AND = [
        { OR: [{ type: null }, { type: { notIn: blocked } }] },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return { logs, total };
  }

  async sendTestEmail(templateSlug: string, toEmail: string): Promise<{ success: boolean; error?: string }> {
    const template = await this.getTemplate(templateSlug);
    if (!template) {
      throw new NotFoundException(`Template '${templateSlug}' not found`);
    }

    const testVariables: Record<string, string> = {};
    for (const varName of template.variables) {
      testVariables[varName] = `[TEST_${varName.toUpperCase()}]`;
    }

    testVariables.recipientName = "Test User";
    testVariables.username = "testuser";
    testVariables.senderName = "John Doe";
    testVariables.fileName = "example-document.pdf";
    testVariables.fileSize = "2.5 MB";
    testVariables.expiresIn = "7 days";
    testVariables.percentUsed = "85";
    testVariables.usedStorage = "8.5 GB";
    testVariables.totalStorage = "10 GB";

    const baseUrl = BRAND_URLS[template.brand] || DROPSHARE_URL;

    testVariables.shareUrl = buildPublicUrl(baseUrl, "/s/test-share-id");
    testVariables.driveUrl = buildPublicUrl(baseUrl, "/");
    testVariables.resetUrl = `${buildPublicUrl(AUTH_URL, "/auth/reset-password")}?token=test-token`;
    testVariables.verifyUrl = `${buildPublicUrl(AUTH_URL, "/auth/verify-email")}?token=test-token`;
    testVariables.loginUrl = buildPublicUrl(AUTH_URL, "/auth/signIn");

    return this.sendEmail({
      to: toEmail,
      templateSlug,
      variables: testVariables,
      type: "template-test",
    });
  }
}
