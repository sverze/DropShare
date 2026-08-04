
export type ThemeMode = "dark" | "light";

export type ModeColors = {
  accent: string;
  background: string;
  headerBackground: string;
  headerBorder: string;
  logoText: string;
  logoAccent: string;
  uploadButton: string;
  bulkUploadButton: string;
  homeButton: string;
  panelBackground: string;
  panelBorder: string;
};

export type SharedColors = {
  modalRingOuter: string;
  modalRingInner: string;
  modalRingCenter: string;
};

export type SharePreset = { color: string; name: string };

export type ResolvedTheme = {
  dark: ModeColors;
  light: ModeColors;
  shared: SharedColors;
  presets: SharePreset[];
};

export const MODE_COLOR_KEYS: (keyof ModeColors)[] = [
  "accent",
  "background",
  "headerBackground",
  "headerBorder",
  "logoText",
  "logoAccent",
  "uploadButton",
  "bulkUploadButton",
  "homeButton",
  "panelBackground",
  "panelBorder",
];

export const SHARED_COLOR_KEYS: (keyof SharedColors)[] = [
  "modalRingOuter",
  "modalRingInner",
  "modalRingCenter",
];

export const DEFAULT_DARK: ModeColors = {
  accent: "#00ff5a",
  background: "#05080b",
  headerBackground: "#0f172a",
  headerBorder: "#00ff5a",
  logoText: "#ffffff",
  logoAccent: "#00ff5a",
  uploadButton: "#00ff5a",
  bulkUploadButton: "#22d3ee",
  homeButton: "#00ff5a",
  panelBackground: "#141e1c",
  panelBorder: "#00ff5a",
};

export const DEFAULT_LIGHT: ModeColors = {
  accent: "#12db5b",
  background: "#f7fbf8",
  headerBackground: "#f2fbf4",
  headerBorder: "#12db5b",
  logoText: "#141517",
  logoAccent: "#12db5b",
  uploadButton: "#12db5b",
  bulkUploadButton: "#0891b2",
  homeButton: "#12db5b",
  panelBackground: "#ffffff",
  panelBorder: "#00c846",
};

export const DEFAULT_SHARED: SharedColors = {
  modalRingOuter: "#22d3ee",
  modalRingInner: "#14b8a6",
  modalRingCenter: "#00ff5a",
};

export const DEFAULT_SHARE_PRESETS: SharePreset[] = [
  { color: "#00ff5a", name: "Neon Green" },
  { color: "#00d4ff", name: "Electric Blue" },
  { color: "#ff6b35", name: "Sunset Orange" },
  { color: "#a855f7", name: "Purple Haze" },
  { color: "#ff1493", name: "Hot Pink" },
  { color: "#fbbf24", name: "Golden" },
  { color: "#22d3d6", name: "Cyan" },
  { color: "#ef4444", name: "Red Alert" },
  { color: "#a9b0ca", name: "Space Grey" },
];

export const DEFAULT_THEME: ResolvedTheme = {
  dark: DEFAULT_DARK,
  light: DEFAULT_LIGHT,
  shared: DEFAULT_SHARED,
  presets: DEFAULT_SHARE_PRESETS,
};

