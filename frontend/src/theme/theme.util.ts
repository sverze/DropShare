
import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  DEFAULT_SHARED,
  DEFAULT_SHARE_PRESETS,
  DEFAULT_THEME,
  MODE_COLOR_KEYS,
  ModeColors,
  ResolvedTheme,
  SHARED_COLOR_KEYS,
  SHIPPED_BRAND_RAMP,
  SHIPPED_BULK_GRADIENT,
  SHIPPED_ACCENT_DEEP,
  SHIPPED_ACCENT_HOVER,
  SHIPPED_BULK_HOVER_GRADIENT,
  SHIPPED_BULK_SOFT,
  SHIPPED_LIGHT_SHARE_DEFAULT,
  SHIPPED_MODAL_CLOSE,
  SHIPPED_MODAL_CLOSE_HOVER_RGB,
  SHIPPED_ON_UPLOAD,
  SHIPPED_PAGE_BASE,
  SHIPPED_RIBBON_1_RGB,
  SHIPPED_RIBBON_2_RGB,
  SHIPPED_PAGE_BACKGROUND,
  SHIPPED_SHARE_BACKGROUND,
  SHIPPED_TEXT,
  SHIPPED_UPLOAD_GRADIENT,
  SharePreset,
  SharedColors,
  ThemeMode,
} from "./theme.constants";

const HEX = /^#[0-9a-fA-F]{6}$/;

export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && HEX.test(value.trim());

