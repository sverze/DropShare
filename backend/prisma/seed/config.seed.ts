import { Prisma, PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const defaultTermsOfServiceText = `## 1. Acceptance of Terms

By accessing or using DropShare ("Service"), you agree to be bound by these Terms of Service.
If you do not agree to these Terms, do not use the Service.

## 2. Description of Service

DropShare is a file-sharing platform that allows users to upload, store, and share files
through private or public links. Features, limits, and availability may change over time.

## 3. Eligibility and Account Responsibility

You may use the Service only if you are legally able to enter into these Terms. If you create
an account, you are responsible for maintaining the confidentiality of your credentials and for
all activity that occurs under your account.

## 4. Your Content and Rights

You retain ownership of content you upload. By uploading or sharing content through the Service,
you represent and warrant that:

- You own the content or have all rights and permissions necessary to upload, store, and share it
- Your content and your use of the Service do not violate any law, contract, or third-party right
- You are solely responsible for the content you upload and for the links you distribute

## 5. Acceptable Use

You may not use the Service to:

- Upload, store, or share content that infringes copyright, trademark, privacy, publicity, or other rights
- Upload, store, or distribute child sexual abuse material (CSAM) or any content exploiting minors
- Upload, store, or distribute malware, malicious code, phishing material, or other harmful software
- Distribute content that is unlawful, fraudulent, defamatory, harassing, threatening, or abusive
- Attempt to gain unauthorized access to accounts, files, systems, or networks
- Interfere with the security, stability, or proper operation of the Service
- Use the Service in violation of applicable laws or regulations

## 6. Public Sharing and Availability

Anyone with a valid share link may be able to access content made available through that link,
subject to any password, expiration, or access controls you set. You are responsible for ensuring
that your sharing settings match the intended audience and sensitivity of the content.

## 7. Enforcement, Removal, and Suspension

We may investigate misuse of the Service and may remove content, disable links, limit access,
suspend accounts, or terminate access at any time, with or without notice, including where we
believe:

- The content or conduct violates these Terms or applicable law
- The content is subject to a valid complaint, takedown request, or legal process
- The content or activity creates security, abuse, or operational risk for the Service or others

We may preserve and disclose information where required by law or where we reasonably believe it
is necessary to protect users, third parties, or the Service.

## 8. Copyright, Abuse, and Support

DropShare may respond to copyright, abuse, impersonation, fraud, malware, and other policy
reports. Please use the contact details published on the Legal page for support, abuse,
and takedown matters.

## 9. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE,
ERROR-FREE, OR FREE FROM LOSS, CORRUPTION, OR DELAY.

## 10. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, DROPSHARE AND ITS OPERATORS WILL NOT BE LIABLE FOR ANY
INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF
DATA, CONTENT, BUSINESS, REVENUE, PROFITS, OR GOODWILL ARISING OUT OF OR RELATED TO YOUR USE OF
THE SERVICE.

## 11. Data Retention

Files are generally deleted after their configured expiration period. We may retain logs,
metadata, abuse records, and other limited operational information for security, fraud
prevention, legal compliance, and service administration.

## 12. Changes to These Terms

We may update these Terms from time to time. Continued use of the Service after revised Terms
become effective constitutes acceptance of the updated Terms.
`;

const defaultPrivacyPolicyText = `## 1. Information We Collect

**Information You Provide:**

- Account Information: Username, email address, and encrypted password (if you register)
- Uploaded Files: Files you upload (stored temporarily until expiration)
- Share Settings: Expiration dates, passwords, and other configurations

**Information Collected Automatically:**

- IP Addresses: Logged for security and abuse prevention
- Device Information: Browser type, operating system
- Usage Data: Pages visited, features used, timestamps
- Cookies: Essential cookies for authentication and preferences

## 2. How We Use Your Information

- Provide and maintain the Service
- Process your uploads and generate share links
- Authenticate users and secure accounts
- Detect and prevent abuse, fraud, and illegal activity
- Respond to legal requests and enforce our Terms
- Improve and optimize our Service

## 3. Information Sharing

We may share your information when required by law, court order, or government request.
We may share information with service providers who assist in operating our Service.
We do NOT sell your personal information to advertisers.

## 4. Data Security

We implement appropriate security measures including encryption of data in transit (HTTPS/TLS),
secure password hashing, regular security updates, and access controls. However, no method of
transmission over the Internet is 100% secure.

## 5. Your Rights

Depending on your jurisdiction, you may have the right to access, correct, delete, or port
your personal data. To exercise these rights, contact us at the email below.

## 6. Children's Privacy

Our Service is not intended for children under 13 years of age. We do not knowingly collect
personal information from children under 13.`;

const defaultDmcaText = `## Copyright Policy

DropShare respects the intellectual property rights of others and expects users to do the same.
We may remove or disable access to material claimed to be infringing and may terminate repeat
infringers in appropriate circumstances.

## Filing a DMCA Takedown Notice

If you believe material on DropShare infringes your copyright, your written notice should include:

1. Your physical or electronic signature
2. Identification of the copyrighted work claimed to have been infringed
3. Identification of the material claimed to be infringing, with information reasonably sufficient for us to locate it, including the full DropShare URL
4. Your name, mailing address, telephone number, and email address
5. A statement that you have a good-faith belief the disputed use is not authorized by the copyright owner, its agent, or the law
6. A statement that the information in your notice is accurate and, under penalty of perjury, that you are authorized to act on behalf of the copyright owner

## Counter-Notification

If you believe material you posted was removed or disabled by mistake or misidentification,
your counter-notification should include:

1. Your physical or electronic signature
2. Identification of the material that was removed or disabled and the location where it appeared before removal or disabling
3. A statement under penalty of perjury that you have a good-faith belief the material was removed or disabled as a result of mistake or misidentification
4. Your name, address, telephone number, and email address
5. A statement that you consent to the jurisdiction of the Federal District Court for your judicial district, or if you are outside the United States, for any judicial district in which the service provider may be found, and that you will accept service of process from the person who submitted the original notice or that person's agent

If we receive a facially valid counter-notification, we may forward it to the complaining party.
Unless the original complainant notifies us that they have filed an action seeking a court order,
we may restore the material in not less than 10 and not more than 14 business days after receipt
of the counter-notification.

## Repeat Infringer Policy

We may terminate or restrict the accounts of users who are determined to be repeat infringers
or who repeatedly abuse the Service.

## Reporting and Contact

For copyright notices, takedown requests, malware reports, and other abuse issues, use the
abuse contact listed on the DropShare Legal page and include the full DropShare URL, enough
context to identify the material, and a clear description of the issue.`;

export const configVariables = {
  internal: {
    jwtSecret: {
      type: "string",
      value: crypto.randomBytes(256).toString("base64"),
      locked: true,
    },
  },
  general: {
    // How long request logs are kept before the nightly prune deletes them.
    // 30 days of even modest traffic can run to millions of rows; lower this
    // if the database file is growing faster than you want.
    requestLogRetentionDays: {
      type: "number",
      defaultValue: "30",
      secret: false,
    },
    appName: {
      type: "string",
      defaultValue: "DropShare",
      secret: false,
    },
    appUrl: {
      type: "string",
      defaultValue: "http://localhost:3000",
      secret: false,
    },
    secureCookies: {
      type: "boolean",
      defaultValue: "false",
    },
    showHomePage: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
    sessionDuration: {
      type: "timespan",
      defaultValue: "3 months",
      secret: false,
    },

    // ---------------------------------------------------------------------
    // Appearance. Managed from Admin -> Configuration -> General, not from the
    // generic config rows (the page hides every `theme*` key and renders its
    // own Light/Dark colour editor instead).
    //
    // Every default below is the colour DropShare ships with today, so a fresh
    // install and an upgraded install look identical. They are `secret: false`
    // because unauthenticated pages (share links, the login screen) need them.
    //
    // Colours are stored as bare `#rrggbb`. Opacity, gradients and glows are
    // derived in the frontend so the *structure* of the design stays fixed and
    // only the hue is configurable.
    // ---------------------------------------------------------------------

    // -- Dark mode -------------------------------------------------------
    themeDarkAccent: {
      type: "string",
      defaultValue: "#fb923c",
      secret: false,
    },
    themeDarkBackground: {
      type: "string",
      defaultValue: "#140b04",
      secret: false,
    },
    themeDarkHeaderBackground: {
      type: "string",
      defaultValue: "#261a0f",
      secret: false,
    },
    themeDarkHeaderBorder: {
      type: "string",
      defaultValue: "#fb923c",
      secret: false,
    },
    themeDarkLogoText: {
      type: "string",
      defaultValue: "#ffffff",
      secret: false,
    },
    themeDarkLogoAccent: {
      type: "string",
      defaultValue: "#fb923c",
      secret: false,
    },
    themeDarkUploadButton: {
      type: "string",
      defaultValue: "#fb923c",
      secret: false,
    },
    themeDarkBulkUploadButton: {
      type: "string",
      defaultValue: "#fbbf24",
      secret: false,
    },
    themeDarkHomeButton: {
      type: "string",
      defaultValue: "#fb923c",
      secret: false,
    },
    themeDarkPanelBackground: {
      type: "string",
      defaultValue: "#241a0f",
      secret: false,
    },
    themeDarkPanelBorder: {
      type: "string",
      defaultValue: "#fb923c",
      secret: false,
    },

    // -- Light mode ------------------------------------------------------
    themeLightAccent: {
      type: "string",
      defaultValue: "#ea580c",
      secret: false,
    },
    themeLightBackground: {
      type: "string",
      defaultValue: "#fff7ed",
      secret: false,
    },
    themeLightHeaderBackground: {
      type: "string",
      defaultValue: "#ffefdd",
      secret: false,
    },
    themeLightHeaderBorder: {
      type: "string",
      defaultValue: "#ea580c",
      secret: false,
    },
    themeLightLogoText: {
      type: "string",
      defaultValue: "#2a1c10",
      secret: false,
    },
    themeLightLogoAccent: {
      type: "string",
      defaultValue: "#ea580c",
      secret: false,
    },
    themeLightUploadButton: {
      type: "string",
      defaultValue: "#ea580c",
      secret: false,
    },
    themeLightBulkUploadButton: {
      type: "string",
      defaultValue: "#d97706",
      secret: false,
    },
    themeLightHomeButton: {
      type: "string",
      defaultValue: "#ea580c",
      secret: false,
    },
    themeLightPanelBackground: {
      type: "string",
      defaultValue: "#ffffff",
      secret: false,
    },
    themeLightPanelBorder: {
      type: "string",
      defaultValue: "#ea580c",
      secret: false,
    },

    // -- Shared between modes --------------------------------------------
    // The animated ring around the share/upload modals runs
    // outer -> inner -> center -> inner -> outer. It is deliberately identical
    // in both colour schemes, so these are not per-mode.
    themeModalRingOuter: {
      type: "string",
      defaultValue: "#f97316",
      secret: false,
    },
    themeModalRingInner: {
      type: "string",
      defaultValue: "#f59e0b",
      secret: false,
    },
    themeModalRingCenter: {
      type: "string",
      defaultValue: "#fdba74",
      secret: false,
    },

    // Set automatically when a logo is uploaded, never by hand: true when the
    // image has no transparency, in which case share pages show it as-is
    // instead of tinting it (masking an opaque image yields a filled block).
    // Which header shell the site renders. "default" is the floating panel,
    // "minimal" is the borderless strip. Validated against that list rather
    // than the hex check the other theme* keys get.
    themeHeaderStyle: {
      type: "string",
      defaultValue: "default",
      secret: false,
    },
    themeLogoIsOpaque: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },

    // Bumped by LogoService on every upload. The share page puts it in the
    // /api/share-logo URL, which is served immutable for a year -- without a
    // changing token a new logo would never reach existing social previews.
    themeLogoVersion: {
      type: "string",
      defaultValue: "1",
      secret: false,
    },

    // The fixed set of accent colours offered when creating a share. Stored as
    // JSON so the list stays one row; the admin UI keeps the count fixed and
    // the backend validates the shape on save.
    themeSharePresets: {
      type: "text",
      defaultValue: JSON.stringify([
        { color: "#00ff5a", name: "Neon Green" },
        { color: "#00d4ff", name: "Electric Blue" },
        { color: "#ff6b35", name: "Sunset Orange" },
        { color: "#a855f7", name: "Purple Haze" },
        { color: "#ff1493", name: "Hot Pink" },
        { color: "#fbbf24", name: "Golden" },
        { color: "#22d3d6", name: "Cyan" },
        { color: "#ef4444", name: "Red Alert" },
        { color: "#a9b0ca", name: "Space Grey" },
      ]),
      secret: false,
    },
  },
  banners: {
    // JSON array of site banners rendered above page content. Managed from
    // Admin -> Banners. Not secret: the public pages need to read it.
    // Shape (see frontend/src/types/banner.type.ts):
    //   [{ id, enabled, title, message, variant, links: [{label, href}],
    //      pages: ["*"] | ["/", "/upload", "/share/*"], dismissible,
    //      startsAt, endsAt }]
    items: {
      type: "text",
      defaultValue: "[]",
      secret: false,
    },
  },
  access: {
    // JSON map of Manager capability -> boolean. Empty object = all off, so a
    // Manager can do nothing until an admin grants capabilities on the Access
    // Levels page. Secret so it stays off the public /configs response.
    managerCapabilities: {
      type: "text",
      defaultValue: "{}",
      secret: true,
    },
  },
  share: {
    // Master off switch for virus scanning. An install without a reachable
    // ClamAV should turn this off rather than have every upload queue a scan
    // that can never run.
    virusScanEnabled: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
    allowRegistration: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
    requireInviteCodeForRegistration: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    allowUnauthenticatedShares: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    // Visibility given to a newly created share when the client does not ask
    // for one: "public" means anyone holding the link can view and download
    // without an account, "private" restricts it to the creator, the share's
    // group and admins.
    //
    // Existing shares are NOT affected - the column defaults to PRIVATE so a
    // migration can never publish something retroactively. This only decides
    // what happens to shares created from now on.
    defaultShareVisibility: {
      type: "string",
      defaultValue: "public",
      secret: false,
    },
    allowUninvitedRegisteredShares: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    maxAnonymousExpiration: {
      type: "timespan",
      defaultValue: "5 days",
      secret: false,
    },
    maxUninvitedRegisteredExpiration: {
      type: "timespan",
      defaultValue: "5 days",
      secret: false,
    },
    maxUninvitedRegisteredSize: {
      type: "filesize",
      defaultValue: "1073741824",
      secret: false,
    },
    maxExpiration: {
      type: "timespan",
      defaultValue: "0 days",
      secret: false,
    },
    shareIdLength: {
      type: "number",
      defaultValue: "15",
      secret: false,
    },
    maxSize: {
      type: "filesize",
      defaultValue: "12000000000",
      secret: false,
    },
    maxAnonymousSize: {
      type: "filesize",
      defaultValue: "7000000000",
      secret: false,
    },
    zipCompressionLevel: {
      type: "number",
      defaultValue: "9",
    },
    chunkSize: {
      type: "filesize",
      defaultValue: "10000000",
      secret: false,
    },
    multipartThreshold: {
      type: "filesize",
      defaultValue: "50000000",
      secret: false,
    },
    autoOpenShareModal: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    // How visitors reach bulk upload (one share per file):
    //   "page"  - dedicated Bulk Upload page linked in the header (default)
    //   "modal" - Standard/Bulk switch inside the normal upload dialog
    bulkUploadMode: {
      type: "string",
      defaultValue: "page",
      secret: false,
    },
    // When off, reverse shares disappear from the account menu and the API
    // refuses to create new ones. Existing links keep working.
    allowReverseShares: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
  },
  donations: {
    enabled: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    provider: {
      type: "string",
      defaultValue: "btcpay",
      secret: false,
    },
    storageCostPerGibMonthUsd: {
      type: "string",
      defaultValue: "0.0198",
      secret: false,
    },
    serverCostPerMonthUsd: {
      type: "string",
      defaultValue: "100",
      secret: false,
    },
    btcAddress: {
      type: "string",
      defaultValue: "",
      secret: false,
    },
    // An external donate link (PayPal, Ko-fi, Open Collective and so on). Lets
    // donations stay switched on with BTCPay off: the note and this link show,
    // and no invoice is ever created.
    externalUrl: {
      type: "string",
      defaultValue: "",
      secret: false,
    },
    externalLabel: {
      type: "string",
      defaultValue: "Donate via PayPal",
      secret: false,
    },
    btcpayServerUrl: {
      type: "string",
      defaultValue: "",
      secret: true,
    },
    btcpayStoreId: {
      type: "string",
      defaultValue: "",
      secret: true,
    },
    btcpayApiKey: {
      type: "string",
      defaultValue: "",
      secret: true,
      obscured: true,
    },
    btcpayWebhookSecret: {
      type: "string",
      defaultValue: "",
      secret: true,
      obscured: true,
    },
    btcpayInvoiceExpirationMinutes: {
      type: "number",
      defaultValue: "30",
      secret: false,
    },
    note: {
      type: "text",
      defaultValue:
        "Donations help cover storage and bandwidth for your group. They are optional and never required to keep using DropShare.",
      secret: false,
    },
  },
  cache: {
    "redis-enabled": {
      type: "boolean",
      defaultValue: "false",
    },
    "redis-url": {
      type: "string",
      defaultValue: "redis://dropshare-redis:6379",
      secret: true,
    },
    ttl: {
      type: "number",
      defaultValue: "60",
    },
    maxItems: {
      type: "number",
      defaultValue: "1000",
    },
  },
  email: {
    // Require a 6-digit emailed code for password sign-ins that don't have TOTP.
    // Break-glass: turn off if email delivery breaks so users aren't locked out.
    loginVerification: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
    enableShareEmailRecipients: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    shareRecipientsSubject: {
      type: "string",
      defaultValue: "Files shared with you",
    },
    shareRecipientsMessage: {
      type: "text",
      defaultValue:
        "Hey!\n\n{creator} ({creatorEmail}) shared some files with you. You can view or download the files with this link: {shareUrl}\n\nThe share will expire {expires}.\n\nNote: {desc}\n\nShared securely with DropShare",
    },
    reverseShareSubject: {
      type: "string",
      defaultValue: "Reverse share link used",
    },
    reverseShareMessage: {
      type: "text",
      defaultValue:
        "Hey!\n\nA share was just created with your reverse share link: {shareUrl}\n\nShared securely with DropShare",
    },
    resetPasswordSubject: {
      type: "string",
      defaultValue: "DropShare password reset",
    },
    resetPasswordMessage: {
      type: "text",
      defaultValue:
        "Hey!\n\nYou requested a password reset. Click this link to reset your password: {url}\nThe link expires in an hour.\n\nDropShare",
    },
    inviteSubject: {
      type: "string",
      defaultValue: "DropShare invite",
    },
    inviteMessage: {
      type: "text",
      defaultValue:
        'Hey!\n\nYou were invited to DropShare. Click this link to accept the invite: {url}\n\nYou can use the email "{email}" and the password "{password}" to sign in.\n\nDropShare',
    },
  },
  smtp: {
    enabled: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    allowUnauthorizedCertificates: {
      type: "boolean",
      defaultValue: "false",

      secret: false,
    },
    host: {
      type: "string",
      defaultValue: "",
    },
    port: {
      type: "number",
      defaultValue: "0",
    },
    email: {
      type: "string",
      defaultValue: "",
    },
    username: {
      type: "string",
      defaultValue: "",
    },
    password: {
      type: "string",
      defaultValue: "",
      obscured: true,
    },
  },
  ldap: {
    enabled: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },

    url: {
      type: "string",
      defaultValue: "",
    },

    bindDn: {
      type: "string",
      defaultValue: "",
    },
    bindPassword: {
      type: "string",
      defaultValue: "",
      obscured: true,
    },

    searchBase: {
      type: "string",
      defaultValue: "",
    },
    searchQuery: {
      type: "string",
      defaultValue: "",
    },

    adminGroups: {
      type: "string",
      defaultValue: "",
    },

    fieldNameMemberOf: {
      type: "string",
      defaultValue: "memberOf",
    },
    fieldNameEmail: {
      type: "string",
      defaultValue: "userPrincipalName",
    },
  },
  oauth: {
    allowRegistration: {
      type: "boolean",
      defaultValue: "true",
    },
    ignoreTotp: {
      type: "boolean",
      defaultValue: "true",
    },
    disablePassword: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    "github-enabled": {
      type: "boolean",
      defaultValue: "false",
    },
    "github-clientId": {
      type: "string",
      defaultValue: "",
    },
    "github-clientSecret": {
      type: "string",
      defaultValue: "",
      obscured: true,
    },
    "google-enabled": {
      type: "boolean",
      defaultValue: "false",
    },
    "google-clientId": {
      type: "string",
      defaultValue: "",
    },
    "google-clientSecret": {
      type: "string",
      defaultValue: "",
      obscured: true,
    },
    "microsoft-enabled": {
      type: "boolean",
      defaultValue: "false",
    },
    "microsoft-tenant": {
      type: "string",
      defaultValue: "common",
    },
    "microsoft-clientId": {
      type: "string",
      defaultValue: "",
    },
    "microsoft-clientSecret": {
      type: "string",
      defaultValue: "",
      obscured: true,
    },
    "discord-enabled": {
      type: "boolean",
      defaultValue: "false",
    },
    "discord-limitedGuild": {
      type: "string",
      defaultValue: "",
    },
    "discord-limitedUsers": {
      type: "string",
      defaultValue: "",
    },
    "discord-clientId": {
      type: "string",
      defaultValue: "",
    },
    "discord-clientSecret": {
      type: "string",
      defaultValue: "",
      obscured: true,
    },
    "oidc-enabled": {
      type: "boolean",
      defaultValue: "false",
    },
    "oidc-discoveryUri": {
      type: "string",
      defaultValue: "",
    },
    "oidc-signOut": {
      type: "boolean",
      defaultValue: "false",
    },
    "oidc-scope": {
      type: "string",
      defaultValue: "openid email profile",
    },
    "oidc-usernameClaim": {
      type: "string",
      defaultValue: "",
    },
    "oidc-rolePath": {
      type: "string",
      defaultValue: "",
    },
    "oidc-roleGeneralAccess": {
      type: "string",
      defaultValue: "",
    },
    "oidc-roleAdminAccess": {
      type: "string",
      defaultValue: "",
    },
    "oidc-clientId": {
      type: "string",
      defaultValue: "",
    },
    "oidc-clientSecret": {
      type: "string",
      defaultValue: "",
      obscured: true,
    },
  },
  s3: {
    enabled: {
      type: "boolean",
      defaultValue: "false",
    },
    endpoint: {
      type: "string",
      defaultValue: "",
    },
    region: {
      type: "string",
      defaultValue: "",
    },
    bucketName: {
      type: "string",
      defaultValue: "",
    },
    bucketPath: {
      type: "string",
      defaultValue: "",
    },
    publicUrl: {
      type: "string",
      defaultValue: "",
      secret: false,
    },
    allowPublicUrlAccess: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    key: {
      type: "string",
      defaultValue: "",
      secret: true,
    },
    secret: {
      type: "string",
      defaultValue: "",
      obscured: true,
    },
    useChecksum: {
      type: "boolean",
      defaultValue: "true",
    },
  },
  legal: {
    enabled: {
      type: "boolean",
      defaultValue: "false",
      secret: false,
    },
    termsOfServiceEnabled: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
    privacyPolicyEnabled: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
    dmcaEnabled: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
    contactEnabled: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
    // Where the Contact & Reporting tab sends people. Empty by default so a new
    // install never routes its users' support or abuse mail to someone else --
    // each card is hidden until its address is filled in.
    supportEmail: {
      type: "string",
      defaultValue: "",
      secret: false,
    },
    abuseEmail: {
      type: "string",
      defaultValue: "",
      secret: false,
    },
    imprintEnabled: {
      type: "boolean",
      defaultValue: "true",
      secret: false,
    },
    imprintText: {
      type: "text",
      defaultValue: "",
      secret: false,
    },
    imprintUrl: {
      type: "string",
      defaultValue: "",
      secret: false,
    },
    privacyPolicyText: {
      type: "text",
      defaultValue: defaultPrivacyPolicyText,
      secret: false,
    },
    privacyPolicyUrl: {
      type: "string",
      defaultValue: "",
      secret: false,
    },
    termsOfServiceText: {
      type: "text",
      defaultValue: defaultTermsOfServiceText,
      secret: false,
    },
    dmcaText: {
      type: "text",
      defaultValue: defaultDmcaText,
      secret: false,
    },
  },
} satisfies ConfigVariables;

