
import { ConfigService } from "src/config/config.service";

const SHIPPED_ACCENT = "#00ff5a";

const SHIPPED = {
  accentDeep: "#00cc48",
  link: "#008a36",
  onAccent: "#0f172a",
  subtleRgb: "0, 200, 70",
};

export type EmailTheme = {
  accent: string;
  accentRgb: string;
  accentDeep: string;
  link: string;
  onAccent: string;
  subtleRgb: string;
  brandHead: string;
  brandTail: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

const hexToRgb = (hex: string): [number, number, number] => {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
};

const rgbString = (hex: string) => hexToRgb(hex).join(", ");

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const shade = (hex: string, factor: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `#${[r, g, b]
    .map((c) => clamp(c * factor).toString(16).padStart(2, "0"))
    .join("")}`;
};

export const tintTowardsWhite = (hex: string, t: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `#${[r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t]
    .map((c) => clamp(c).toString(16).padStart(2, "0"))
    .join("")}`;
};

const luminance = (hex: string) => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const splitBrandName = (name: string) => {
  const value = (name ?? "").trim();
  if (!value) return { head: "", tail: "" };

  let boundary = -1;
  for (let i = 1; i < value.length; i++) {
    const previous = value[i - 1];
    if (
      value[i] !== value[i].toLowerCase() &&
      (previous === previous.toLowerCase() || /\s/.test(previous)) &&
      /[a-z\s]/i.test(previous)
    ) {
      boundary = i;
    }
  }

  return boundary === -1
    ? { head: value, tail: "" }
    : { head: value.slice(0, boundary), tail: value.slice(boundary) };
};

const readableLink = (accent: string) =>
  luminance(accent) > 0.18 ? shade(accent, 0.55) : accent;

export const resolveEmailTheme = (config: ConfigService): EmailTheme => {
  let accent = SHIPPED_ACCENT;
  let appName = "DropShare";

  try {
    const configured = config.get("general.themeDarkAccent");
    if (typeof configured === "string" && HEX.test(configured.trim())) {
      accent = configured.trim().toLowerCase();
    }
    appName = config.get("general.appName") || appName;
  } catch {
  }

  const untouched = accent === SHIPPED_ACCENT;
  const { head, tail } = splitBrandName(appName);

  return {
    accent,
    accentRgb: rgbString(accent),
    accentDeep: untouched ? SHIPPED.accentDeep : shade(accent, 0.8),
    link: untouched ? SHIPPED.link : readableLink(accent),
    onAccent: untouched
      ? SHIPPED.onAccent
      : luminance(accent) > 0.45
        ? "#0f172a"
        : "#ffffff",
    subtleRgb: untouched ? SHIPPED.subtleRgb : rgbString(shade(accent, 0.79)),
    brandHead: head,
    brandTail: tail,
  };
};
