import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { User } from "@prisma/client";
import * as moment from "moment";
import * as nodemailer from "nodemailer";
import { ConfigService } from "src/config/config.service";
import { resolveEmailTheme } from "./email-theme";
import { PrismaService } from "src/prisma/prisma.service";
import { DROPSHARE_URL } from "src/utils/public-url.util";
import {
  TRANSACTIONAL_EMAILS,
  placeholderVars,
  previewVars,
} from "./email-template-registry";
import {
  flattenSectionsAsPresent,
  hasSectionMarkers,
  renderSections,
  sectionPresence,
  stripSectionMarkers,
  templateSkeleton,
} from "./template-sections";

function esc(value: string | undefined | null): string {
  return (
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\{/g, "&#123;")
      .replace(/\}/g, "&#125;")
  );
}

function renderVars(input: string, vars: Record<string, string>): string {
  const lookup = new Map(
    Object.entries(vars).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return input.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match, name: string) => {
      const key = name.toLowerCase();
      return lookup.has(key) ? String(lookup.get(key) ?? "") : match;
    },
  );
}

function renderVarChips(input: string, vars: Record<string, string>): string {
  return input
    .split(/(<[^>]*>)/)
    .map((segment) => {
      if (segment.startsWith("<")) return segment;
      const lookup = new Map(
        Object.entries(vars).map(([k, v]) => [k.toLowerCase(), { k, v }]),
      );
      return segment.replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (match, name: string) => {
          const hit = lookup.get(name.toLowerCase());
          if (!hit) return match;
          return `<span data-lsvar="${hit.k}" contenteditable="false" class="ls-var-chip">${hit.v}</span>`;
        },
      );
    })
    .join("");
}