// One-click palettes for the Appearance editor. Each fills every dark, light and
// shared color key at once; the admin can then fine-tune individual rows and
// still Save. These cover the site palette only - the per-share swatch list
// (themeSharePresets) is intentionally left alone. `swatch` is the dark accent,
// used for the picker button. "Ocean Blue" reproduces the palette this instance
// already ships with so it can always be restored.
export type ThemePreset = {
  id: string;
  name: string;
  swatch: string;
  dark: ModeColors;
  light: ModeColors;
  shared: SharedColors;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "blue",
    name: "Ocean Blue",
    swatch: "#38bdf8",
    dark: {
      accent: "#38bdf8",
      background: "#050b14",
      headerBackground: "#0b1526",
      headerBorder: "#38bdf8",
      logoText: "#ffffff",
      logoAccent: "#38bdf8",
      uploadButton: "#38bdf8",
      bulkUploadButton: "#2dd4bf",
      homeButton: "#38bdf8",
      panelBackground: "#0d1a2b",
      panelBorder: "#38bdf8",
    },
    light: {
      accent: "#0284c7",
      background: "#f5faff",
      headerBackground: "#ecf5ff",
      headerBorder: "#0284c7",
      logoText: "#0f172a",
      logoAccent: "#0284c7",
      uploadButton: "#0284c7",
      bulkUploadButton: "#0d9488",
      homeButton: "#0284c7",
      panelBackground: "#ffffff",
      panelBorder: "#0284c7",
    },
    shared: {
      modalRingOuter: "#0ea5e9",
      modalRingInner: "#6366f1",
      modalRingCenter: "#67e8f9",
    },
  },
  {
    id: "purple",
    name: "Royal Purple",
    swatch: "#c084fc",
    dark: {
      accent: "#c084fc",
      background: "#0c0614",
      headerBackground: "#170f26",
      headerBorder: "#c084fc",
      logoText: "#ffffff",
      logoAccent: "#c084fc",
      uploadButton: "#c084fc",
      bulkUploadButton: "#f472b6",
      homeButton: "#c084fc",
      panelBackground: "#150f24",
      panelBorder: "#c084fc",
    },
    light: {
      accent: "#9333ea",
      background: "#faf5ff",
      headerBackground: "#f5ecff",
      headerBorder: "#9333ea",
      logoText: "#1e1b2e",
      logoAccent: "#9333ea",
      uploadButton: "#9333ea",
      bulkUploadButton: "#db2777",
      homeButton: "#9333ea",
      panelBackground: "#ffffff",
      panelBorder: "#9333ea",
    },
    shared: {
      modalRingOuter: "#a855f7",
      modalRingInner: "#6366f1",
      modalRingCenter: "#e879f9",
    },
  },
  {
    id: "red",
    name: "Crimson Red",
    swatch: "#f87171",
    dark: {
      accent: "#f87171",
      background: "#140607",
      headerBackground: "#26100f",
      headerBorder: "#f87171",
      logoText: "#ffffff",
      logoAccent: "#f87171",
      uploadButton: "#f87171",
      bulkUploadButton: "#fb923c",
      homeButton: "#f87171",
      panelBackground: "#24100f",
      panelBorder: "#f87171",
    },
    light: {
      accent: "#dc2626",
      background: "#fef2f2",
      headerBackground: "#ffecec",
      headerBorder: "#dc2626",
      logoText: "#2a1414",
      logoAccent: "#dc2626",
      uploadButton: "#dc2626",
      bulkUploadButton: "#ea580c",
      homeButton: "#dc2626",
      panelBackground: "#ffffff",
      panelBorder: "#dc2626",
    },
    shared: {
      modalRingOuter: "#ef4444",
      modalRingInner: "#f97316",
      modalRingCenter: "#fca5a5",
    },
  },
  {
    id: "orange",
    name: "Sunset Orange",
    swatch: "#fb923c",
    dark: {
      accent: "#fb923c",
      background: "#140b04",
      headerBackground: "#261a0f",
      headerBorder: "#fb923c",
      logoText: "#ffffff",
      logoAccent: "#fb923c",
      uploadButton: "#fb923c",
      bulkUploadButton: "#fbbf24",
      homeButton: "#fb923c",
      panelBackground: "#241a0f",
      panelBorder: "#fb923c",
    },
    light: {
      accent: "#ea580c",
      background: "#fff7ed",
      headerBackground: "#ffefdd",
      headerBorder: "#ea580c",
      logoText: "#2a1c10",
      logoAccent: "#ea580c",
      uploadButton: "#ea580c",
      bulkUploadButton: "#d97706",
      homeButton: "#ea580c",
      panelBackground: "#ffffff",
      panelBorder: "#ea580c",
    },
    shared: {
      modalRingOuter: "#f97316",
      modalRingInner: "#f59e0b",
      modalRingCenter: "#fdba74",
    },
  },
];

export const SHIPPED_BRAND_RAMP: string[] = [
  "#e5ffe9",
  "#caffd4",
  "#a9ffbb",
  "#7aff9a",
  "#45ff75",
  "#00ff5a",
  "#00e651",
  "#00cc48",
  "#00b33f",
  "#009a36",
];

