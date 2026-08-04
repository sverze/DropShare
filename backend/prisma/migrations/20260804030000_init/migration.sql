-- Initial schema for DropShare.
--
-- Squashed from the fork's migration history at the 2.0.0 release: it creates
-- the schema and seeds the Config table, the only table the old migrations
-- populated.
--
-- The seed covers every key defined in prisma/seed/config.seed.ts, not just the
-- subset the historical migrations happened to insert. Nothing writes these
-- rows at runtime: ConfigService reads fall back to the in-code defaults, but
-- saving a setting looks the row up first and throws without it, so a partial
-- seed leaves those settings visible in the admin UI and impossible to change.

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'user',
    "ldapDN" TEXT,
    "avatar" TEXT,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "canCreateShares" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "maxFileSizeOverride" BIGINT,
    "bannedAt" DATETIME,
    "bannedUntil" DATETIME,
    "banReason" TEXT,
    "bannedById" TEXT,
    "tokensValidAfter" DATETIME,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpVerified" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT
);

-- CreateTable
CREATE TABLE "UserShareThemeColor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "UserShareThemeColor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "shareSizeLimit" BIGINT
);

-- CreateTable
CREATE TABLE "GroupDonation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerInvoiceId" TEXT,
    "txHash" TEXT,
    "currency" TEXT NOT NULL,
    "amountCrypto" TEXT,
    "amountUsd" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" TEXT,
    CONSTRAINT "GroupDonation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupDonation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserGroupMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "allowEditShares" BOOLEAN NOT NULL DEFAULT false,
    "canEditShareThemeColor" BOOLEAN NOT NULL DEFAULT false,
    "canEditShareName" BOOLEAN NOT NULL DEFAULT false,
    "canEditShareDescription" BOOLEAN NOT NULL DEFAULT false,
    "canEditShareFileOrder" BOOLEAN NOT NULL DEFAULT false,
    "canAddFiles" BOOLEAN NOT NULL DEFAULT false,
    "canRemoveFiles" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "UserGroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserGroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "createdById" TEXT,
    "groupId" TEXT,
    CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InviteCode_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UploadLimitRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "requestedLimit" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" DATETIME,
    "processedBy" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "UploadLimitRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "deviceType" TEXT NOT NULL DEFAULT 'singleDevice',
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "transports" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "oauthIDToken" TEXT,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginToken" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "emailCodeHash" TEXT,
    "emailCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LoginToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResetPasswordToken" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ResetPasswordToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OAuthUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerUsername" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "OAuthUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "uploadLocked" BOOLEAN NOT NULL DEFAULT false,
    "isZipReady" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "expiration" DATETIME NOT NULL,
    "description" TEXT,
    "removedReason" TEXT,
    "accentColor" TEXT,
    "previewStyle" TEXT NOT NULL DEFAULT 'full',
    "groupId" TEXT,
    "virusScanStatus" TEXT NOT NULL DEFAULT 'not_scanned',
    "virusScanStartedAt" DATETIME,
    "virusScanCompletedAt" DATETIME,
    "virusScanThreats" TEXT,
    "virusScanError" TEXT,
    "creatorId" TEXT,
    "reverseShareId" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
    CONSTRAINT "Share_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Share_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Share_reverseShareId_fkey" FOREIGN KEY ("reverseShareId") REFERENCES "ReverseShare" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shareId" TEXT,
    "shareName" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "actorId" TEXT,
    "actorUsername" TEXT,
    CONSTRAINT "ShareActivity_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReverseShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "name" TEXT,
    "shareExpiration" DATETIME NOT NULL,
    "maxShareSize" TEXT NOT NULL,
    "sendEmailNotification" BOOLEAN NOT NULL,
    "remainingUses" INTEGER NOT NULL,
    "maxUseCount" INTEGER,
    "simplified" BOOLEAN NOT NULL DEFAULT false,
    "publicAccess" BOOLEAN NOT NULL DEFAULT true,
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "ReverseShare_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    CONSTRAINT "ShareRecipient_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "previewGroup" BOOLEAN NOT NULL DEFAULT true,
    "previewHeader" TEXT,
    "relativePath" TEXT,
    "lyricsText" TEXT,
    "lyricsSource" TEXT,
    "lyricsSourceUrl" TEXT,
    "lyricsSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lyricsSyncedAt" DATETIME,
    "lyricsSyncStatus" TEXT NOT NULL DEFAULT 'not_synced',
    "lyricsSyncError" TEXT,
    "storageLocation" TEXT NOT NULL DEFAULT 's3',
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "virusScanStatus" TEXT NOT NULL DEFAULT 'not_scanned',
    "virusScanStartedAt" DATETIME,
    "virusScanCompletedAt" DATETIME,
    "virusScanThreats" TEXT,
    "virusScanError" TEXT,
    "videoPreviewStatus" TEXT NOT NULL DEFAULT 'not_started',
    "videoPreviewStartedAt" DATETIME,
    "videoPreviewCompletedAt" DATETIME,
    "videoPreviewError" TEXT,
    "videoPreviewQualities" TEXT,
    "videoPreviewDuration" REAL,
    "metadata" TEXT,
    "metadataStatus" TEXT NOT NULL DEFAULT 'not_started',
    "metadataStartedAt" DATETIME,
    "metadataCompletedAt" DATETIME,
    "metadataError" TEXT,
    "shareId" TEXT NOT NULL,
    CONSTRAINT "File_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareSecurity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password" TEXT,
    "maxViews" INTEGER,
    "shareId" TEXT,
    CONSTRAINT "ShareSecurity_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Config" (
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "defaultValue" TEXT NOT NULL DEFAULT '',
    "value" TEXT,
    "obscured" BOOLEAN NOT NULL DEFAULT false,
    "secret" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    PRIMARY KEY ("name", "category")
);

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "ipAddressFull" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER,
    "userAgent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "responseTime" INTEGER,
    "country" TEXT
);

