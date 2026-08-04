import { Banner, BANNER_VARIANTS, BannerLink, BannerVariant } from "../types/banner.type";

const DISMISS_KEY = "dropshare.dismissedBanners";

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asBool = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

const asVariant = (value: unknown): BannerVariant =>
  BANNER_VARIANTS.includes(value as BannerVariant)
    ? (value as BannerVariant)
    : "info";

/**
 * Banner links are authored by an admin *or* by a Manager holding
 * `config.banners`, and render for every visitor, so an unchecked href is
 * stored XSS, and a lower-privileged Manager could aim it at an admin.
 * `javascript:` is the obvious payload; React only warns on those, it does not
 * block them.
 *
 * Allowed: site-relative paths, http(s), and mailto. Everything else is dropped.
 */
export const isSafeHref = (href: string): boolean => {
  // Browsers ignore control characters and whitespace inside a scheme, so
  // "java\tscript:alert(1)" still executes. Strip them before testing.
  // Done by code point rather than a regex range: a control-character class
  // trips ESLint's no-control-regex, which fails the Next build.
  const normalised = Array.from(href)
    .filter((char) => char.charCodeAt(0) > 0x20)
    .join("");
  if (!normalised) return false;

  // "//evil.com" reads as site-relative but is protocol-relative, i.e. external.
  if (normalised.startsWith("//")) return false;
  if (normalised.startsWith("/")) return true;

  return /^(https?:|mailto:)/i.test(normalised);
};

const asLinks = (value: unknown): BannerLink[] =>
  Array.isArray(value)
    ? value
        .map((l) => ({
          label: asString((l as BannerLink)?.label),
          href: asString((l as BannerLink)?.href).trim(),
        }))
        .filter((l) => l.label && l.href && isSafeHref(l.href))
    : [];

/**
 * Banners come from an admin-edited JSON config, so every field is treated as
 * untrusted: a malformed row is coerced to something renderable rather than
 * throwing and taking the whole page down with it.
 */
export const parseBanners = (raw: unknown): Banner[] => {
  let source: unknown = raw;

  if (typeof raw === "string") {
    if (!raw.trim()) return [];
    try {
      source = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(source)) return [];

  return source.map((b, i) => {
    const banner = (b ?? {}) as Partial<Banner>;
    const pages = Array.isArray(banner.pages)
      ? banner.pages.map((p) => asString(p)).filter(Boolean)
      : [];

    return {
      id: asString(banner.id) || `banner-${i}`,
      enabled: asBool(banner.enabled, true),
      title: asString(banner.title),
      message: asString(banner.message),
      variant: asVariant(banner.variant),
      links: asLinks(banner.links),
      pages: pages.length ? pages : ["*"],
      dismissible: asBool(banner.dismissible, false),
      startsAt: asString(banner.startsAt),
      endsAt: asString(banner.endsAt),
    };
  });
};

/** `*` matches everything, a trailing `/*` matches a subtree, else exact. */
export const matchesPage = (pattern: string, path: string): boolean => {
  if (pattern === "*") return true;

  const clean = path.split("?")[0].split("#")[0];

  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    // "/upload/*" should also match "/upload" itself, not just its children.
    return clean === prefix || clean.startsWith(`${prefix}/`);
  }

  if (pattern === "/") return clean === "/";

  return clean === pattern || clean === `${pattern}/`;
};

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A bare "YYYY-MM-DD" is parsed by `new Date()` as UTC midnight, which makes
 * "show until 31 Aug" expire at the *start* of the 31st and shifts both edges
 * for anyone not on UTC. Bare dates are therefore expanded to local midnight
 * (start) or local end-of-day (end), so the range is inclusive of both days as
 * an admin would expect. Anything with an explicit time is left alone.
 */
const parseBoundary = (value: string, endOfDay: boolean): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(
    BARE_DATE.test(trimmed)
      ? `${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
      : trimmed,
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const withinSchedule = (banner: Banner, now: Date): boolean => {
  const start = parseBoundary(banner.startsAt, false);
  if (start && now < start) return false;

  const end = parseBoundary(banner.endsAt, true);
  if (end && now > end) return false;

  return true;
};

export const activeBanners = (
  banners: Banner[],
  path: string,
  now: Date = new Date(),
): Banner[] =>
  banners.filter(
    (b) =>
      b.enabled &&
      (b.message.trim() || b.title.trim()) &&
      b.pages.some((p) => matchesPage(p, path)) &&
      withinSchedule(b, now),
  );

export const readDismissed = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISMISS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
};

export const dismissBanner = (id: string) => {
  if (typeof window === "undefined") return;
  try {
    const next = Array.from(new Set([...readDismissed(), id]));
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode, quota). A banner that reappears
    // is a far better outcome than one that crashes the page.
  }
};

export const emptyBanner = (id: string): Banner => ({
  id,
  enabled: true,
  title: "",
  message: "",
  variant: "info",
  links: [],
  pages: ["*"],
  dismissible: true,
  startsAt: "",
  endsAt: "",
});
