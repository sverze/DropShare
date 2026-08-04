type CapabilityUser =
  | { isAdmin?: boolean; capabilities?: string[] | null }
  | null
  | undefined;

const ADMIN_ROUTE_CAPABILITIES: [string, string | string[]][] = [
  ["/admin/stats", "stats.view"],
  ["/admin/logs", "logs.view"],
  ["/admin/share-security", "security.view"],
  ["/admin/previews", "previews.manage"],
  ["/admin/emails", "emails.view"],
  [
    "/admin/users",
    ["users.view", "groups.manage", "invites.manage", "security.view"],
  ],
  [
    "/admin/shares",
    ["shares.view", "shares.zip", "security.view", "previews.manage"],
  ],
  ["/admin/zip-management", "shares.zip"],
  ["/admin/banners", "config.banners"],
];

export const CONFIG_CATEGORY_CAPABILITIES: Record<string, string> = {
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
};

export function accessibleConfigCategories(user: CapabilityUser): string[] {
  const all = Object.keys(CONFIG_CATEGORY_CAPABILITIES);
  if (!user) return [];
  if (user.isAdmin) return all;
  return all.filter((c) =>
    user.capabilities?.includes(CONFIG_CATEGORY_CAPABILITIES[c]),
  );
}

export function hasCapability(
  user: CapabilityUser,
  capability: string,
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return !!user.capabilities?.includes(capability);
}

export function canAccessAdmin(user: CapabilityUser): boolean {
  if (!user) return false;
  return !!user.isAdmin || (user.capabilities?.length ?? 0) > 0;
}

export function canAccessAdminRoute(
  user: CapabilityUser,
  route: string | undefined | null,
): boolean {
  if (!route || !route.startsWith("/admin")) return true;
  if (!user) return false;
  if (user.isAdmin) return true;

  const path = route.split("?")[0];
  if (path === "/admin" || path === "/admin/") return canAccessAdmin(user);

  if (path.startsWith("/admin/config")) {
    const category = path.split("/")[3];
    if (!category) return accessibleConfigCategories(user).length > 0;
    const needed = CONFIG_CATEGORY_CAPABILITIES[category];
    return !!needed && !!user.capabilities?.includes(needed);
  }

  const match = ADMIN_ROUTE_CAPABILITIES.find(
    ([p]) => path === p || path.startsWith(p + "/"),
  );
  if (!match) return false;
  const needed = Array.isArray(match[1]) ? match[1] : [match[1]];
  return needed.some((cap) => !!user.capabilities?.includes(cap));
}