-- CreateTable
CREATE TABLE "BlockedIp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "note" TEXT,
    "expiresAt" DATETIME,
    "userId" TEXT,
    "bannedById" TEXT
);

-- CreateTable
CREATE TABLE "RateLimitExemptIp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "ShareSecurityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "shareId" TEXT,
    "fileId" TEXT,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "userAgent" TEXT
);

-- CreateTable
CREATE TABLE "ShareEngagementEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "shareId" TEXT
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT NOT NULL DEFAULT 'dropshare',
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT,
    "recipientId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_ldapDN_key" ON "User"("ldapDN");

-- CreateIndex
CREATE INDEX "UserShareThemeColor_userId_createdAt_idx" ON "UserShareThemeColor"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserShareThemeColor_userId_color_key" ON "UserShareThemeColor"("userId", "color");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_name_key" ON "UserGroup"("name");

-- CreateIndex
CREATE INDEX "GroupDonation_groupId_idx" ON "GroupDonation"("groupId");

-- CreateIndex
CREATE INDEX "GroupDonation_userId_idx" ON "GroupDonation"("userId");

-- CreateIndex
CREATE INDEX "GroupDonation_status_idx" ON "GroupDonation"("status");

-- CreateIndex
CREATE INDEX "GroupDonation_providerInvoiceId_idx" ON "GroupDonation"("providerInvoiceId");

-- CreateIndex
CREATE INDEX "UserGroupMembership_userId_idx" ON "UserGroupMembership"("userId");

-- CreateIndex
CREATE INDEX "UserGroupMembership_groupId_idx" ON "UserGroupMembership"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroupMembership_userId_groupId_key" ON "UserGroupMembership"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_code_idx" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_isActive_idx" ON "InviteCode"("isActive");

-- CreateIndex
CREATE INDEX "InviteCode_expiresAt_idx" ON "InviteCode"("expiresAt");

-- CreateIndex
CREATE INDEX "InviteCode_groupId_idx" ON "InviteCode"("groupId");

-- CreateIndex
CREATE INDEX "UploadLimitRequest_status_idx" ON "UploadLimitRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UploadLimitRequest_userId_status_key" ON "UploadLimitRequest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ResetPasswordToken_userId_key" ON "ResetPasswordToken"("userId");

-- CreateIndex
CREATE INDEX "ShareActivity_createdAt_idx" ON "ShareActivity"("createdAt");

-- CreateIndex
CREATE INDEX "ShareActivity_shareId_idx" ON "ShareActivity"("shareId");

-- CreateIndex
CREATE INDEX "ShareActivity_action_idx" ON "ShareActivity"("action");