const EDITOR_STYLES = `
<style>
  .ls-var-chip {
    background: #e8f7ee;
    border: 1px dashed #55b37c;
    border-radius: 6px;
    padding: 0 5px;
    color: #0b6b39;
    font-weight: 600;
    white-space: nowrap;
    cursor: not-allowed;
    user-select: none;
  }
  #ls-editable {
    outline: none;
  }
  #ls-editable:focus-within {
    box-shadow: inset 0 0 0 2px rgba(0, 200, 70, 0.35);
    border-radius: 8px;
  }
  #ls-editable [contenteditable="false"] { user-select: none; }
</style>`;

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#123;/g, "{")
    .replace(/&#125;/g, "}")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

@Injectable()
export class EmailService implements OnModuleInit {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}
  private readonly logger = new Logger(EmailService.name);

  async onModuleInit() {
    try {
      await this.registerTransactionalTemplates();
    } catch (e: any) {
      this.logger.error(
        `Failed registering transactional email templates: ${e?.message || e}`,
      );
    }
  }

  getTransporter() {
    if (!this.config.get("smtp.enabled"))
      throw new InternalServerErrorException("SMTP is disabled");

    const username = this.config.get("smtp.username");
    const password = this.config.get("smtp.password");

    return nodemailer.createTransport({
      host: this.config.get("smtp.host"),
      port: this.config.get("smtp.port"),
      secure: this.config.get("smtp.port") == 465,
      auth:
        username || password ? { user: username, pass: password } : undefined,
      tls: {
        rejectUnauthorized: !this.config.get(
          "smtp.allowUnauthorizedCertificates",
        ),
      },
    });
  }

  private getEmailTemplate(
    content: string,
    preheader: string = "",
    footerHtml?: string,
  ): string {
    const appName = this.config.get("general.appName") || "DropShare";
    const appUrl = this.config.get("general.appUrl") || DROPSHARE_URL;
    const t = resolveEmailTheme(this.config);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${appName}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f6f5;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #111827;
    }
    
    .email-wrapper {
      width: 100%;
      background-color: #f3f6f5;
      padding: 40px 20px;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 24px;
      border: 1px solid #d9e2df;
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
    }
    
    .email-header {
      background-color: #f5fbf7;
      padding: 40px 40px 30px;
      text-align: center;
      border-bottom: 1px solid #dce9e3;
    }
    
    .logo-badge {
      display: inline-block;
      border-radius: 22px;
      padding: 18px;
      margin-bottom: 16px;
      line-height: 0;
    }

    .logo {
      width: 72px;
      height: 72px;
      display: block;
    }
    
    .brand-name {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
      margin: 0;
      letter-spacing: -0.5px;
    }
    
    .brand-accent {
      color: ${t.accent};
    }
    
    .email-body {
      padding: 40px;
    }
    
    .greeting {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 24px;
      line-height: 1.3;
    }
    
    .message {
      font-size: 16px;
      line-height: 1.7;
      color: #374151;
      margin: 0 0 32px;
    }
    
    .info-box {
      background: #f5fbf7;
      border: 1px solid #dce9e3;
      border-radius: 16px;
      padding: 24px;
      margin: 24px 0;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5ece9;
    }
    
    .info-row:last-child {
      border-bottom: none;
    }
    
    .info-label {
      font-size: 14px;
      color: #6b7280;
    }
    
    .info-value {
      font-size: 14px;
      color: #111827;
      font-weight: 500;
    }
    
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    
    .button {
      display: inline-block;
      background: linear-gradient(135deg, ${t.accent} 0%, ${t.accentDeep} 100%);
      /* Chosen from the accent's luminance: near-black on neon green as
         shipped, white once someone picks a dark brand color. */
      color: ${t.onAccent} !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.3px;
      box-shadow: 0 8px 24px rgba(${t.accentRgb}, 0.3), 0 0 40px rgba(${t.accentRgb}, 0.15);
      transition: all 0.2s ease;
    }
    
    .button:hover {
      box-shadow: 0 12px 32px rgba(${t.accentRgb}, 0.4), 0 0 60px rgba(${t.accentRgb}, 0.2);
    }
    
    .secondary-button {
      display: inline-block;
      background: transparent;
      color: ${t.accent} !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      border: 1px solid rgba(${t.accentRgb}, 0.3);
    }
    
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(${t.subtleRgb}, 0.22), transparent);
      margin: 32px 0;
    }
    
    .note {
      font-size: 14px;
      color: #4b5563;
      margin: 24px 0 0;
      padding: 16px;
      background: #f8faf9;
      border-radius: 12px;
      border: 1px solid #e3ebe7;
      border-left: 3px solid rgba(${t.subtleRgb}, 0.35);
    }
    
    .credentials-box {
      background: #f8faf9;
      border: 1px solid #dce9e3;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    
    .credential-item {
      margin: 12px 0;
    }
    
    .credential-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    
    .credential-value {
      font-size: 16px;
      color: ${t.accent};
      word-break: break-all;
    }
    
    .email-footer {
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e5ece9;
      background: #f8faf9;
    }
    
    .footer-text {
      font-size: 13px;
      color: #6b7280;
      margin: 0 0 8px;
    }
    
    /* Used by body copy for inline links and URLs. Body fragments are stored
       in the database, so they must reference this class rather than carry an
       inline color -- the shell is regenerated each send, the fragment is not. */
    .brand-link {
      color: ${t.link};
    }

    .brand-accent-text {
      color: ${t.accent};
    }

    .footer-link {
      color: ${t.link};
      text-decoration: none;
    }
    
    .footer-link:hover {
      color: ${t.accent};
    }
    
    /* Preheader - hidden preview text */
    .preheader {
      display: none !important;
      visibility: hidden;
      opacity: 0;
      color: transparent;
      height: 0;
      width: 0;
      mso-hide: all;
    }
    
    /* Responsive */
    @media only screen and (max-width: 620px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      
      .email-container {
        border-radius: 16px;
      }
      
      .email-header {
        padding: 30px 24px 24px;
      }
      
      .email-body {
        padding: 24px;
      }
      
      .email-footer {
        padding: 24px;
      }
      
      .title {
        font-size: 20px;
      }
      
      .button {
        padding: 14px 32px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f6f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: #111827; color-scheme: light;">
  <span class="preheader">${preheader}</span>
  <div class="email-wrapper" style="width: 100%; background-color: #f3f6f5; padding: 40px 20px; color-scheme: light;">
    <div class="email-container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; border: 1px solid #d9e2df; overflow: hidden; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12); color-scheme: light;">
      <div class="email-header" style="background-color: #f5fbf7; padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #dce9e3;">
        <div class="logo-badge" style="display: inline-block; background-color: ${t.accent}; border-radius: 22px; padding: 18px; margin-bottom: 16px; line-height: 0; box-shadow: 0 6px 16px rgba(${t.accentRgb}, 0.35);">
          <img src="${appUrl}/img/logo.png" alt="${appName}" class="logo" width="72" height="72" style="display: block; width: 72px; height: 72px;">
        </div>
        <h1 class="brand-name" style="font-size: 28px; font-weight: 700; color: #111827; margin: 0; letter-spacing: -0.5px;">${t.brandHead}<span class="brand-accent" style="color: ${t.accent};">${t.brandTail}</span></h1>
      </div>
      <div class="email-body" style="padding: 40px; color-scheme: light;">
        ${content}
      </div>
      <div class="email-footer" style="padding: 30px 40px; text-align: center; border-top: 1px solid #e5ece9; background: #f8faf9;">
        ${
          footerHtml ||
          `<p class="footer-text" style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">
          This email was sent by <a href="${appUrl}" class="footer-link" style="color: ${t.link}; text-decoration: none;">${appName}</a>
        </p>
        <p class="footer-text" style="font-size: 13px; color: #6b7280; margin: 0;">
          Secure file sharing made simple.
        </p>`
        }
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private async sendMail(
    email: string,
    subject: string,
    text: string,
    html?: string,
    type?: string,
  ) {
    const transporter = this.getTransporter();
    try {
      await transporter.sendMail({
        from: `"${this.config.get("general.appName")}" <${this.config.get(
          "smtp.email",
        )}>`,
        to: email,
        subject,
        text,
        html,
      });
    } catch (e) {
      this.logger.error(e);
      await this.logEmail(email, subject, type, "failed", e?.message);
      throw new InternalServerErrorException("Failed to send email");
    }
    await this.logEmail(email, subject, type, "sent");
  }

  private async resolveEmail(
    slug: string,
    callerVars: Record<string, string>,
    fallbackContent: string,
    footerHtml?: string,
  ): Promise<{
    subject: string;
    html: string;
    content: string;
    overridden: boolean;
  }> {
    const vars: Record<string, string> = {
      appName: esc(this.config.get("general.appName") || "This site"),
      appUrl: this.config.get("general.appUrl") || DROPSHARE_URL,
      ...callerVars,
    };

    const meta = TRANSACTIONAL_EMAILS.find((m) => m.slug === slug);
    const configuredSubject = meta?.subjectConfigKey
      ? this.config.get(meta.subjectConfigKey as `${string}.${string}`)
      : undefined;
    let subjectSource =
      configuredSubject || meta?.defaultSubject || "";
    let content = fallbackContent;
    let overridden = false;

    try {
      const row = await this.prisma.emailTemplate.findUnique({
        where: { slug },
      });
      if (row?.isActive && row.htmlBody?.trim()) {
        content = row.htmlBody;
        overridden = true;
        if (row.subject?.trim()) subjectSource = row.subject;
      }
    } catch (e: any) {
      this.logger.error(
        `Failed to load email template '${slug}', using built-in content: ${e?.message || e}`,
      );
    }

    const sectioned = renderSections(content, sectionPresence(vars));
    const renderedContent = stripSectionMarkers(
      overridden ? renderVars(sectioned, vars) : sectioned,
    );
    return {
      subject: renderVars(subjectSource, vars),
      html: this.getEmailTemplate(
        renderedContent,
        renderVars(meta?.preheader || "", vars),
        footerHtml,
      ),
      content: renderedContent,
      overridden,
    };
  }

  async registerTransactionalTemplates() {
    const builders: Record<string, (_v: Record<string, string>) => string> = {
      "share-notification": EmailService.buildShareNotificationContent,
      "reverse-share": EmailService.buildReverseShareContent,
      "password-reset": EmailService.buildPasswordResetContent,
      "login-code": EmailService.buildLoginCodeContent,
      invite: EmailService.buildInviteContent,
      "smtp-test": EmailService.buildSmtpTestContent,
    };

    for (const meta of TRANSACTIONAL_EMAILS) {
      const build = builders[meta.slug];
      if (!build) continue;
      try {
        const defaultContent = build(placeholderVars(meta));
        const subject =
          (meta.subjectConfigKey
            ? this.config.get(meta.subjectConfigKey as `${string}.${string}`)
            : null) || meta.defaultSubject;

        const existing = await this.prisma.emailTemplate.findUnique({
          where: { slug: meta.slug },
        });

        if (!existing) {
          await this.prisma.emailTemplate.create({
            data: {
              slug: meta.slug,
              name: meta.name,
              description: meta.description,
              brand: "dropshare",
              subject,
              htmlBody: defaultContent,
              variables: JSON.stringify(meta.variables),
              isSystem: true,
              isActive: true,
            },
          });
          this.logger.log(`Registered email template '${meta.slug}'`);
          continue;
        }

        // The one-time rebrand of stale hardcoded brand text in stored bodies now
        // runs as migration 20260801000000_rebrand_stale_email_body_text, before
        // the app boots, rather than from here.

        const isLegacyDocument = /<!DOCTYPE|<html[\s>]/i.test(
          existing.htmlBody || "",
        );
        const usedPlaceholders = new Set(
          (`${existing.htmlBody || ""}${existing.subject || ""}`.match(
            /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
          ) || []).map((m) => m.replace(/[{}\s]/g, "")),
        );
        const knownLower = meta.variables.map((v) => v.toLowerCase());
        const hasUnknownPlaceholder = [...usedPlaceholders].some(
          (v) => !knownLower.includes(v.toLowerCase()),
        );
        const defaultHasSections = hasSectionMarkers(defaultContent);
        const storedHasSections = hasSectionMarkers(existing.htmlBody || "");
        const isPristinePreSectionDefault =
          defaultHasSections &&
          !storedHasSections &&
          templateSkeleton(existing.htmlBody || "") ===
            templateSkeleton(flattenSectionsAsPresent(defaultContent));
        if (
          isLegacyDocument ||
          hasUnknownPlaceholder ||
          isPristinePreSectionDefault
        ) {
          const bodyOnly =
            isPristinePreSectionDefault &&
            !isLegacyDocument &&
            !hasUnknownPlaceholder;
          await this.prisma.emailTemplate.update({
            where: { slug: meta.slug },
            data: {
              name: meta.name,
              description: meta.description,
              ...(bodyOnly ? {} : { subject }),
              htmlBody: defaultContent,
              variables: JSON.stringify(meta.variables),
              isSystem: true,
            },
          });
          const reason = isLegacyDocument
            ? "full HTML document"
            : hasUnknownPlaceholder
              ? "unknown placeholders"
              : "pre-section default with flattened conditionals";
          this.logger.log(
            `Reset stale email template '${meta.slug}' to built-in content ` +
              `(${reason})`,
          );
          continue;
        }

        if (
          existing.name !== meta.name ||
          existing.description !== meta.description ||
          existing.variables !== JSON.stringify(meta.variables)
        ) {
          await this.prisma.emailTemplate.update({
            where: { slug: meta.slug },
            data: {
              name: meta.name,
              description: meta.description,
              variables: JSON.stringify(meta.variables),
            },
          });
        }
      } catch (e: any) {
        this.logger.error(
          `Failed to register email template '${meta.slug}': ${e?.message || e}`,
        );
      }
    }

    try {
      const known = TRANSACTIONAL_EMAILS.map((m) => m.slug);
      const { count } = await this.prisma.emailTemplate.deleteMany({
        where: { isSystem: true, slug: { notIn: known } },
      });
      if (count > 0) {
        this.logger.log(`Removed ${count} obsolete system email template(s)`);
      }
    } catch (e: any) {
      this.logger.error(`Failed pruning obsolete templates: ${e?.message || e}`);
    }
  }

  private async logEmail(
    recipient: string,
    subject: string,
    type: string | undefined,
    status: "sent" | "failed",
    error?: string,
  ) {
    try {
      await this.prisma.emailLog.create({
        data: {
          recipient,
          subject,
          type: type ?? null,
          status,
          error: error ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write email log: ${err?.message || err}`,
      );
    }
  }

  async sendMailToShareRecipients(
    recipientEmail: string,
    shareId: string,
    creator?: User,
    description?: string,
    expiration?: Date,
  ) {
    if (!this.config.get("email.enableShareEmailRecipients"))
      throw new InternalServerErrorException("Email service disabled");

    const shareUrl = `${this.config.get("general.appUrl")}/s/${shareId}`;
    const creatorName = creator?.username ?? "Someone";
    const creatorEmail = creator?.email ?? "";
    const expiresText = moment(expiration).unix() != 0
      ? moment(expiration).fromNow()
      : "Never";

    let plainText = this.config
      .get("email.shareRecipientsMessage")
      .replaceAll("\\n", "\n")
      .replaceAll("{creator}", creatorName)
      .replaceAll("{creatorEmail}", creatorEmail)
      .replaceAll("{shareUrl}", shareUrl)
      .replaceAll("{desc}", description ?? "No description")
      .replaceAll("{expires}", expiresText);

    const v = {
      creatorName: esc(creatorName),
      creatorEmail: esc(creatorEmail),
      description: description ? esc(description) : "",
      expiresText: esc(expiresText),
      shareUrl,
    };
    const htmlContent = EmailService.buildShareNotificationContent(v);

    const resolved = await this.resolveEmail("share-notification", v, htmlContent);
    const html = resolved.html;
    if (resolved.overridden) plainText = htmlToText(resolved.content) || plainText;

    await this.sendMail(
      recipientEmail,
      resolved.subject,
      plainText,
      html,
      "share-notification",
    );
  }

  async sendMailToReverseShareCreator(recipientEmail: string, shareId: string) {
    const shareUrl = `${this.config.get("general.appUrl")}/s/${shareId}`;

    let plainText = this.config
      .get("email.reverseShareMessage")
      .replaceAll("\\n", "\n")
      .replaceAll("{shareUrl}", shareUrl);

    const v = { shareUrl };
    const htmlContent = EmailService.buildReverseShareContent(v);

    const resolved = await this.resolveEmail("reverse-share", v, htmlContent);
    const html = resolved.html;
    if (resolved.overridden) plainText = htmlToText(resolved.content) || plainText;

    await this.sendMail(
      recipientEmail,
      resolved.subject,
      plainText,
      html,
      "reverse-share",
    );
  }

  async sendResetPasswordEmail(recipientEmail: string, token: string) {
    const resetPasswordUrl = `${this.config.get(
      "general.appUrl",
    )}/auth/resetPassword/${token}`;

    let plainText = this.config
      .get("email.resetPasswordMessage")
      .replaceAll("\\n", "\n")
      .replaceAll("{url}", resetPasswordUrl);

    const v = { resetUrl: resetPasswordUrl };
    const htmlContent = EmailService.buildPasswordResetContent(v);

    const resolved = await this.resolveEmail("password-reset", v, htmlContent);
    const html = resolved.html;
    if (resolved.overridden) plainText = htmlToText(resolved.content) || plainText;

    await this.sendMail(
      recipientEmail,
      resolved.subject,
      plainText,
      html,
      "password-reset",
    );
  }

  async sendLoginCode(
    recipientEmail: string,
    opts: { code: string; render?: boolean },
  ): Promise<string> {
    const appUrl = this.config.get("general.appUrl") || DROPSHARE_URL;

    const appName = this.config.get("general.appName") || "DropShare";
    let plainText =
      `Your ${appName} sign-in code is: ${opts.code}\n\n` +
      `Enter this code to finish signing in. It expires in 10 minutes and can only be used once.\n\n` +
      `If you didn't just try to sign in, you can safely ignore this email - no one can access your account without this code.\n`;

    const v = { code: esc(opts.code), appUrl, appName: esc(appName) };
    const htmlContent = EmailService.buildLoginCodeContent(v);

    const resolved = await this.resolveEmail(
      "login-code",
      v,
      htmlContent,
      EmailService.buildLoginCodeFooter(v),
    );
    const html = resolved.html;
    if (resolved.overridden) plainText = htmlToText(resolved.content) || plainText;

    if (opts.render) return html;

    await this.sendMail(
      recipientEmail,
      resolved.subject,
      plainText,
      html,
      "login-code",
    );
    return html;
  }

  async sendInviteEmail(recipientEmail: string, password: string) {
    const loginUrl = `${this.config.get("general.appUrl")}/auth/signIn`;

    let plainText = this.config
      .get("email.inviteMessage")
      .replaceAll("{url}", loginUrl)
      .replaceAll("{password}", password)
      .replaceAll("{email}", recipientEmail);

    const v = {
      email: esc(recipientEmail),
      password: esc(password),
      loginUrl,
      appName: esc(this.config.get("general.appName") || "This site"),
    };
    const htmlContent = EmailService.buildInviteContent(v);

    const resolved = await this.resolveEmail("invite", v, htmlContent);
    const html = resolved.html;
    if (resolved.overridden) plainText = htmlToText(resolved.content) || plainText;

    await this.sendMail(
      recipientEmail,
      resolved.subject,
      plainText,
      html,
      "invite",
    );
  }

  async sendTestMail(recipientEmail: string) {
    const v = { recipientEmail: esc(recipientEmail) };
    const htmlContent = EmailService.buildSmtpTestContent(v);

    const resolved = await this.resolveEmail("smtp-test", v, htmlContent);
    const html = resolved.html;

    try {
      await this.getTransporter().sendMail({
        from: `"${this.config.get("general.appName")}" <${this.config.get(
          "smtp.email",
        )}>`,
        to: recipientEmail,
        subject: resolved.subject,
        text: `This is a test email from ${this.config.get("general.appName") || "this site"}. Your SMTP configuration is working correctly.`,
        html,
      });
      await this.logEmail(recipientEmail, resolved.subject, "smtp-test", "sent");
    } catch (e) {
      this.logger.error(e);
      await this.logEmail(recipientEmail, resolved.subject, "smtp-test", "failed", e?.message);
      throw new InternalServerErrorException(e.message);
    }
  }

  static buildLoginCodeFooter(v: Record<string, string>): string {
    return `
      <p class="footer-text" style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">
        Sent automatically by <a href="${v.appUrl}" class="footer-link" style="text-decoration: none;">${v.appName || "this site"}</a> to verify a sign-in to your account. You didn't request it? You can safely ignore this email.
      </p>
      <p class="footer-text" style="font-size: 13px; color: #6b7280; margin: 0;">
        Secure file sharing made simple.
      </p>`;
  }

  async renderPreview(
    slug: string,
    overrides?: { htmlBody?: string; subject?: string; editable?: boolean },
  ): Promise<{ subject: string; html: string }> {
    const meta = TRANSACTIONAL_EMAILS.find((m) => m.slug === slug);
    if (!meta) throw new NotFoundException(`Unknown email template '${slug}'`);

    const builders: Record<string, (_v: Record<string, string>) => string> = {
      "share-notification": EmailService.buildShareNotificationContent,
      "reverse-share": EmailService.buildReverseShareContent,
      "password-reset": EmailService.buildPasswordResetContent,
      "login-code": EmailService.buildLoginCodeContent,
      invite: EmailService.buildInviteContent,
      "smtp-test": EmailService.buildSmtpTestContent,
    };

    const vars = {
      ...previewVars(meta),
      // Use the live site identity so the preview matches what recipients see,
      // rather than the shipped sample values.
      appName: this.config.get("general.appName") || "DropShare",
      appUrl: this.config.get("general.appUrl") || DROPSHARE_URL,
    };
    const row = await this.prisma.emailTemplate
      .findUnique({ where: { slug } })
      .catch(() => null);

    const content =
      overrides?.htmlBody?.trim() ||
      (row?.isActive && row.htmlBody?.trim() ? row.htmlBody : null) ||
      builders[slug](placeholderVars(meta));

    const subjectSource =
      overrides?.subject?.trim() ||
      (row?.isActive && row.subject?.trim() ? row.subject : null) ||
      (meta.subjectConfigKey
        ? this.config.get(meta.subjectConfigKey as `${string}.${string}`)
        : null) ||
      meta.defaultSubject;

    const renderedContent = overrides?.editable
      ? `<div id="ls-editable" contenteditable="true">${renderVarChips(
          content,
          vars,
        )}</div>`
      : stripSectionMarkers(
          renderVars(renderSections(content, sectionPresence(vars)), vars),
        );

    let html = this.getEmailTemplate(
      renderedContent,
      renderVars(meta.preheader, vars),
      slug === "login-code"
        ? EmailService.buildLoginCodeFooter(vars)
        : undefined,
    );
    if (overrides?.editable) {
      html = html.replace("</head>", `${EDITOR_STYLES}</head>`);
    }

    return { subject: renderVars(subjectSource, vars), html };
  }

  static buildShareNotificationContent(v: Record<string, string>): string {
    return `
      <p class="greeting">File Share Notification</p>
      <h2 class="title">${v.creatorName} has shared files with you</h2>
      <p class="message">
        You have received a file share from ${v.creatorName}<!--{{#creatorEmail}}--> (${v.creatorEmail})<!--{{/creatorEmail}}--> using ${v.appName},
        a secure file sharing service. The shared content is available for download at your convenience.
      </p>

      <!--{{#description}}-->
      <div class="info-box">
        <p class="info-label" style="margin: 0 0 8px;">Message from sender</p>
        <p style="margin: 0; color: #111827; font-size: 15px;">${v.description}</p>
      </div>
      <!--{{/description}}-->
      
      <div class="info-box">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5ece9;">
              <span style="font-size: 14px; color: #6b7280;">Shared by</span>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5ece9; text-align: right;">
              <span style="font-size: 14px; color: #111827; font-weight: 500;">${v.creatorName}</span>
            </td>
          </tr>
          <!--{{#creatorEmail}}-->
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5ece9;">
              <span style="font-size: 14px; color: #6b7280;">Contact</span>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5ece9; text-align: right;">
              <span style="font-size: 14px; color: #111827; font-weight: 500;">${v.creatorEmail}</span>
            </td>
          </tr>
          <!--{{/creatorEmail}}-->
          <tr>
            <td style="padding: 12px 0;">
              <span style="font-size: 14px; color: #6b7280;">Available until</span>
            </td>
            <td style="padding: 12px 0; text-align: right;">
              <span style="font-size: 14px; color: #111827; font-weight: 500;">${v.expiresText}</span>
            </td>
          </tr>
        </table>
      </div>
      
      <div class="button-container">
        <a href="${v.shareUrl}" class="button">Access Shared Files</a>
      </div>
      
      <p class="message" style="font-size: 13px; color: #6b7280; margin-top: 24px;">
        If the button above doesn't work, copy and paste this link into your browser:<br>
        <span class="brand-link" style="word-break: break-all;">${v.shareUrl}</span>
      </p>
      
      <div class="note">
        This is a legitimate file share from ${v.creatorName}. If you were not expecting this email or do not recognize the sender, 
        please disregard this message. For questions, contact the sender directly at <!--{{#creatorEmail}}-->${v.creatorEmail}<!--{{/creatorEmail}}--><!--{{^creatorEmail}}-->their email address<!--{{/creatorEmail}}-->.
      </div>
    `;
  }

  static buildReverseShareContent(v: Record<string, string>): string {
    return `
      <p class="greeting">New upload received</p>
      <h2 class="title">Someone uploaded files to your reverse share</h2>
      <p class="message">
        Good news! Someone has used your reverse share link to upload files for you. 
        Click the button below to view and download the uploaded content.
      </p>
      
      <div class="button-container">
        <a href="${v.shareUrl}" class="button">View Uploaded Files</a>
      </div>
      
      <div class="note">
        If you didn't expect this upload, you can delete the share from your dashboard.
      </div>
    `;
  }

  static buildPasswordResetContent(v: Record<string, string>): string {
    return `
      <p class="greeting">Password Reset</p>
      <h2 class="title">Reset your password</h2>
      <p class="message">
        We received a request to reset the password for your ${v.appName} account. 
        Click the button below to create a new password.
      </p>
      
      <div class="button-container">
        <a href="${v.resetUrl}" class="button">Reset Password</a>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="font-size: 14px; color: #6b7280;">
        If you didn't request a password reset, you can safely ignore this email. 
        Your password will remain unchanged.
      </p>
      
      <div class="note">
        <strong>Security tip:</strong> This link will expire soon for your protection. 
        If it expires, you can request a new reset link.
      </div>
    `;
  }

  static buildLoginCodeContent(v: Record<string, string>): string {
    return `
      <p class="greeting">Verify it's you</p>
      <h2 class="title">Your sign-in code</h2>
      <p class="message">
        Enter this code to finish signing in to your ${v.appName} account. It expires
        in <strong>10 minutes</strong> and can only be used once.
      </p>
      <div style="text-align: center; margin: 8px 0 28px;">
        <div style="display: inline-block; background: #f5fbf7; border: 1px solid #dce9e3; border-radius: 16px; padding: 22px 34px;">
          <span style="font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace; font-size: 42px; font-weight: 700; letter-spacing: 12px; color: #111827;">${v.code}</span>
        </div>
      </div>
      <p class="message" style="font-size: 14px; line-height: 1.7; color: #6b7280; margin: 0;">
        If you didn't just try to sign in, you can safely ignore this email - no one
        can access your account without this code.
      </p>
      <div class="note">
        <strong class="brand-link">Skip these next time.</strong> Add an
        authenticator app or a passkey in your account settings and you won't need
        email codes to sign in.
      </div>`;
  }

  static buildInviteContent(v: Record<string, string>): string {
    return `
      <p class="greeting">Welcome aboard</p>
      <h2 class="title">You've been invited to ${v.appName}</h2>
      <p class="message">
        An account has been created for you on ${v.appName}, a secure file sharing platform.
        Use the credentials below to sign in and start sharing files.
      </p>
      
      <div class="credentials-box">
        <div class="credential-item">
          <div class="credential-label">Email</div>
          <div class="credential-value">${v.email}</div>
        </div>
        <div class="credential-item">
          <div class="credential-label">Temporary Password</div>
          <div class="credential-value">${v.password}</div>
        </div>
      </div>
      
      <div class="button-container">
        <a href="${v.loginUrl}" class="button">Sign In to ${v.appName}</a>
      </div>
      
      <div class="note">
        <strong>Important:</strong> For security, please change your password after your first login. 
        You can do this from your account settings.
      </div>
    `;
  }

  static buildSmtpTestContent(v: Record<string, string>): string {
    return `
      <p class="greeting">Test Email</p>
      <h2 class="title">Your email is configured correctly!</h2>
      <p class="message">
        This is a test email from ${v.appName}. If you're seeing this, your SMTP settings
        are working perfectly.
      </p>
      
      <div class="info-box">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5ece9;">
              <span style="font-size: 14px; color: #6b7280;">Status</span>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5ece9; text-align: right;">
              <span class="brand-accent-text" style="font-size: 14px; font-weight: 500;">Connected</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0;">
              <span style="font-size: 14px; color: #6b7280;">Sent to</span>
            </td>
            <td style="padding: 12px 0; text-align: right;">
              <span style="font-size: 14px; color: #111827; font-weight: 500;">${v.recipientEmail}</span>
            </td>
          </tr>
        </table>
      </div>
      
      <p class="message" style="font-size: 14px; color: #6b7280;">
        Your users will receive beautifully formatted emails like this one for share notifications, 
        password resets, and account invitations.
      </p>
    `;
  }

}