export type YamlConfig = {
  [Category in keyof typeof configVariables]: {
    [Key in keyof (typeof configVariables)[Category]]: string;
  };
} & {
  initUser: {
    enabled: string;
    username: string;
    email: string;
    password: string;
    isAdmin: boolean;
    ldapDN: string;
  };
};

type ConfigVariables = {
  [category: string]: {
    [variable: string]: Omit<
      Prisma.ConfigCreateInput,
      "name" | "category" | "order"
    >;
  };
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        "file:../data/dropshare.db?connection_limit=1",
    },
  },
});

async function seedConfigVariables() {
  for (const [category, configVariablesOfCategory] of Object.entries(
    configVariables,
  )) {
    let order = 0;
    for (const [name, properties] of Object.entries(
      configVariablesOfCategory,
    )) {
      const existingConfigVariable = await prisma.config.findUnique({
        where: { name_category: { name, category } },
      });

      // Create a new config variable if it doesn't exist
      if (!existingConfigVariable) {
        await prisma.config.create({
          data: {
            order,
            name,
            ...properties,
            category,
          },
        });
      }
      order++;
    }
  }
}

async function migrateConfigVariables() {
  const existingConfigVariables = await prisma.config.findMany();
  const orderMap: { [category: string]: number } = {};

  for (const existingConfigVariable of existingConfigVariables) {
    const configVariable =
      configVariables[existingConfigVariable.category]?.[
        existingConfigVariable.name
      ];

    // Delete the config variable if it doesn't exist in the seed
    if (!configVariable) {
      await prisma.config.delete({
        where: {
          name_category: {
            name: existingConfigVariable.name,
            category: existingConfigVariable.category,
          },
        },
      });

      // Update the config variable if it exists in the seed
    } else {
      const variableOrder = Object.keys(
        configVariables[existingConfigVariable.category],
      ).indexOf(existingConfigVariable.name);
      await prisma.config.update({
        where: {
          name_category: {
            name: existingConfigVariable.name,
            category: existingConfigVariable.category,
          },
        },
        data: {
          ...configVariable,
          name: existingConfigVariable.name,
          category: existingConfigVariable.category,
          value: existingConfigVariable.value,
          order: variableOrder,
        },
      });
      orderMap[existingConfigVariable.category] = variableOrder + 1;
    }
  }
}

seedConfigVariables()
  .then(() => migrateConfigVariables())
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