const clampChannel = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((c) => clampChannel(c).toString(16).padStart(2, "0"))
    .join("")}`;

export const hexToRgb = (hex: string): [number, number, number] => {
  const raw = (hex ?? "").trim().replace(/^#/, "");
  const v =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(v)) return [0, 255, 90];

  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
};

export const rgbString = (hex: string): string => hexToRgb(hex).join(", ");

export const rgbExpr = (color: string): string => {
  const match = /^var\((--[a-z0-9-]+)\)$/i.exec((color ?? "").trim());
  return match ? `var(${match[1]}-rgb)` : rgbString(color);
};

export const splitWordmark = (name: string): { head: string; tail: string } => {
  const value = (name ?? "").trim();
  if (!value) return { head: "", tail: "" };

  let boundary = -1;
  for (let i = 1; i < value.length; i++) {
    const previous = value[i - 1];
    const isBoundary =
      value[i] !== value[i].toLowerCase() &&
      (previous === previous.toLowerCase() || /\s/.test(previous)) &&
      /[a-z\s]/i.test(previous);
    if (isBoundary) boundary = i;
  }

  return boundary === -1
    ? { head: value, tail: "" }
    : { head: value.slice(0, boundary), tail: value.slice(boundary) };
};

export const defaultShareAccent = (
  presets: SharePreset[],
  isDark: boolean,
): string => {
  const first = presets[0]?.color ?? DEFAULT_SHARE_PRESETS[0].color;
  if (isDark) return first;

  const paletteIsShipped =
    presets.length === DEFAULT_SHARE_PRESETS.length &&
    presets.every(
      (preset, index) =>
        preset.color.toLowerCase() === DEFAULT_SHARE_PRESETS[index].color,
    );

  return paletteIsShipped ? SHIPPED_LIGHT_SHARE_DEFAULT : first;
};

export const shade = (hex: string, factor: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return toHex(r * factor, g * factor, b * factor);
};

export const tint = (hex: string, t: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
};

export const luminance = (hex: string): number => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const readableOn = (background: string): string =>
  luminance(background) > 0.45 ? "#0b1410" : "#ffffff";

export const buildBrandPalette = (accent: string, mode: ThemeMode): string[] => {
  const shippedAccent = mode === "dark" ? DEFAULT_DARK.accent : DEFAULT_LIGHT.accent;
  if (accent.toLowerCase() === shippedAccent) return [...SHIPPED_BRAND_RAMP];

  return [
    tint(accent, 0.9),
    tint(accent, 0.78),
    tint(accent, 0.62),
    tint(accent, 0.42),
    tint(accent, 0.22),
    accent,
    shade(accent, 0.902),
    shade(accent, 0.8),
    shade(accent, 0.702),
    shade(accent, 0.604),
  ];
};

const uploadGradient = (color: string, mode: ThemeMode): string => {
  const shipped = mode === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT;
  if (color.toLowerCase() === shipped.uploadButton)
    return SHIPPED_UPLOAD_GRADIENT[mode];

  return mode === "dark"
    ? `linear-gradient(135deg, ${color} 0%, ${shade(color, 0.8)} 100%)`
    : `linear-gradient(135deg, ${tint(color, 0.18)} 0%, ${color} 100%)`;
};

const bulkGradients = (color: string, mode: ThemeMode) => {
  const shipped = mode === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT;
  if (color.toLowerCase() === shipped.bulkUploadButton) {
    return {
      base: SHIPPED_BULK_GRADIENT[mode],
      hover: SHIPPED_BULK_HOVER_GRADIENT[mode],
      text: "#e0fbff",
    };
  }

  const rgb = rgbString(color);
  const deep = rgbString(shade(color, 0.55));

  return mode === "dark"
    ? {
        base: `linear-gradient(135deg, rgba(${rgb}, 0.22) 0%, rgba(${deep}, 0.7) 100%)`,
        hover: `linear-gradient(135deg, rgba(${rgb}, 0.28) 0%, rgba(${deep}, 0.82) 100%)`,
        text: tint(color, 0.86),
      }
    : {
        base: `linear-gradient(135deg, rgba(${rgb}, 0.94) 0%, rgba(${deep}, 0.95) 100%)`,
        hover: `linear-gradient(135deg, rgba(${rgb}, 0.96) 0%, rgba(${deep}, 0.98) 100%)`,
        text: readableOn(color),
      };
};

const modalClose = (accent: string, mode: ThemeMode) => {
  const shipped = mode === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT;
  if (accent.toLowerCase() === shipped.accent)
    return {
      color: SHIPPED_MODAL_CLOSE[mode],
      hoverRgb: SHIPPED_MODAL_CLOSE_HOVER_RGB[mode],
    };

  return {
    color: mode === "dark" ? tint(accent, 0.49) : accent,
    hoverRgb: rgbString(accent),
  };
};

export const pageBackground = (colors: ModeColors, mode: ThemeMode): string => {
  const shipped = mode === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT;
  if (
    colors.accent.toLowerCase() === shipped.accent &&
    colors.background.toLowerCase() === shipped.background
  )
    return SHIPPED_PAGE_BACKGROUND[mode];

  const accentRgb = rgbString(colors.accent);

  return mode === "dark"
    ? `radial-gradient(circle at top, rgba(${accentRgb}, 0.18) 0%, rgba(${rgbString(
        shade(colors.accent, 0.16),
      )}, 0.6) 30%, ${colors.background} 60%, ${shade(
        colors.background,
        0,
      )} 100%)`
    : `radial-gradient(circle at 14% 10%, rgba(${accentRgb}, 0.28) 0%, transparent 30%), radial-gradient(circle at 86% 16%, rgba(${rgbString(
        shade(colors.accent, 0.85),
      )}, 0.2) 0%, transparent 26%), linear-gradient(180deg, ${
        colors.background
      } 0%, ${shade(colors.background, 0.985)} 36%, ${shade(
        colors.background,
        0.97,
      )} 100%)`;
};

export const shareBackground = (colors: ModeColors, mode: ThemeMode): string => {
  const shipped = mode === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT;
  if (colors.background.toLowerCase() === shipped.background)
    return SHIPPED_SHARE_BACKGROUND[mode];

  return mode === "dark"
    ? `linear-gradient(180deg, ${shade(colors.background, 0.7)} 0%, ${shade(
        colors.background,
        0.55,
      )} 46%, ${shade(colors.background, 0.3)} 100%)`
    : `linear-gradient(180deg, ${colors.background} 0%, ${shade(
        colors.background,
        0.995,
      )} 100%)`;
};

const sanitizeMode = (
  raw: Partial<Record<keyof ModeColors, unknown>>,
  fallback: ModeColors,
): ModeColors => {
  const out = { ...fallback };
  for (const key of MODE_COLOR_KEYS) {
    const value = raw[key];
    if (isHexColor(value)) out[key] = value.trim().toLowerCase();
  }
  return out;
};

export const resolveTheme = (
  get: (_key: string) => any | undefined,
): ResolvedTheme => {
  const read = (name: string) => {
    try {
      return get(`general.${name}`);
    } catch {
      return undefined;
    }
  };

  const readMode = (prefix: "themeDark" | "themeLight", fallback: ModeColors) =>
    sanitizeMode(
      Object.fromEntries(
        MODE_COLOR_KEYS.map((key) => [
          key,
          read(`${prefix}${key[0].toUpperCase()}${key.slice(1)}`),
        ]),
      ),
      fallback,
    );

  const shared = { ...DEFAULT_SHARED } as SharedColors;
  for (const key of SHARED_COLOR_KEYS) {
    const value = read(`theme${key[0].toUpperCase()}${key.slice(1)}`);
    if (isHexColor(value)) shared[key] = value.trim().toLowerCase();
  }

  let presets: SharePreset[] = DEFAULT_SHARE_PRESETS;
  const rawPresets = read("themeSharePresets");
  if (typeof rawPresets === "string" && rawPresets.trim()) {
    try {
      const parsed = JSON.parse(rawPresets);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((p) => isHexColor(p?.color) && typeof p?.name === "string")
      ) {
        presets = parsed.map((p) => ({
          color: p.color.trim().toLowerCase(),
          name: p.name,
        }));
      }
    } catch {
    }
  }

  return {
    dark: readMode("themeDark", DEFAULT_DARK),
    light: readMode("themeLight", DEFAULT_LIGHT),
    shared,
    presets,
  };
};

const modeVariables = (
  colors: ModeColors,
  shared: SharedColors,
  mode: ThemeMode,
): Record<string, string> => {
  const bulk = bulkGradients(colors.bulkUploadButton, mode);
  const shipped = mode === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT;
  const accentUntouched = colors.accent.toLowerCase() === shipped.accent;
  const backgroundUntouched = colors.background.toLowerCase() === shipped.background;
  const deep = accentUntouched
    ? SHIPPED_ACCENT_DEEP[mode]
    : shade(colors.accent, 0.8);
  const hover = accentUntouched
    ? SHIPPED_ACCENT_HOVER[mode]
    : [tint(colors.accent, 0.12), shade(colors.accent, 0.87)];
  const uploadUntouched =
    colors.uploadButton.toLowerCase() ===
    (mode === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT).uploadButton;

  return {
    "--ls-accent": colors.accent,
    "--ls-accent-rgb": rgbString(colors.accent),
    "--ls-on-accent": readableOn(colors.accent),
    "--ls-accent-deep": deep,
    "--ls-accent-deep-rgb": rgbString(deep),
    "--ls-accent-hover": hover[0],
    "--ls-accent-hover-deep": hover[1],

    "--ls-ribbon-1-rgb": accentUntouched
      ? SHIPPED_RIBBON_1_RGB[mode]
      : rgbString(colors.accent),
    "--ls-ribbon-2-rgb": accentUntouched
      ? SHIPPED_RIBBON_2_RGB[mode]
      : rgbString(shade(colors.accent, 0.82)),
    "--ls-page-base": backgroundUntouched
      ? SHIPPED_PAGE_BASE[mode]
      : `linear-gradient(180deg, ${colors.background} 0%, ${shade(
          colors.background,
          0.96,
        )} 48%, ${shade(colors.background, 0.88)} 100%)`,

    "--ls-bg": colors.background,
    "--ls-bg-rgb": rgbString(colors.background),
    "--ls-text":
      colors.background.toLowerCase() ===
      (mode === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT).background
        ? SHIPPED_TEXT[mode]
        : readableOn(colors.background),
    "--ls-page-bg": pageBackground(colors, mode),
    "--ls-share-bg": shareBackground(colors, mode),

    "--ls-header-bg": colors.headerBackground,
    "--ls-header-bg-rgb": rgbString(colors.headerBackground),
    "--ls-header-border-rgb": rgbString(colors.headerBorder),

    "--ls-logo-text": colors.logoText,
    "--ls-logo-accent": colors.logoAccent,
    "--ls-logo-accent-rgb": rgbString(colors.logoAccent),

    "--ls-upload-btn": colors.uploadButton,
    "--ls-upload-btn-rgb": rgbString(colors.uploadButton),
    "--ls-upload-grad": uploadGradient(colors.uploadButton, mode),
    "--ls-on-upload": uploadUntouched
      ? SHIPPED_ON_UPLOAD[mode]
      : readableOn(colors.uploadButton),

    "--ls-bulk-btn": colors.bulkUploadButton,
    "--ls-bulk-btn-rgb": rgbString(colors.bulkUploadButton),
    "--ls-bulk-soft":
      colors.bulkUploadButton.toLowerCase() === shipped.bulkUploadButton
        ? SHIPPED_BULK_SOFT[mode]
        : mode === "dark"
          ? tint(colors.bulkUploadButton, 0.35)
          : colors.bulkUploadButton,
    "--ls-bulk-grad": bulk.base,
    "--ls-bulk-grad-hover": bulk.hover,
    "--ls-on-bulk": bulk.text,

    "--ls-home-btn": colors.homeButton,
    "--ls-home-btn-rgb": rgbString(colors.homeButton),

    "--ls-panel-bg-rgb": rgbString(colors.panelBackground),
    "--ls-panel-border-rgb": rgbString(colors.panelBorder),

    "--ls-modal-close": modalClose(colors.accent, mode).color,
    "--ls-modal-close-hover-rgb": modalClose(colors.accent, mode).hoverRgb,

    "--ls-ring-outer": shared.modalRingOuter,
    "--ls-ring-inner": shared.modalRingInner,
    "--ls-ring-center": shared.modalRingCenter,
    "--ls-ring-outer-rgb": rgbString(shared.modalRingOuter),
    "--ls-ring-inner-rgb": rgbString(shared.modalRingInner),
    "--ls-ring-center-rgb": rgbString(shared.modalRingCenter),
  };
};

export const themeVariablesFor = (
  theme: ResolvedTheme,
  mode: ThemeMode,
): Record<string, string> => modeVariables(theme[mode], theme.shared, mode);

const block = (selector: string, vars: Record<string, string>) =>
  `${selector}{${Object.entries(vars)
    .map(([name, value]) => `${name}:${value};`)
    .join("")}}`;

export const buildThemeCss = (theme: ResolvedTheme = DEFAULT_THEME): string =>
  block(":root", modeVariables(theme.dark, theme.shared, "dark")) +
  block(
    ":root[data-ls-scheme='light']",
    modeVariables(theme.light, theme.shared, "light"),
  );