-- CreateIndex
CREATE UNIQUE INDEX "ReverseShare_token_key" ON "ReverseShare"("token");

-- CreateIndex
CREATE INDEX "File_storageLocation_lastAccessedAt_idx" ON "File"("storageLocation", "lastAccessedAt");

-- CreateIndex
CREATE INDEX "File_videoPreviewStatus_idx" ON "File"("videoPreviewStatus");

-- CreateIndex
CREATE INDEX "File_metadataStatus_idx" ON "File"("metadataStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ShareSecurity_shareId_key" ON "ShareSecurity"("shareId");

-- CreateIndex
CREATE INDEX "RequestLog_createdAt_idx" ON "RequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_ipAddress_idx" ON "RequestLog"("ipAddress");

-- CreateIndex
CREATE INDEX "RequestLog_userId_idx" ON "RequestLog"("userId");

-- CreateIndex
CREATE INDEX "RequestLog_path_idx" ON "RequestLog"("path");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedIp_ipAddress_key" ON "BlockedIp"("ipAddress");

-- CreateIndex
CREATE INDEX "BlockedIp_createdAt_idx" ON "BlockedIp"("createdAt");

-- CreateIndex
CREATE INDEX "BlockedIp_expiresAt_idx" ON "BlockedIp"("expiresAt");

-- CreateIndex
CREATE INDEX "BlockedIp_userId_idx" ON "BlockedIp"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitExemptIp_ipAddress_key" ON "RateLimitExemptIp"("ipAddress");

-- CreateIndex
CREATE INDEX "RateLimitExemptIp_createdAt_idx" ON "RateLimitExemptIp"("createdAt");

-- CreateIndex
CREATE INDEX "ShareSecurityEvent_createdAt_idx" ON "ShareSecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ShareSecurityEvent_ipAddress_idx" ON "ShareSecurityEvent"("ipAddress");

-- CreateIndex
CREATE INDEX "ShareSecurityEvent_outcome_idx" ON "ShareSecurityEvent"("outcome");

-- CreateIndex
CREATE INDEX "ShareSecurityEvent_shareId_idx" ON "ShareSecurityEvent"("shareId");

-- CreateIndex
CREATE INDEX "ShareEngagementEvent_createdAt_idx" ON "ShareEngagementEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ShareEngagementEvent_type_createdAt_idx" ON "ShareEngagementEvent"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_slug_key" ON "EmailTemplate"("slug");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_type_idx" ON "EmailLog"("type");

-- CreateIndex
CREATE INDEX "EmailLog_templateId_idx" ON "EmailLog"("templateId");

-- CreateIndex
CREATE INDEX "EmailLog_recipientId_idx" ON "EmailLog"("recipientId");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");


-- Seed the Config table.
INSERT INTO "Config" ("name", "category", "type", "defaultValue", "value", "obscured", "secret", "locked", "order", "updatedAt")
VALUES
  ('jwtSecret', 'internal', 'string', '', 'amlMQmBY8pigm6UPyaw4gXtb5xOK8aDZe9byiLYEY8gci/xu90Q4X0OPNVZjLI6gpoI30qOw5C39IBAYlELL0U1rDPX1j6oOsHWukin/g/wTXWzfWti7pmNXI04AwZteZcq8djIIrmdTvlJuGPPkk3By7Rv/jh3GXwGZTKkw5c1dEYZY9z+yglDPyQEgHI9P8YIJ27U90YSLIYGJAb39pT2G2EQqTrgsK2gK60j5t1AXbj8qSmm6OnnslZGrqsxQLDXIYxMLQfSalsVLMDMiHyGDPml9m6yeqr/qNH6Y79T9aktMaCFZx5f/2KYex6I2UfEVcwFRYiunYz5CCEUVGA==', false, true, true, 0, CURRENT_TIMESTAMP),
  ('requestLogRetentionDays', 'general', 'number', '30', NULL, false, false, false, 0, CURRENT_TIMESTAMP),
  ('appName', 'general', 'string', 'DropShare', NULL, false, false, false, 1, CURRENT_TIMESTAMP),
  ('appUrl', 'general', 'string', 'http://localhost:3000', NULL, false, false, false, 2, CURRENT_TIMESTAMP),
  ('secureCookies', 'general', 'boolean', 'false', NULL, false, true, false, 3, CURRENT_TIMESTAMP),
  ('showHomePage', 'general', 'boolean', 'true', NULL, false, false, false, 4, CURRENT_TIMESTAMP),
  ('sessionDuration', 'general', 'timespan', '3 months', NULL, false, false, false, 5, CURRENT_TIMESTAMP),
  ('themeDarkAccent', 'general', 'string', '#fb923c', NULL, false, false, false, 6, CURRENT_TIMESTAMP),
  ('themeDarkBackground', 'general', 'string', '#140b04', NULL, false, false, false, 7, CURRENT_TIMESTAMP),
  ('themeDarkHeaderBackground', 'general', 'string', '#261a0f', NULL, false, false, false, 8, CURRENT_TIMESTAMP),
  ('themeDarkHeaderBorder', 'general', 'string', '#fb923c', NULL, false, false, false, 9, CURRENT_TIMESTAMP),
  ('themeDarkLogoText', 'general', 'string', '#ffffff', NULL, false, false, false, 10, CURRENT_TIMESTAMP),
  ('themeDarkLogoAccent', 'general', 'string', '#fb923c', NULL, false, false, false, 11, CURRENT_TIMESTAMP),
  ('themeDarkUploadButton', 'general', 'string', '#fb923c', NULL, false, false, false, 12, CURRENT_TIMESTAMP),
  ('themeDarkBulkUploadButton', 'general', 'string', '#fbbf24', NULL, false, false, false, 13, CURRENT_TIMESTAMP),
  ('themeDarkHomeButton', 'general', 'string', '#fb923c', NULL, false, false, false, 14, CURRENT_TIMESTAMP),
  ('themeDarkPanelBackground', 'general', 'string', '#241a0f', NULL, false, false, false, 15, CURRENT_TIMESTAMP),
  ('themeDarkPanelBorder', 'general', 'string', '#fb923c', NULL, false, false, false, 16, CURRENT_TIMESTAMP),
  ('themeLightAccent', 'general', 'string', '#ea580c', NULL, false, false, false, 17, CURRENT_TIMESTAMP),
  ('themeLightBackground', 'general', 'string', '#fff7ed', NULL, false, false, false, 18, CURRENT_TIMESTAMP),
  ('themeLightHeaderBackground', 'general', 'string', '#ffefdd', NULL, false, false, false, 19, CURRENT_TIMESTAMP),
  ('themeLightHeaderBorder', 'general', 'string', '#ea580c', NULL, false, false, false, 20, CURRENT_TIMESTAMP),
  ('themeLightLogoText', 'general', 'string', '#2a1c10', NULL, false, false, false, 21, CURRENT_TIMESTAMP),
  ('themeLightLogoAccent', 'general', 'string', '#ea580c', NULL, false, false, false, 22, CURRENT_TIMESTAMP),
  ('themeLightUploadButton', 'general', 'string', '#ea580c', NULL, false, false, false, 23, CURRENT_TIMESTAMP),
  ('themeLightBulkUploadButton', 'general', 'string', '#d97706', NULL, false, false, false, 24, CURRENT_TIMESTAMP),
  ('themeLightHomeButton', 'general', 'string', '#ea580c', NULL, false, false, false, 25, CURRENT_TIMESTAMP),
  ('themeLightPanelBackground', 'general', 'string', '#ffffff', NULL, false, false, false, 26, CURRENT_TIMESTAMP),
  ('themeLightPanelBorder', 'general', 'string', '#ea580c', NULL, false, false, false, 27, CURRENT_TIMESTAMP),
  ('themeModalRingOuter', 'general', 'string', '#f97316', NULL, false, false, false, 28, CURRENT_TIMESTAMP),
  ('themeModalRingInner', 'general', 'string', '#f59e0b', NULL, false, false, false, 29, CURRENT_TIMESTAMP),
  ('themeModalRingCenter', 'general', 'string', '#fdba74', NULL, false, false, false, 30, CURRENT_TIMESTAMP),
  ('themeHeaderStyle', 'general', 'string', 'default', NULL, false, false, false, 31, CURRENT_TIMESTAMP),
  ('themeLogoIsOpaque', 'general', 'boolean', 'false', NULL, false, false, false, 32, CURRENT_TIMESTAMP),
  ('themeLogoVersion', 'general', 'string', '1', NULL, false, false, false, 33, CURRENT_TIMESTAMP),
  ('themeSharePresets', 'general', 'text', '[{"color":"#00ff5a","name":"Neon Green"},{"color":"#00d4ff","name":"Electric Blue"},{"color":"#ff6b35","name":"Sunset Orange"},{"color":"#a855f7","name":"Purple Haze"},{"color":"#ff1493","name":"Hot Pink"},{"color":"#fbbf24","name":"Golden"},{"color":"#22d3d6","name":"Cyan"},{"color":"#ef4444","name":"Red Alert"},{"color":"#a9b0ca","name":"Space Grey"}]', NULL, false, false, false, 34, CURRENT_TIMESTAMP),
  ('items', 'banners', 'text', '[]', NULL, false, false, false, 0, CURRENT_TIMESTAMP),
  ('managerCapabilities', 'access', 'text', '{}', NULL, false, true, false, 0, CURRENT_TIMESTAMP),
  ('virusScanEnabled', 'share', 'boolean', 'true', NULL, false, false, false, 0, CURRENT_TIMESTAMP),
  ('allowRegistration', 'share', 'boolean', 'true', NULL, false, false, false, 1, CURRENT_TIMESTAMP),
  ('requireInviteCodeForRegistration', 'share', 'boolean', 'false', NULL, false, false, false, 2, CURRENT_TIMESTAMP),
  ('allowUnauthenticatedShares', 'share', 'boolean', 'false', NULL, false, false, false, 3, CURRENT_TIMESTAMP),
  ('allowUninvitedRegisteredShares', 'share', 'boolean', 'false', NULL, false, false, false, 4, CURRENT_TIMESTAMP),
  ('maxAnonymousExpiration', 'share', 'timespan', '5 days', NULL, false, false, false, 5, CURRENT_TIMESTAMP),
  ('maxUninvitedRegisteredExpiration', 'share', 'timespan', '5 days', NULL, false, false, false, 6, CURRENT_TIMESTAMP),
  ('maxUninvitedRegisteredSize', 'share', 'filesize', '1073741824', NULL, false, false, false, 7, CURRENT_TIMESTAMP),
  ('maxExpiration', 'share', 'timespan', '0 days', NULL, false, false, false, 8, CURRENT_TIMESTAMP),
  ('shareIdLength', 'share', 'number', '15', NULL, false, false, false, 9, CURRENT_TIMESTAMP),
  ('maxSize', 'share', 'filesize', '12000000000', NULL, false, false, false, 10, CURRENT_TIMESTAMP),
  ('maxAnonymousSize', 'share', 'filesize', '7000000000', NULL, false, false, false, 11, CURRENT_TIMESTAMP),
  ('zipCompressionLevel', 'share', 'number', '9', NULL, false, true, false, 12, CURRENT_TIMESTAMP),
  ('chunkSize', 'share', 'filesize', '10000000', NULL, false, false, false, 13, CURRENT_TIMESTAMP),
  ('multipartThreshold', 'share', 'filesize', '50000000', NULL, false, false, false, 14, CURRENT_TIMESTAMP),
  ('autoOpenShareModal', 'share', 'boolean', 'false', NULL, false, false, false, 15, CURRENT_TIMESTAMP),
  ('bulkUploadMode', 'share', 'string', 'page', NULL, false, false, false, 16, CURRENT_TIMESTAMP),
  ('allowReverseShares', 'share', 'boolean', 'true', NULL, false, false, false, 17, CURRENT_TIMESTAMP),
  ('enabled', 'donations', 'boolean', 'false', NULL, false, false, false, 0, CURRENT_TIMESTAMP),
  ('provider', 'donations', 'string', 'btcpay', NULL, false, false, false, 1, CURRENT_TIMESTAMP),
  ('storageCostPerGibMonthUsd', 'donations', 'string', '0.0198', NULL, false, false, false, 2, CURRENT_TIMESTAMP),
  ('serverCostPerMonthUsd', 'donations', 'string', '100', NULL, false, false, false, 3, CURRENT_TIMESTAMP),
  ('btcAddress', 'donations', 'string', '', NULL, false, false, false, 4, CURRENT_TIMESTAMP),
  ('externalUrl', 'donations', 'string', '', NULL, false, false, false, 5, CURRENT_TIMESTAMP),
  ('externalLabel', 'donations', 'string', 'Donate via PayPal', NULL, false, false, false, 6, CURRENT_TIMESTAMP),
  ('btcpayServerUrl', 'donations', 'string', '', NULL, false, true, false, 7, CURRENT_TIMESTAMP),
  ('btcpayStoreId', 'donations', 'string', '', NULL, false, true, false, 8, CURRENT_TIMESTAMP),
  ('btcpayApiKey', 'donations', 'string', '', NULL, true, true, false, 9, CURRENT_TIMESTAMP),
  ('btcpayWebhookSecret', 'donations', 'string', '', NULL, true, true, false, 10, CURRENT_TIMESTAMP),
  ('btcpayInvoiceExpirationMinutes', 'donations', 'number', '30', NULL, false, false, false, 11, CURRENT_TIMESTAMP),
  ('note', 'donations', 'text', 'Donations help cover storage and bandwidth for your group. They are optional and never required to keep using DropShare.', NULL, false, false, false, 12, CURRENT_TIMESTAMP),
  ('redis-enabled', 'cache', 'boolean', 'false', NULL, false, true, false, 0, CURRENT_TIMESTAMP),
  ('redis-url', 'cache', 'string', 'redis://dropshare-redis:6379', NULL, false, true, false, 1, CURRENT_TIMESTAMP),
  ('ttl', 'cache', 'number', '60', NULL, false, true, false, 2, CURRENT_TIMESTAMP),
  ('maxItems', 'cache', 'number', '1000', NULL, false, true, false, 3, CURRENT_TIMESTAMP),
  ('loginVerification', 'email', 'boolean', 'true', NULL, false, false, false, 0, CURRENT_TIMESTAMP),
  ('enableShareEmailRecipients', 'email', 'boolean', 'false', NULL, false, false, false, 1, CURRENT_TIMESTAMP),
  ('shareRecipientsSubject', 'email', 'string', 'Files shared with you', NULL, false, true, false, 2, CURRENT_TIMESTAMP),
  ('shareRecipientsMessage', 'email', 'text', 'Hey!

{creator} ({creatorEmail}) shared some files with you. You can view or download the files with this link: {shareUrl}

The share will expire {expires}.

Note: {desc}

Shared securely with DropShare', NULL, false, true, false, 3, CURRENT_TIMESTAMP),
  ('reverseShareSubject', 'email', 'string', 'Reverse share link used', NULL, false, true, false, 4, CURRENT_TIMESTAMP),
  ('reverseShareMessage', 'email', 'text', 'Hey!

A share was just created with your reverse share link: {shareUrl}

Shared securely with DropShare', NULL, false, true, false, 5, CURRENT_TIMESTAMP),
  ('resetPasswordSubject', 'email', 'string', 'DropShare password reset', NULL, false, true, false, 6, CURRENT_TIMESTAMP),
  ('resetPasswordMessage', 'email', 'text', 'Hey!

You requested a password reset. Click this link to reset your password: {url}
The link expires in an hour.

DropShare', NULL, false, true, false, 7, CURRENT_TIMESTAMP),
  ('inviteSubject', 'email', 'string', 'DropShare invite', NULL, false, true, false, 8, CURRENT_TIMESTAMP),
  ('inviteMessage', 'email', 'text', 'Hey!

You were invited to DropShare. Click this link to accept the invite: {url}

You can use the email "{email}" and the password "{password}" to sign in.

DropShare', NULL, false, true, false, 9, CURRENT_TIMESTAMP),
  ('enabled', 'smtp', 'boolean', 'false', NULL, false, false, false, 0, CURRENT_TIMESTAMP),
  ('allowUnauthorizedCertificates', 'smtp', 'boolean', 'false', NULL, false, false, false, 1, CURRENT_TIMESTAMP),
  ('host', 'smtp', 'string', '', NULL, false, true, false, 2, CURRENT_TIMESTAMP),
  ('port', 'smtp', 'number', '0', NULL, false, true, false, 3, CURRENT_TIMESTAMP),
  ('email', 'smtp', 'string', '', NULL, false, true, false, 4, CURRENT_TIMESTAMP),
  ('username', 'smtp', 'string', '', NULL, false, true, false, 5, CURRENT_TIMESTAMP),
  ('password', 'smtp', 'string', '', NULL, true, true, false, 6, CURRENT_TIMESTAMP),
  ('enabled', 'ldap', 'boolean', 'false', NULL, false, false, false, 0, CURRENT_TIMESTAMP),
  ('url', 'ldap', 'string', '', NULL, false, true, false, 1, CURRENT_TIMESTAMP),
  ('bindDn', 'ldap', 'string', '', NULL, false, true, false, 2, CURRENT_TIMESTAMP),
  ('bindPassword', 'ldap', 'string', '', NULL, true, true, false, 3, CURRENT_TIMESTAMP),
  ('searchBase', 'ldap', 'string', '', NULL, false, true, false, 4, CURRENT_TIMESTAMP),
  ('searchQuery', 'ldap', 'string', '', NULL, false, true, false, 5, CURRENT_TIMESTAMP),
  ('adminGroups', 'ldap', 'string', '', NULL, false, true, false, 6, CURRENT_TIMESTAMP),
  ('fieldNameMemberOf', 'ldap', 'string', 'memberOf', NULL, false, true, false, 7, CURRENT_TIMESTAMP),
  ('fieldNameEmail', 'ldap', 'string', 'userPrincipalName', NULL, false, true, false, 8, CURRENT_TIMESTAMP),
  ('allowRegistration', 'oauth', 'boolean', 'true', NULL, false, true, false, 0, CURRENT_TIMESTAMP),
  ('ignoreTotp', 'oauth', 'boolean', 'true', NULL, false, true, false, 1, CURRENT_TIMESTAMP),
  ('disablePassword', 'oauth', 'boolean', 'false', NULL, false, false, false, 2, CURRENT_TIMESTAMP),
  ('github-enabled', 'oauth', 'boolean', 'false', NULL, false, true, false, 3, CURRENT_TIMESTAMP),
  ('github-clientId', 'oauth', 'string', '', NULL, false, true, false, 4, CURRENT_TIMESTAMP),
  ('github-clientSecret', 'oauth', 'string', '', NULL, true, true, false, 5, CURRENT_TIMESTAMP),
  ('google-enabled', 'oauth', 'boolean', 'false', NULL, false, true, false, 6, CURRENT_TIMESTAMP),
  ('google-clientId', 'oauth', 'string', '', NULL, false, true, false, 7, CURRENT_TIMESTAMP),
  ('google-clientSecret', 'oauth', 'string', '', NULL, true, true, false, 8, CURRENT_TIMESTAMP),
  ('microsoft-enabled', 'oauth', 'boolean', 'false', NULL, false, true, false, 9, CURRENT_TIMESTAMP),
  ('microsoft-tenant', 'oauth', 'string', 'common', NULL, false, true, false, 10, CURRENT_TIMESTAMP),
  ('microsoft-clientId', 'oauth', 'string', '', NULL, false, true, false, 11, CURRENT_TIMESTAMP),
  ('microsoft-clientSecret', 'oauth', 'string', '', NULL, true, true, false, 12, CURRENT_TIMESTAMP),
  ('discord-enabled', 'oauth', 'boolean', 'false', NULL, false, true, false, 13, CURRENT_TIMESTAMP),
  ('discord-limitedGuild', 'oauth', 'string', '', NULL, false, true, false, 14, CURRENT_TIMESTAMP),
  ('discord-limitedUsers', 'oauth', 'string', '', NULL, false, true, false, 15, CURRENT_TIMESTAMP),
  ('discord-clientId', 'oauth', 'string', '', NULL, false, true, false, 16, CURRENT_TIMESTAMP),
  ('discord-clientSecret', 'oauth', 'string', '', NULL, true, true, false, 17, CURRENT_TIMESTAMP),
  ('oidc-enabled', 'oauth', 'boolean', 'false', NULL, false, true, false, 18, CURRENT_TIMESTAMP),
  ('oidc-discoveryUri', 'oauth', 'string', '', NULL, false, true, false, 19, CURRENT_TIMESTAMP),
  ('oidc-signOut', 'oauth', 'boolean', 'false', NULL, false, true, false, 20, CURRENT_TIMESTAMP),
  ('oidc-scope', 'oauth', 'string', 'openid email profile', NULL, false, true, false, 21, CURRENT_TIMESTAMP),
  ('oidc-usernameClaim', 'oauth', 'string', '', NULL, false, true, false, 22, CURRENT_TIMESTAMP),
  ('oidc-rolePath', 'oauth', 'string', '', NULL, false, true, false, 23, CURRENT_TIMESTAMP),
  ('oidc-roleGeneralAccess', 'oauth', 'string', '', NULL, false, true, false, 24, CURRENT_TIMESTAMP),
  ('oidc-roleAdminAccess', 'oauth', 'string', '', NULL, false, true, false, 25, CURRENT_TIMESTAMP),
  ('oidc-clientId', 'oauth', 'string', '', NULL, false, true, false, 26, CURRENT_TIMESTAMP),
  ('oidc-clientSecret', 'oauth', 'string', '', NULL, true, true, false, 27, CURRENT_TIMESTAMP),
  ('enabled', 's3', 'boolean', 'false', NULL, false, true, false, 0, CURRENT_TIMESTAMP),
  ('endpoint', 's3', 'string', '', NULL, false, true, false, 1, CURRENT_TIMESTAMP),
  ('region', 's3', 'string', '', NULL, false, true, false, 2, CURRENT_TIMESTAMP),
  ('bucketName', 's3', 'string', '', NULL, false, true, false, 3, CURRENT_TIMESTAMP),
  ('bucketPath', 's3', 'string', '', NULL, false, true, false, 4, CURRENT_TIMESTAMP),
  ('publicUrl', 's3', 'string', '', NULL, false, false, false, 5, CURRENT_TIMESTAMP),
  ('allowPublicUrlAccess', 's3', 'boolean', 'false', NULL, false, false, false, 6, CURRENT_TIMESTAMP),
  ('key', 's3', 'string', '', NULL, false, true, false, 7, CURRENT_TIMESTAMP),
  ('secret', 's3', 'string', '', NULL, true, true, false, 8, CURRENT_TIMESTAMP),
  ('useChecksum', 's3', 'boolean', 'true', NULL, false, true, false, 9, CURRENT_TIMESTAMP),
  ('enabled', 'legal', 'boolean', 'false', NULL, false, false, false, 0, CURRENT_TIMESTAMP),
  ('termsOfServiceEnabled', 'legal', 'boolean', 'true', NULL, false, false, false, 1, CURRENT_TIMESTAMP),
  ('privacyPolicyEnabled', 'legal', 'boolean', 'true', NULL, false, false, false, 2, CURRENT_TIMESTAMP),
  ('dmcaEnabled', 'legal', 'boolean', 'true', NULL, false, false, false, 3, CURRENT_TIMESTAMP),
  ('contactEnabled', 'legal', 'boolean', 'true', NULL, false, false, false, 4, CURRENT_TIMESTAMP),
  ('supportEmail', 'legal', 'string', '', NULL, false, false, false, 5, CURRENT_TIMESTAMP),
  ('abuseEmail', 'legal', 'string', '', NULL, false, false, false, 6, CURRENT_TIMESTAMP),
  ('imprintEnabled', 'legal', 'boolean', 'true', NULL, false, false, false, 7, CURRENT_TIMESTAMP),
  ('imprintText', 'legal', 'text', '', NULL, false, false, false, 8, CURRENT_TIMESTAMP),
  ('imprintUrl', 'legal', 'string', '', NULL, false, false, false, 9, CURRENT_TIMESTAMP),
  ('privacyPolicyText', 'legal', 'text', '## 1. Information We Collect

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

## 6. Children''s Privacy

Our Service is not intended for children under 13 years of age. We do not knowingly collect
personal information from children under 13.', NULL, false, false, false, 10, CURRENT_TIMESTAMP),
  ('privacyPolicyUrl', 'legal', 'string', '', NULL, false, false, false, 11, CURRENT_TIMESTAMP),
  ('termsOfServiceText', 'legal', 'text', '## 1. Acceptance of Terms

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
', NULL, false, false, false, 12, CURRENT_TIMESTAMP),
  ('dmcaText', 'legal', 'text', '## Copyright Policy

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
5. A statement that you consent to the jurisdiction of the Federal District Court for your judicial district, or if you are outside the United States, for any judicial district in which the service provider may be found, and that you will accept service of process from the person who submitted the original notice or that person''s agent

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
context to identify the material, and a clear description of the issue.', NULL, false, false, false, 13, CURRENT_TIMESTAMP)
ON CONFLICT ("name", "category") DO NOTHING;
