import { createStyles } from "@mantine/core";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  TbAlertTriangle,
  TbCircleCheck,
  TbExclamationCircle,
  TbInfoCircle,
  TbSparkles,
  TbX,
} from "react-icons/tb";
import { Banner as BannerType, BannerVariant } from "../types/banner.type";
import { isSafeHref } from "../utils/banner.util";

const CONTENT_WIDTH = 980;
const H_PADDING = 16;

/**
 * Variant tints as raw "r, g, b" so they can be composed with rgba() the same
 * way the panel styling elsewhere composes --ls-panel-bg-rgb. "accent" defers
 * to the site's configured accent color.
 */
const VARIANT_RGB: Record<BannerVariant, string> = {
  info: "56, 139, 253",
  success: "63, 185, 80",
  warning: "210, 153, 34",
  danger: "248, 81, 73",
  accent: "var(--ls-accent-rgb)",
};

const VARIANT_ICON: Record<BannerVariant, ComponentType<{ size?: number }>> = {
  info: TbInfoCircle,
  success: TbCircleCheck,
  warning: TbAlertTriangle,
  danger: TbExclamationCircle,
  accent: TbSparkles,
};

const useStyles = createStyles((theme, { rgb }: { rgb: string }) => {
  const dark = theme.colorScheme === "dark";

  return {
    outer: {
      position: "relative",
      zIndex: 100,
      maxWidth: CONTENT_WIDTH + H_PADDING * 2,
      marginInline: "auto",
      paddingInline: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },

    banner: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      padding: "14px 16px",
      borderRadius: 16,
      backdropFilter: "blur(12px)",
      // `border` must come first: as a shorthand it would otherwise reset the
      // stronger left edge back to the faint all-round color.
      border: `1px solid rgba(${rgb}, ${dark ? 0.32 : 0.28})`,
      borderLeft: `3px solid rgba(${rgb}, ${dark ? 0.85 : 0.7})`,
      background: dark
        ? `linear-gradient(180deg, rgba(${rgb}, 0.16) 0%, rgba(var(--ls-panel-bg-rgb), 0.82) 100%)`
        : `linear-gradient(180deg, rgba(${rgb}, 0.12) 0%, rgba(255, 255, 255, 0.86) 100%)`,
      boxShadow: dark
        ? `0 14px 34px rgba(0, 0, 0, 0.22), 0 0 26px rgba(${rgb}, 0.08)`
        : "0 4px 18px rgba(0, 0, 0, 0.06)",
    },

    icon: {
      color: `rgb(${rgb})`,
      flexShrink: 0,
      marginTop: 1,
      filter: `drop-shadow(0 0 8px rgba(${rgb}, 0.35))`,
    },

    body: { flex: 1, minWidth: 0 },

    title: {
      color: "var(--ls-text)",
      fontWeight: 700,
      fontSize: 14,
      lineHeight: 1.4,
      marginBottom: 2,
    },

    message: {
      color: "var(--ls-text)",
      opacity: 0.85,
      fontSize: 14,
      lineHeight: 1.5,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    },

    links: {
      display: "flex",
      flexWrap: "wrap",
      gap: 16,
      marginTop: 8,
    },

    link: {
      color: `rgb(${rgb})`,
      fontSize: 14,
      fontWeight: 600,
      textDecoration: "none",
      borderBottom: `1px solid rgba(${rgb}, 0.4)`,
      paddingBottom: 1,
      transition: "border-color 120ms ease, opacity 120ms ease",
      "&:hover": { borderBottomColor: `rgb(${rgb})`, opacity: 0.85 },
    },

    dismiss: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 4,
      borderRadius: 8,
      lineHeight: 0,
      color: "var(--ls-text)",
      opacity: 0.45,
      flexShrink: 0,
      transition: "opacity 120ms ease, background 120ms ease",
      "&:hover": { opacity: 0.9, background: `rgba(${rgb}, 0.12)` },
    },
  };
});

const isExternal = (href: string) => /^https?:\/\//i.test(href.trim());

const Banner = ({
  banner,
  onDismiss,
}: {
  banner: BannerType;
  onDismiss?: (_id: string) => void;
}) => {
  const rgb = VARIANT_RGB[banner.variant];
  const { classes } = useStyles({ rgb });
  const Icon = VARIANT_ICON[banner.variant];

  // parseBanners already drops unsafe hrefs, but the admin preview renders the
  // in-progress edit state straight from the form, so re-check here: the preview
  // must show exactly what visitors would get.
  const safeLinks = banner.links.filter((l) => isSafeHref(l.href));

  return (
    <div className={classes.outer}>
      <div className={classes.banner} role="status">
        <span className={classes.icon}>
          <Icon size={18} />
        </span>

        <div className={classes.body}>
          {banner.title && <div className={classes.title}>{banner.title}</div>}
          {banner.message && <div className={classes.message}>{banner.message}</div>}

          {safeLinks.length > 0 && (
            <div className={classes.links}>
              {safeLinks.map((link, i) =>
                isExternal(link.href) ? (
                  <a
                    key={`${link.href}-${i}`}
                    className={classes.link}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link key={`${link.href}-${i}`} href={link.href} className={classes.link}>
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          )}
        </div>

        {banner.dismissible && onDismiss && (
          <button
            type="button"
            className={classes.dismiss}
            onClick={() => onDismiss(banner.id)}
            aria-label="Dismiss notice"
          >
            <TbX size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Banner;
