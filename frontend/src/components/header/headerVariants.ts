import { MantineTheme } from "@mantine/core";

export type HeaderVariant = "default" | "minimal";

export const HEADER_VARIANTS: {
  id: HeaderVariant;
  name: string;
  description: string;
}[] = [
  {
    id: "default",
    name: "Floating panel",
    description:
      "A rounded card inset from every edge, translucent and blurred, outlined in the header color with a soft glow.",
  },
  {
    id: "minimal",
    name: "Minimal",
    description:
      "No panel and no outline around the content, just a blurred strip that lets the page background carry through. The header color stays as a hairline along the bottom edge with a soft glow beneath it.",
  },
];

export const DEFAULT_HEADER_VARIANT: HeaderVariant = "default";

export const isHeaderVariant = (value: unknown): value is HeaderVariant =>
  typeof value === "string" &&
  HEADER_VARIANTS.some((v) => v.id === (value as HeaderVariant));

export const toHeaderVariant = (value: unknown): HeaderVariant =>
  isHeaderVariant(value) ? value : DEFAULT_HEADER_VARIANT;

export const headerVariantStyles = (
  variant: HeaderVariant,
  theme: MantineTheme,
  outlineRgb: string,
  headerHeight: number,
): {
  headerWrapper?: Record<string, any>;
  root?: Record<string, any>;
  headerSpacer?: Record<string, any>;
  header?: Record<string, any>;
} => {
  const dark = theme.colorScheme === "dark";

  if (variant === "minimal") {
    return {
      headerWrapper: {
        padding: 0,
        [theme.fn.smallerThan("sm")]: { padding: 0 },
      },
      root: {
        borderRadius: 0,
        maxWidth: "none",
        border: "none",
        borderBottom: `1px solid rgba(${outlineRgb}, ${dark ? 0.32 : 0.4})`,
        backgroundColor: `rgba(var(--ls-header-bg-rgb), ${dark ? 0.3 : 0.5})`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: `0 6px 22px -14px rgba(${outlineRgb}, ${dark ? 0.9 : 0.6})`,
        "&:hover": {
          border: "none",
          borderBottom: `1px solid rgba(${outlineRgb}, ${dark ? 0.45 : 0.52})`,
          boxShadow: `0 6px 22px -14px rgba(${outlineRgb}, ${dark ? 0.9 : 0.6})`,
        },
      },
      header: {
        maxWidth: "none",
        paddingLeft: 28,
        paddingRight: 28,
        [theme.fn.smallerThan("sm")]: {
          paddingLeft: 14,
          paddingRight: 14,
        },
      },
      headerSpacer: { height: headerHeight },
    };
  }

  return {};
};
