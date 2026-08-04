export const BANNER_VARIANTS = [
  "info",
  "success",
  "warning",
  "danger",
  "accent",
] as const;

export type BannerVariant = (typeof BANNER_VARIANTS)[number];

export type BannerLink = {
  label: string;
  href: string;
};

export type Banner = {
  id: string;
  enabled: boolean;
  /** Optional bold heading above the message. Empty string hides it. */
  title: string;
  message: string;
  variant: BannerVariant;
  links: BannerLink[];
  /**
   * Route patterns this banner shows on. `"*"` matches everywhere; a trailing
   * `/*` matches a subtree (`/share/*`); anything else is an exact path match.
   */
  pages: string[];
  /** Lets a visitor close it. Dismissals are remembered per banner id. */
  dismissible: boolean;
  /** ISO date strings. Empty means unbounded in that direction. */
  startsAt: string;
  endsAt: string;
};

export const PAGE_TARGETS: { value: string; label: string }[] = [
  { value: "*", label: "Every page" },
  { value: "/", label: "Home" },
  { value: "/upload/*", label: "Upload pages" },
  { value: "/share/*", label: "Share pages" },
  { value: "/account/*", label: "Account pages" },
  { value: "/auth/*", label: "Sign in / sign up" },
  { value: "/admin/*", label: "Admin pages" },
];