export const SHIPPED_UPLOAD_GRADIENT: Record<ThemeMode, string> = {
  dark: "linear-gradient(135deg, #00ff5a 0%, #00cc48 100%)",
  light: "linear-gradient(135deg, #37ef78 0%, #12db5b 100%)",
};

export const SHIPPED_BULK_GRADIENT: Record<ThemeMode, string> = {
  dark: "linear-gradient(135deg, rgba(34, 211, 238, 0.22) 0%, rgba(14, 116, 144, 0.7) 100%)",
  light:
    "linear-gradient(135deg, rgba(8, 145, 178, 0.94) 0%, rgba(3, 105, 161, 0.95) 100%)",
};

export const SHIPPED_BULK_HOVER_GRADIENT: Record<ThemeMode, string> = {
  dark: "linear-gradient(135deg, rgba(34, 211, 238, 0.28) 0%, rgba(8, 145, 178, 0.82) 100%)",
  light:
    "linear-gradient(135deg, rgba(6, 182, 212, 0.96) 0%, rgba(14, 116, 144, 0.98) 100%)",
};

export const SHIPPED_ON_UPLOAD: Record<ThemeMode, string> = {
  dark: "#ffffff",
  light: "#ffffff",
};

export const SHIPPED_ON_BULK = "#e0fbff";

export const SHIPPED_LIGHT_SHARE_DEFAULT = "#b45309";

export const SHIPPED_BULK_SOFT: Record<ThemeMode, string> = {
  dark: "#67e8f9",
  light: "#0891b2",
};

export const SHIPPED_ACCENT_DEEP: Record<ThemeMode, string> = {
  dark: "#00cc48",
  light: "#00c94a",
};

export const SHIPPED_ACCENT_HOVER: Record<ThemeMode, [string, string]> = {
  dark: ["#00ff6a", "#00dd52"],
  light: ["#22ff70", "#00dd52"],
};

export const SHIPPED_RIBBON_1_RGB: Record<ThemeMode, string> = {
  dark: "0, 255, 90",
  light: "24, 216, 103",
};

export const SHIPPED_RIBBON_2_RGB: Record<ThemeMode, string> = {
  dark: "0, 201, 107",
  light: "15, 184, 123",
};

export const SHIPPED_PAGE_BASE: Record<ThemeMode, string> = {
  dark: "linear-gradient(180deg, #06100c 0%, #07120e 48%, #040705 100%)",
  light: "linear-gradient(180deg, #f7fbf8 0%, #f3f8f2 42%, #f7f1e8 100%)",
};

export const SHIPPED_TEXT: Record<ThemeMode, string> = {
  dark: "#f8f9fa",
  light: "#1a1b1e",
};

export const SHIPPED_MODAL_CLOSE: Record<ThemeMode, string> = {
  dark: "#7dff9c",
  light: "#b45309",
};

export const SHIPPED_MODAL_CLOSE_HOVER_RGB: Record<ThemeMode, string> = {
  dark: "0, 255, 90",
  light: "180, 83, 9",
};

export const SHIPPED_PAGE_BACKGROUND: Record<ThemeMode, string> = {
  dark: "radial-gradient(circle at top, rgba(0, 255, 90, 0.18) 0%, rgba(0, 40, 30, 0.6) 30%, #05080b 60%, #000000 100%)",
  light:
    "radial-gradient(circle at 14% 10%, rgba(18, 219, 91, 0.28) 0%, transparent 30%), radial-gradient(circle at 86% 16%, rgba(72, 187, 120, 0.2) 0%, transparent 26%), linear-gradient(180deg, #f7fbf8 0%, #f4f8f3 36%, #f8f4ec 100%)",
};

export const SHIPPED_SHARE_BACKGROUND: Record<ThemeMode, string> = {
  dark: "linear-gradient(180deg, #050607 0%, #040506 46%, #020203 100%)",
  light: "linear-gradient(180deg, #f7fbf8 0%, #faf9f7 100%)",
};
