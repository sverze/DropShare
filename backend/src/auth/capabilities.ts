import { User } from "@prisma/client";

export type Capability =
  | "stats.view"
  | "shares.view"
  | "shares.edit"
  | "shares.delete"
  | "shares.zip"
  | "users.view"
  | "users.edit"
  | "users.password"
  | "users.limits"
  | "users.create"
  | "users.delete"
  | "users.ban"
  | "users.totpReset"
  | "groups.manage"
  | "invites.manage"
  | "security.view"
  | "security.manage"
  | "emails.view"
  | "emails.edit"
  | "emails.send"
  | "logs.view"
  | "logs.delete"
  | "storage.view"
  | "storage.clear"
  | "previews.manage"
  | "uploadLimits.manage"
  | "donations.manage"
  | "config.general"
  | "config.email"
  | "config.share"
  | "config.donations"
  | "config.smtp"
  | "config.oauth"
  | "config.ldap"
  | "config.s3"
  | "config.legal"
  | "config.cache"
  | "config.banners";

export const CONFIG_CATEGORY_CAPABILITIES: Record<string, Capability> = {
  general: "config.general",
  email: "config.email",
  share: "config.share",
  donations: "config.donations",
  smtp: "config.smtp",
  oauth: "config.oauth",
  ldap: "config.ldap",
  s3: "config.s3",
  legal: "config.legal",
  cache: "config.cache",
  banners: "config.banners",
};

export const CAPABILITY_GROUPS: {
  category: string;
  capabilities: [Capability, string][];
}[] = [
  {
    category: "User management pages",
    capabilities: [
      ["users.view", "User Accounts - view the users list & open the page"],
      ["groups.manage", "User Groups - create groups & manage memberships"],
      ["invites.manage", "Invite Codes - create & manage invite codes"],
      [
        "security.view",
        "Share Security - view security events, the scan queue & IP activity",
      ],
    ],
  },
  {
    category: "Statistics",
    capabilities: [["stats.view", "View statistics & export the report"]],
  },
  {
    category: "Shares",
    capabilities: [
      ["shares.view", "View all shares"],
      ["shares.edit", "Edit any share (files, details, complete/relock)"],
      ["shares.delete", "Delete any share (also needs Edit)"],
      ["shares.zip", "Regenerate & manage zip archives"],
    ],
  },
  {
    category: "User account actions",
    capabilities: [
      ["users.edit", "Edit user details (username / email)"],
      ["users.password", "Reset user passwords"],
      ["users.limits", "Adjust per-user limits"],
      ["users.create", "Create users"],
      ["users.delete", "Delete users"],
      ["users.ban", "Ban / suspend users & force logout"],
      ["users.totpReset", "Reset a user's two-factor auth"],
    ],
  },
  {
    category: "Share security actions",
    capabilities: [
      ["security.manage", "Manage rate limits, IP bans & relock shares"],
    ],
  },
  {
    category: "Email center",
    capabilities: [
      ["emails.view", "View templates & email logs"],
      ["emails.edit", "Create & edit templates"],
      ["emails.send", "Send test emails & broadcasts"],
    ],
  },
  {
    category: "Request logs",
    capabilities: [
      ["logs.view", "View request logs"],
      ["logs.delete", "Delete / clear request logs"],
    ],
  },
  {
    category: "Storage",
    capabilities: [
      ["storage.view", "View storage health & reconciliation"],
      ["storage.clear", "Clear the source cache"],
    ],
  },
  {
    category: "Preview processing",
    capabilities: [["previews.manage", "View & enqueue preview processing"]],
  },
  {
    category: "Upload-limit requests",
    capabilities: [["uploadLimits.manage", "Approve / decline upload-limit requests"]],
  },
  {
    category: "Site configuration pages",
    capabilities: [
      ["config.general", "General - site name, appearance, logo & limits"],
      ["config.email", "Email - message content & sender options"],
      ["config.share", "Share - upload rules, sizes & expiry"],
      ["config.legal", "Legal - terms, privacy, DMCA & contact details"],
      ["config.donations", "Donations - donation panel & wallet details"],
      ["config.cache", "Cache - cache behaviour & purging"],
      [
        "config.smtp",
        "SMTP - mail server settings INCLUDING the password. A holder can read and send site mail.",
      ],
      [
        "config.oauth",
        "OAuth - provider client IDs and secrets. A holder can alter how people sign in.",
      ],
      [
        "config.ldap",
        "LDAP - directory settings including the bind password.",
      ],
      [
        "config.s3",
        "S3 - object storage endpoint, bucket and access keys. A holder can reach stored files.",
      ],
    ],
  },
  {
    category: "Banners",
    capabilities: [
      [
        "config.banners",
        "Banners - create & edit the site-wide notices shown to every visitor",
      ],
    ],
  },
  {
    category: "Donations",
    capabilities: [["donations.manage", "View & manage donations"]],
  },
];

export const CAPABILITIES = Object.fromEntries(
  CAPABILITY_GROUPS.flatMap((g) => g.capabilities),
) as Record<Capability, string>;

export const CAPABILITY_KEYS = Object.keys(CAPABILITIES) as Capability[];

export function parseCapabilityMap(
  raw: string | null | undefined,
): Partial<Record<Capability, boolean>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function effectiveCapabilities(
  user: Pick<User, "isAdmin" | "role"> | null | undefined,
  managerCapabilitiesRaw: string | null | undefined,
): Capability[] {
  if (!user) return [];
  if (user.isAdmin) return [...CAPABILITY_KEYS];
  if (user.role === "manager") {
    const map = parseCapabilityMap(managerCapabilitiesRaw);
    return CAPABILITY_KEYS.filter((k) => map[k] === true);
  }
  return [];
}

export function hasCapability(
  user: Pick<User, "isAdmin" | "role"> | null | undefined,
  capability: Capability,
  managerCapabilitiesRaw: string | null | undefined,
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (user.role !== "manager") return false;
  return parseCapabilityMap(managerCapabilitiesRaw)[capability] === true;
}
