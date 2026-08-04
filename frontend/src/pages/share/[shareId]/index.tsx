import {
  Box,
  Button,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  Text,
  Title,
  Tooltip,
  createStyles,
  Skeleton,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useMediaQuery } from "@mantine/hooks";
import { GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import { useEffect, useState, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import {
  TbEye,
  TbDownload,
  TbFiles,
  TbCalendar,
  TbEdit,
  TbMusic,
  TbShieldCheck,
  TbAlertTriangle,
  TbLoader2,
} from "react-icons/tb";
import DownloadAllButton from "../../../components/share/DownloadAllButton";
import FileList, {
  ShareLyricsPanelData,
} from "../../../components/share/FileList";
import showEnterPasswordModal from "../../../components/share/showEnterPasswordModal";
import showErrorModal from "../../../components/share/showErrorModal";
import useTranslate from "../../../hooks/useTranslate.hook";
import useUser from "../../../hooks/user.hook";
import shareService from "../../../services/share.service";
import { Share as ShareType, ShareVirusScan } from "../../../types/share.type";
import toast from "../../../utils/toast.util";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import { sanitizeLyricsHtml } from "../../../utils/lyricsRichText.util";
import moment from "moment";
import axios from "axios";
import {
  rgbString as hexToRgb,
  shade,
} from "../../../theme/theme.util";
import useConfig from "../../../hooks/config.hook";

const DEFAULT_ACCENT = "#00ff5a";
const LIGHT_MODE_ACCENT = "#12db5b";

function updateThemeColor(color: string) {
  if (typeof document === "undefined") return;

  let themeColorMeta = document.querySelector<HTMLMetaElement>(
    "meta[name=\"theme-color\"]",
  );
  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.name = "theme-color";
    document.head.appendChild(themeColorMeta);
  }

  themeColorMeta.content = color;
}

function hexToHue(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0deg";

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return "0deg";

  let hue = 0;

  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  return `${hue}deg`;
}

function shiftHue(hex: string, shift: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }

  h = (h + shift + 360) % 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
}

const useStyles = createStyles(
  (theme, { accentColor }: { accentColor: string }) => {
    const effectiveAccent =
      accentColor ||
      (theme.colorScheme === "light" ? LIGHT_MODE_ACCENT : DEFAULT_ACCENT);
    const accentSecondary = shiftHue(effectiveAccent, 18);
    const accentTertiary = shiftHue(effectiveAccent, -18);
    return {
      "@keyframes shareRibbonPrimaryFloat": {
        "0%": {
          transform: "translate3d(-14vw, -8vh, 0) rotate(-28deg) scale(0.92)",
        },
        "25%": {
          transform: "translate3d(-2vw, 3vh, 0) rotate(-14deg) scale(1.04)",
        },
        "55%": {
          transform: "translate3d(10vw, 7vh, 0) rotate(-6deg) scale(1.12)",
        },
        "78%": {
          transform: "translate3d(15vw, -2vh, 0) rotate(-22deg) scale(1.02)",
        },
        "100%": {
          transform: "translate3d(-14vw, -8vh, 0) rotate(-28deg) scale(0.92)",
        },
      },

      "@keyframes shareRibbonSecondaryFloat": {
        "0%": {
          transform: "translate3d(12vw, -7vh, 0) rotate(24deg) scale(0.94)",
        },
        "32%": {
          transform: "translate3d(1vw, 5vh, 0) rotate(10deg) scale(1.06)",
        },
        "60%": {
          transform: "translate3d(-11vw, 8vh, 0) rotate(30deg) scale(1.14)",
        },
        "84%": {
          transform: "translate3d(-15vw, -1vh, 0) rotate(18deg) scale(1.02)",
        },
        "100%": {
          transform: "translate3d(12vw, -7vh, 0) rotate(24deg) scale(0.94)",
        },
      },

      "@keyframes shareRibbonTertiaryFloat": {
        "0%": {
          transform: "translate3d(-9vw, 10vh, 0) rotate(-18deg) scale(0.92)",
        },
        "28%": {
          transform: "translate3d(4vw, 1vh, 0) rotate(-4deg) scale(1.04)",
        },
        "58%": {
          transform: "translate3d(13vw, -8vh, 0) rotate(6deg) scale(1.16)",
        },
        "82%": {
          transform: "translate3d(-4vw, -4vh, 0) rotate(-14deg) scale(1.02)",
        },
        "100%": {
          transform: "translate3d(-9vw, 10vh, 0) rotate(-18deg) scale(0.92)",
        },
      },

      "@keyframes shareAccentHaloFloat": {
        "0%": {
          transform: "translate3d(0, 0, 0) scale(1)",
          opacity: theme.colorScheme === "dark" ? 0.92 : 0.82,
        },
        "34%": {
          transform: "translate3d(10vw, 7vh, 0) scale(1.18)",
          opacity: theme.colorScheme === "dark" ? 1 : 0.94,
        },
        "68%": {
          transform: "translate3d(-11vw, -6vh, 0) scale(0.86)",
          opacity: theme.colorScheme === "dark" ? 0.8 : 0.68,
        },
        "100%": {
          transform: "translate3d(0, 0, 0) scale(1)",
          opacity: theme.colorScheme === "dark" ? 0.92 : 0.82,
        },
      },

      wrapper: {
        position: "relative",
        minHeight: "60vh",
        zIndex: 1,
        paddingTop: 20,
      },

      pageTint: {
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        filter:
          theme.colorScheme === "dark"
            ? "blur(var(--share-glow-blur, 14px))"
            : "blur(var(--share-glow-blur, 12px))",
        transform: "translateZ(0)",
        background:
          theme.colorScheme === "dark"
            ? `
        radial-gradient(ellipse var(--share-glow-1-w, 48vw) var(--share-glow-1-h, 38vh) at var(--share-glow-1-x, 13%) var(--share-glow-1-y, 20%), rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-1-core, 0.34)) 0%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-1-mid, 0.18)) 20%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-1-edge, 0.052)) 40%, transparent 56%),
        radial-gradient(ellipse var(--share-glow-2-w, 38vw) var(--share-glow-2-h, 32vh) at var(--share-glow-2-x, 86%) var(--share-glow-2-y, 18%), rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-2-core, 0.2)) 0%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-2-mid, 0.095)) 22%, transparent 48%),
        radial-gradient(ellipse var(--share-glow-3-w, 70vw) var(--share-glow-3-h, 42vh) at var(--share-glow-3-x, 54%) var(--share-glow-3-y, 102%), rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-3-core, 0.15)) 0%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-3-mid, 0.06)) 34%, transparent 60%),
        linear-gradient(180deg, rgba(5, 6, 7, 0.96) 0%, rgba(4, 5, 6, 0.985) 100%)
      `
            : `
        radial-gradient(ellipse var(--share-glow-1-w, 48vw) var(--share-glow-1-h, 38vh) at var(--share-glow-1-x, 13%) var(--share-glow-1-y, 20%), rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-1-core-light, 0.2)) 0%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-1-mid-light, 0.1)) 26%, transparent 56%),
        radial-gradient(ellipse var(--share-glow-2-w, 38vw) var(--share-glow-2-h, 32vh) at var(--share-glow-2-x, 86%) var(--share-glow-2-y, 18%), rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-2-core-light, 0.14)) 0%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-2-mid-light, 0.07)) 28%, transparent 52%),
        radial-gradient(ellipse var(--share-glow-3-w, 70vw) var(--share-glow-3-h, 42vh) at var(--share-glow-3-x, 54%) var(--share-glow-3-y, 102%), rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-3-core-light, 0.12)) 0%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), var(--share-glow-3-mid-light, 0.05)) 36%, transparent 62%),
        linear-gradient(180deg, rgba(248,252,248,0.98) 0%, rgba(245,249,243,0.98) 40%, rgba(248,244,236,0.98) 100%)
      `,
        backgroundRepeat: "no-repeat",
        willChange: "opacity",
      },

      starField: {
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: theme.colorScheme === "dark" ? 0.78 : 0.42,
        mixBlendMode: theme.colorScheme === "dark" ? "screen" : "multiply",
      },

      ribbon: {
        display: "none",
      },

      ribbonPrimary: {
        top: "10vh",
        left: "10vw",
        width: "34vw",
        height: "14vh",
        background: `linear-gradient(90deg, rgba(${hexToRgb(effectiveAccent)}, 0) 0%, rgba(${hexToRgb(effectiveAccent)}, ${theme.colorScheme === "dark" ? 0.34 : 0.26}) 24%, rgba(${hexToRgb(effectiveAccent)}, ${theme.colorScheme === "dark" ? 0.18 : 0.13}) 52%, rgba(${hexToRgb(effectiveAccent)}, 0) 100%)`,
        animation: "shareRibbonPrimaryFloat 11s linear infinite",
      },

      ribbonSecondary: {
        top: "24vh",
        right: "8vw",
        width: "30vw",
        height: "13vh",
        background: `linear-gradient(90deg, rgba(${hexToRgb(accentSecondary)}, 0) 0%, rgba(${hexToRgb(accentSecondary)}, ${theme.colorScheme === "dark" ? 0.28 : 0.22}) 24%, rgba(${hexToRgb(accentSecondary)}, ${theme.colorScheme === "dark" ? 0.14 : 0.1}) 50%, rgba(${hexToRgb(accentSecondary)}, 0) 100%)`,
        animation: "shareRibbonSecondaryFloat 13s linear infinite",
      },

      ribbonTertiary: {
        top: "50vh",
        left: "28vw",
        width: "28vw",
        height: "12vh",
        background: `linear-gradient(90deg, rgba(${hexToRgb(accentTertiary)}, 0) 0%, rgba(${hexToRgb(accentTertiary)}, ${theme.colorScheme === "dark" ? 0.22 : 0.18}) 20%, rgba(${hexToRgb(accentTertiary)}, ${theme.colorScheme === "dark" ? 0.11 : 0.08}) 48%, rgba(${hexToRgb(accentTertiary)}, 0) 100%)`,
        animation: "shareRibbonTertiaryFloat 15s linear infinite",
      },

      backgroundPattern: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: theme.colorScheme === "dark" ? 0.02 : 0.03,
        backgroundImage: `radial-gradient(var(--share-accent, ${effectiveAccent}) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        pointerEvents: "none",
        zIndex: 0,
      },

      ambientGlow: {
        position: "fixed",
        top: "-6%",
        left: "-4%",
        width: "108%",
        height: "108%",
        background: `radial-gradient(circle at 50% 10%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), ${theme.colorScheme === "dark" ? 0.035 : 0.05}) 0%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), 0.012) 16%, rgba(var(--share-accent-rgb, ${hexToRgb(effectiveAccent)}), 0) 34%)`,
        pointerEvents: "none",
        zIndex: 0,
        animation: "shareAccentHaloFloat 9s linear infinite",
        animationPlayState: "var(--share-decor-motion, running)",
        transformOrigin: "50% 12%",
        backfaceVisibility: "hidden",
        willChange: "transform, opacity",
      },

      headerCard: {
        position: "relative",
        // Neutral base under the accent wash. This used to be a green-tinted
        // dark (and a green-tinted white in light mode), which showed through
        // the gradient and fought any share accent that was not green.
        background:
          theme.colorScheme === "dark"
            ? `linear-gradient(135deg, rgba(${hexToRgb(effectiveAccent)}, 0.1) 0%, rgba(18, 20, 24, 0.95) 100%)`
            : `linear-gradient(135deg, rgba(${hexToRgb(effectiveAccent)}, 0.18) 0%, rgba(250, 250, 251, 0.99) 42%, rgba(246, 247, 249, 0.99) 100%)`,
        backdropFilter: "blur(20px)",
        borderRadius: 24,
        border: `1px solid rgba(${hexToRgb(effectiveAccent)}, ${theme.colorScheme === "dark" ? 0.2 : 0.25})`,
        padding: "32px 36px",
        marginBottom: 32,
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 8px 40px rgba(0, 0, 0, 0.5), 0 0 80px rgba(${hexToRgb(effectiveAccent)}, 0.1), inset 0 1px 0 rgba(255,255,255,0.03)`
            : `0 22px 48px rgba(15, 23, 42, 0.09), 0 0 96px rgba(${hexToRgb(effectiveAccent)}, 0.2)`,
        overflow: "hidden",
        zIndex: 1,

        [theme.fn.smallerThan("sm")]: {
          padding: "20px 16px",
          borderRadius: 16,
          marginBottom: 20,
        },
      },

      cardAccentLine: {
        position: "absolute",
        top: 0,
        left: "10%",
        right: "10%",
        height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${effectiveAccent} 50%, transparent 100%)`,
        opacity: 0.6,
      },

      headerContent: {
        position: "relative",
        zIndex: 1,
      },

      headerLayout: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 24,

        [theme.fn.smallerThan("sm")]: {
          flexDirection: "column",
          gap: 16,
        },
      },

      headerInfo: {
        flex: 1,
        minWidth: 0,
        maxWidth: "100%",

        [theme.fn.smallerThan("sm")]: {
          maxWidth: "100%",
        },
      },

      shareName: {
        fontSize: 30,
        fontWeight: 700,
        color:
          theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
        marginBottom: 8,
        letterSpacing: "-0.5px",
        wordBreak: "break-word",
        paddingRight: 210,

        [theme.fn.smallerThan("sm")]: {
          fontSize: 22,
          marginBottom: 6,
          paddingRight: 0,
        },
      },

      description: {
        fontSize: 15,
        color:
          theme.colorScheme === "dark"
            ? theme.colors.gray[4]
            : theme.colors.gray[6],
        marginBottom: 20,
        lineHeight: 1.6,
        maxWidth: 600,
        whiteSpace: "pre-line",

        [theme.fn.smallerThan("sm")]: {
          fontSize: 14,
          marginBottom: 16,
        },
      },

      statsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        marginTop: 20,

        [theme.fn.smallerThan("sm")]: {
          gap: 8,
          marginTop: 16,
        },
      },

      headerActionsRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        marginTop: 22,

        [theme.fn.smallerThan("sm")]: {
          flexDirection: "column",
          alignItems: "stretch",
          gap: 10,
          marginTop: 18,
        },
      },

      headerActionsLeft: {
        display: "flex",
        alignItems: "center",
        gap: 12,

        [theme.fn.smallerThan("sm")]: {
          width: "100%",
        },
      },

      headerActionsRight: {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        marginLeft: "auto",

        [theme.fn.smallerThan("sm")]: {
          width: "100%",
          marginLeft: 0,
        },
      },

      statsAndDownloadRow: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
        marginTop: 20,

        [theme.fn.smallerThan("md")]: {
          flexDirection: "column",
          alignItems: "stretch",
          gap: 14,
        },
      },

      statsRowNoEdit: {
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        flex: 1,
        minWidth: 0,

        [theme.fn.smallerThan("sm")]: {
          gap: 8,
        },
      },

      downloadAllInline: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        flexShrink: 0,

        [theme.fn.smallerThan("md")]: {
          width: "100%",
          justifyContent: "stretch",
        },
      },

      statBadge: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 12,
        background:
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(effectiveAccent)}, 0.1)`
            : `rgba(${hexToRgb(effectiveAccent)}, 0.08)`,
        border: `1px solid rgba(${hexToRgb(effectiveAccent)}, ${theme.colorScheme === "dark" ? 0.2 : 0.15})`,
        color:
          theme.colorScheme === "dark"
            ? theme.colors.gray[2]
            : theme.colors.gray[7],
        fontSize: 13,
        fontWeight: 500,
        transition: "all 0.2s ease",
        whiteSpace: "nowrap",

        "&:hover": {
          background:
            theme.colorScheme === "dark"
              ? `rgba(${hexToRgb(effectiveAccent)}, 0.15)`
              : `rgba(${hexToRgb(effectiveAccent)}, 0.12)`,
          borderColor: `rgba(${hexToRgb(effectiveAccent)}, 0.3)`,
        },

        [theme.fn.smallerThan("sm")]: {
          padding: "8px 12px",
          fontSize: 12,
          gap: 6,
          borderRadius: 10,
        },
      },

      statIcon: {
        color: effectiveAccent,
        filter: `drop-shadow(0 0 4px rgba(${hexToRgb(effectiveAccent)}, 0.4))`,
        flexShrink: 0,
      },

      cleanScanBadge: {
        position: "absolute",
        top: 28,
        right: 32,
        zIndex: 2,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 13px",
        borderRadius: 999,
        color: effectiveAccent,
        fontSize: 13,
        fontWeight: 800,
        whiteSpace: "nowrap",
        background:
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(effectiveAccent)}, 0.12)`
            : `rgba(${hexToRgb(effectiveAccent)}, 0.1)`,
        border: `1px solid rgba(${hexToRgb(effectiveAccent)}, 0.26)`,
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 10px 24px rgba(${hexToRgb(effectiveAccent)}, 0.1)`
            : `0 10px 24px rgba(${hexToRgb(effectiveAccent)}, 0.08)`,

        [theme.fn.smallerThan("sm")]: {
          position: "static",
          marginBottom: 14,
          width: "fit-content",
          fontSize: 12,
        },
      },

      shareScanCard: {
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background:
          theme.colorScheme === "dark"
            ? `linear-gradient(135deg, rgba(${hexToRgb(effectiveAccent)}, 0.12), rgba(8, 13, 12, 0.72))`
            : `linear-gradient(135deg, rgba(${hexToRgb(effectiveAccent)}, 0.1), rgba(255, 255, 255, 0.78))`,
        border: `1px solid rgba(${hexToRgb(effectiveAccent)}, ${theme.colorScheme === "dark" ? 0.24 : 0.2})`,

        [theme.fn.smallerThan("sm")]: {
          alignItems: "stretch",
          flexDirection: "column",
        },
      },

      shareScanIcon: {
        width: 30,
        height: 30,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: effectiveAccent,
        background: `rgba(${hexToRgb(effectiveAccent)}, 0.16)`,
        border: `1px solid rgba(${hexToRgb(effectiveAccent)}, 0.24)`,
      },

      shareScanButton: {
        flexShrink: 0,
        borderColor: `rgba(${hexToRgb(effectiveAccent)}, 0.36)`,
        color:
          theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
        background:
          theme.colorScheme === "dark"
            ? `rgba(${hexToRgb(effectiveAccent)}, 0.14)`
            : `rgba(${hexToRgb(effectiveAccent)}, 0.1)`,

        "&:hover": {
          background: `rgba(${hexToRgb(effectiveAccent)}, 0.22)`,
          borderColor: `rgba(${hexToRgb(effectiveAccent)}, 0.5)`,
        },
      },

      scanSpinIcon: {
        animation: "shareScanSpin 1s linear infinite",
      },

      "@keyframes shareScanSpin": {
        from: { transform: "rotate(0deg)" },
        to: { transform: "rotate(360deg)" },
      },

      filesSection: {
        position: "relative",
        zIndex: 1,
      },
    };
  },
);

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const shareId = context.params!.shareId as string;

  const protocol =
    (context.req.headers["x-forwarded-proto"] as string) || "https";
  const host =
    (context.req.headers["x-forwarded-host"] as string) ||
    context.req.headers.host ||
    "your-domain.com";
  const baseUrl = `${protocol}://${host}`;

  const apiURL = process.env.API_URL || baseUrl;

  let ogData = {
    title: "Shared Files",
    description: "Files shared securely",
    fileCount: 0,
    totalSize: "",
    hasImage: false,
    previewImageUrl: null as string | null,
    accentColor: DEFAULT_ACCENT,
  };

  try {
    const metaRes = await axios.get(
      `${apiURL}/api/shares/${shareId}/metaData`,
      {
        timeout: 5000,
        validateStatus: (status) => status < 500,
      },
    );

    if (metaRes.status === 200 && metaRes.data) {
      const meta = metaRes.data;

      if (meta.firstFileName) {
        ogData.title = meta.firstFileName;
      } else if (meta.name) {
        ogData.title = meta.name;
      } else {
        ogData.title = `Share: ${shareId}`;
      }

      if (meta.firstFileFacts) {
        ogData.description = meta.firstFileFacts;
      } else if (meta.description) {
        ogData.description = meta.description;
      } else if (meta.fileCount > 0) {
        ogData.fileCount = meta.fileCount;
        ogData.totalSize = formatBytes(meta.totalSize || 0);
        ogData.description = `${ogData.fileCount} file${ogData.fileCount !== 1 ? "s" : ""} · ${ogData.totalSize}`;
      }

      if (meta.accentColor) {
        ogData.accentColor = meta.accentColor;
      }

      if (meta.previewImageId && !meta.hasPassword) {
        ogData.hasImage = true;
        ogData.previewImageUrl = `${baseUrl}/api/shares/${shareId}/files/${meta.previewImageId}?download=false&preview=1`;
      }
    }
  } catch (e: any) {
    console.error(`Error fetching metadata:`, e.message || e);
  }

  return {
    props: {
      shareId,
      ogData,
      baseUrl,
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface OgData {
  title: string;
  description: string;
  fileCount: number;
  totalSize: string;
  hasImage: boolean;
  previewImageUrl: string | null;
  accentColor?: string | null;
}

function getShareFallbackLogo(
  baseUrl: string,
  accentColor: string | null | undefined,
  logoVersion: string,
): string {
  const normalizedAccent = accentColor?.toLowerCase() || DEFAULT_ACCENT;
  return `${baseUrl}/api/share-logo?accent=${encodeURIComponent(
    normalizedAccent,
  )}&v=${encodeURIComponent(logoVersion)}`;
}

function parseScanThreats(value?: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [value];
  }
}

type ShareBackgroundVars = CSSProperties & Record<`--share-${string}`, string>;

function createSeededRandom(seedText: string) {
  let seed = 2166136261;

  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function ranged(random: () => number, min: number, max: number) {
  return min + random() * (max - min);
}

function fixed(value: number, digits = 1) {
  return Number(value.toFixed(digits)).toString();
}

function getShareBackgroundVars(shareId: string): ShareBackgroundVars {
  const random = createSeededRandom(shareId || "dropshare-default");

  const glow1X = ranged(random, 8, 20);
  const glow1Y = ranged(random, 14, 26);
  const glow2X = ranged(random, 76, 92);
  const glow2Y = ranged(random, 14, 30);
  const glow3X = ranged(random, 40, 66);
  const glow3Y = ranged(random, 92, 110);

  const glow1Core = ranged(random, 0.3, 0.38);
  const glow2Core = ranged(random, 0.17, 0.24);
  const glow3Core = ranged(random, 0.12, 0.18);

  return {
    "--share-glow-blur": `${fixed(ranged(random, 12, 18), 0)}px`,
    "--share-glow-1-x": `${fixed(glow1X)}%`,
    "--share-glow-1-y": `${fixed(glow1Y)}%`,
    "--share-glow-1-w": `${fixed(ranged(random, 42, 56), 0)}vw`,
    "--share-glow-1-h": `${fixed(ranged(random, 32, 44), 0)}vh`,
    "--share-glow-1-core": fixed(glow1Core, 3),
    "--share-glow-1-mid": fixed(glow1Core * ranged(random, 0.48, 0.58), 3),
    "--share-glow-1-edge": fixed(glow1Core * ranged(random, 0.13, 0.18), 3),
    "--share-glow-1-core-light": fixed(glow1Core * 0.62, 3),
    "--share-glow-1-mid-light": fixed(glow1Core * 0.32, 3),
    "--share-glow-2-x": `${fixed(glow2X)}%`,
    "--share-glow-2-y": `${fixed(glow2Y)}%`,
    "--share-glow-2-w": `${fixed(ranged(random, 34, 48), 0)}vw`,
    "--share-glow-2-h": `${fixed(ranged(random, 28, 38), 0)}vh`,
    "--share-glow-2-core": fixed(glow2Core, 3),
    "--share-glow-2-mid": fixed(glow2Core * ranged(random, 0.44, 0.54), 3),
    "--share-glow-2-core-light": fixed(glow2Core * 0.66, 3),
    "--share-glow-2-mid-light": fixed(glow2Core * 0.34, 3),
    "--share-glow-3-x": `${fixed(glow3X)}%`,
    "--share-glow-3-y": `${fixed(glow3Y)}%`,
    "--share-glow-3-w": `${fixed(ranged(random, 58, 76), 0)}vw`,
    "--share-glow-3-h": `${fixed(ranged(random, 36, 50), 0)}vh`,
    "--share-glow-3-core": fixed(glow3Core, 3),
    "--share-glow-3-mid": fixed(glow3Core * ranged(random, 0.35, 0.45), 3),
    "--share-glow-3-core-light": fixed(glow3Core * 0.7, 3),
    "--share-glow-3-mid-light": fixed(glow3Core * 0.34, 3),
  };
}

function rgbStringToTuple(rgb: string): [number, number, number] {
  const [r, g, b] = rgb
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10));

  if ([r, g, b].some((value) => Number.isNaN(value))) return [0, 255, 90];
  return [r, g, b];
}

function ShareStarField({
  accentColor,
  className,
  shareId,
}: {
  accentColor: string;
  className: string;
  shareId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let stars: Array<{
      x: number;
      y: number;
      radius: number;
      baseAlpha: number;
      twinkleAlpha: number;
      period: number;
      phase: number;
      glow: number;
    }> = [];

    const [red, green, blue] = rgbStringToTuple(hexToRgb(accentColor));

    const buildStars = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const random = createSeededRandom(
        `${shareId || "dropshare-default"}:stars:${Math.round(width / 160)}:${Math.round(height / 160)}`,
      );
      const area = width * height;
      const starCount = Math.min(190, Math.max(72, Math.round(area / 14500)));

      stars = Array.from({ length: starCount }, () => {
        const bright = random() > 0.84;
        return {
          x: random() * width,
          y: random() * height,
          radius: bright ? ranged(random, 0.9, 1.75) : ranged(random, 0.35, 1.05),
          baseAlpha: bright ? ranged(random, 0.14, 0.32) : ranged(random, 0.045, 0.18),
          twinkleAlpha: bright ? ranged(random, 0.32, 0.68) : ranged(random, 0.12, 0.42),
          period: ranged(random, 4800, 15000),
          phase: ranged(random, 0, Math.PI * 2),
          glow: bright ? ranged(random, 5, 11) : ranged(random, 1.5, 5),
        };
      });
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);

      for (const star of stars) {
        const twinkle = motionQuery.matches
          ? 0.45
          : (Math.sin((time / star.period) * Math.PI * 2 + star.phase) + 1) / 2;
        const shimmer = motionQuery.matches
          ? 0
          : Math.pow(
              (Math.sin((time / (star.period * 0.47)) * Math.PI * 2 + star.phase * 1.7) + 1) / 2,
              6,
            );
        const alpha = Math.min(
          0.82,
          star.baseAlpha + star.twinkleAlpha * twinkle + shimmer * 0.25,
        );
        const radius = star.radius * (1 + twinkle * 0.32 + shimmer * 0.55);

        context.save();
        context.globalAlpha = alpha;
        context.shadowColor = `rgba(${red}, ${green}, ${blue}, ${Math.min(0.78, alpha + 0.18)})`;
        context.shadowBlur = star.glow + shimmer * 10;
        context.fillStyle = `rgba(${red}, ${green}, ${blue}, 1)`;
        context.beginPath();
        context.arc(star.x, star.y, radius, 0, Math.PI * 2);
        context.fill();

        if (shimmer > 0.72) {
          context.globalAlpha = alpha * 0.55;
          context.lineWidth = 0.65;
          context.strokeStyle = `rgba(${red}, ${green}, ${blue}, 1)`;
          context.beginPath();
          context.moveTo(star.x - radius * 3.2, star.y);
          context.lineTo(star.x + radius * 3.2, star.y);
          context.moveTo(star.x, star.y - radius * 3.2);
          context.lineTo(star.x, star.y + radius * 3.2);
          context.stroke();
        }

        context.restore();
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    const resizeObserver = new ResizeObserver(() => {
      buildStars();
    });

    buildStars();
    resizeObserver.observe(canvas);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [accentColor, shareId]);

  return <canvas aria-hidden="true" className={className} ref={canvasRef} />;
}

const Share = ({
  shareId,
  ogData,
  baseUrl,
}: {
  shareId: string;
  ogData: OgData;
  baseUrl: string;
}) => {
  const modals = useModals();
  const [share, setShare] = useState<ShareType>();
  const [canEdit, setCanEdit] = useState(false);
  const [lyricsPanelOpen, setLyricsPanelOpen] = useState(false);
  const [lyricsAvailable, setLyricsAvailable] = useState(false);
  const [lyricsPanelData, setLyricsPanelData] =
    useState<ShareLyricsPanelData | null>(null);
  const [shareScan, setShareScan] = useState<ShareVirusScan | null>(null);
  const [shareScanLoading, setShareScanLoading] = useState(false);
  const [showCleanScanBanner, setShowCleanScanBanner] = useState(false);
  const t = useTranslate();
  const _router = useRouter();
  const { user } = useUser();
  const config = useConfig();
  const siteName = config.get("general.appName") || "This site";
  // With scanning switched off nothing ever updates a scan status, so every
  // scan surface is hidden rather than left showing a stale or idle state.
  const virusScanEnabled = config.get("share.virusScanEnabled");
  const logoVersion = String(config.get("general.themeLogoVersion") || "1");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const previousShareScanStatusRef = useRef<string | null>(null);
  const cleanScanBannerTimerRef = useRef<number | null>(null);

  const hasTrackedView = useRef(false);

  const accentColor = useMemo(() => {
    return share?.accentColor || ogData.accentColor || DEFAULT_ACCENT;
  }, [ogData.accentColor, share?.accentColor]);

  const ogImage = useMemo(() => {
    return (
      ogData.previewImageUrl ||
      getShareFallbackLogo(
        baseUrl,
        share?.accentColor || ogData.accentColor,
        logoVersion,
      )
    );
  }, [
    baseUrl,
    logoVersion,
    ogData.accentColor,
    ogData.previewImageUrl,
    share?.accentColor,
  ]);

  const shareBackgroundVars = useMemo(
    () =>
      ({
        ...getShareBackgroundVars(shareId),
        "--share-accent": accentColor,
        "--share-accent-rgb": hexToRgb(accentColor),
      }) as ShareBackgroundVars,
    [accentColor, shareId],
  );

  const { classes } = useStyles({ accentColor });

  const lyricsPanelContent = lyricsPanelData ? (
    <>
      <Group position="apart" align="flex-start" noWrap mb="sm">
        <Box sx={{ minWidth: 0 }}>
          <Text weight={700} size="sm" lineClamp={2}>
            {lyricsPanelData.title || lyricsPanelData.fileName}
          </Text>
          <Text size="xs" color="dimmed" lineClamp={1}>
            {lyricsPanelData.artist || "Lyrics panel"}
          </Text>
        </Box>
      </Group>

      {lyricsPanelData.sourceUrl && (
        <Text
          component="a"
          href={lyricsPanelData.sourceUrl}
          target="_blank"
          rel="noreferrer"
          size="xs"
          mb="sm"
          sx={{ color: accentColor, display: "inline-block" }}
        >
          Open lyrics source
        </Text>
      )}

      <ScrollArea
        type="auto"
        scrollbarSize={8}
        offsetScrollbars
        sx={(theme) => ({
          height: isMobile
            ? "calc(78vh - 124px)"
            : "min(560px, calc(100vh - 260px))",
          minHeight: isMobile ? 280 : 240,
          [theme.fn.smallerThan("sm")]: {
            height: "calc(82vh - 132px)",
          },
        })}
        styles={{
          viewport: {
            paddingRight: 6,
          },
        }}
      >
        <Box
          sx={(theme) => ({
            padding: "4px 2px 8px",
            whiteSpace: "normal",
            lineHeight: 1.75,
            fontSize: 14,
            color:
              theme.colorScheme === "dark"
                ? theme.colors.gray[2]
                : theme.colors.dark[7],
          })}
          dangerouslySetInnerHTML={{
            __html: sanitizeLyricsHtml(lyricsPanelData.text),
          }}
        />
      </ScrollArea>
    </>
  ) : null;

  const getShareToken = async (password?: string) => {
    await shareService
      .getShareToken(shareId, password)
      .then(() => {
        modals.closeAll();
        hasTrackedView.current = true;
        getFiles();
      })
      .catch((e) => {
        const { error } = e.response.data;
        if (error == "share_max_views_exceeded") {
          showErrorModal(
            modals,
            t("share.error.visitor-limit-exceeded.title"),
            t("share.error.visitor-limit-exceeded.description"),
            "go-home",
          );
        } else if (error == "share_password_required") {
          showEnterPasswordModal(modals, getShareToken);
        } else {
          toast.axiosError(e);
        }
      });
  };

  const getFiles = async () => {
    try {
      const shareData = await shareService.get(shareId);
      setShare(shareData);
      setShareScan({
        id: shareData.id,
        virusScanStatus: shareData.virusScanStatus || "not_scanned",
        virusScanStartedAt: shareData.virusScanStartedAt,
        virusScanCompletedAt: shareData.virusScanCompletedAt,
        virusScanThreats: parseScanThreats(shareData.virusScanThreats),
        virusScanError: shareData.virusScanError,
      });

      if (!hasTrackedView.current) {
        hasTrackedView.current = true;
        fetch(`/api/shares/${shareId}/files/track-view`, { method: "POST" })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setShare((prev) =>
                prev
                  ? { ...prev, views: data.views, downloads: data.downloads }
                  : prev,
              );
            }
          })
          .catch(() => {});
      }
    } catch (e: any) {
      const { error } = e.response?.data || {};
      if (e.response?.status == 404) {
        if (error == "share_removed") {
          showErrorModal(
            modals,
            t("share.error.removed.title"),
            e.response.data.message,
            "go-home",
          );
        } else {
          showErrorModal(
            modals,
            t("share.error.not-found.title"),
            t("share.error.not-found.description"),
            "go-home",
          );
        }
      } else if (e.response?.status == 403 && error == "private_share") {
        showErrorModal(
          modals,
          t("share.error.access-denied.title"),
          t("share.error.access-denied.description"),
        );
      } else if (error == "share_password_required") {
        showEnterPasswordModal(modals, getShareToken);
      } else if (error == "share_token_required") {
        getShareToken();
      } else {
        showErrorModal(
          modals,
          t("common.error"),
          t("common.error.unknown"),
          "go-home",
        );
      }
    }
  };

  const pollShareVirusScan = () => {
    const timer = window.setInterval(async () => {
      try {
        const status = await shareService.getVirusScanStatus(shareId);
        setShareScan(status);

        if (status.virusScanStatus !== "scanning") {
          window.clearInterval(timer);
          setShareScanLoading(false);
        }
      } catch {
        window.clearInterval(timer);
        setShareScanLoading(false);
      }
    }, 2500);

    return timer;
  };

  const startShareVirusScan = async () => {
    setShareScanLoading(true);
    setShowCleanScanBanner(false);

    try {
      const status = await shareService.startVirusScan(shareId);
      setShareScan(status);

      if (status.virusScanStatus === "scanning") {
        toast.success(
          "Scanning all share files. This can take a bit for larger shares.",
        );
      } else if (status.virusScanStatus === "clean") {
        toast.success("All share files scanned clean.");
        setShareScanLoading(false);
      } else {
        setShareScanLoading(false);
      }
    } catch (error) {
      toast.axiosError(error);
      setShareScanLoading(false);
    }
  };

  const shareScanCopy = useMemo(() => {
    const status = shareScan?.virusScanStatus || "not_scanned";

    if (status === "scanning") {
      return {
        title: "Scanning all share files",
        description: "This share is being checked before download.",
        icon: <TbLoader2 size={20} className={classes.scanSpinIcon} />,
        button: "Scanning",
      };
    }

    if (status === "clean") {
      return {
        title: "All share files scanned clean",
        description: shareScan?.virusScanCompletedAt
          ? `Completed ${moment(shareScan.virusScanCompletedAt).fromNow()}.`
          : "No threats were detected.",
        icon: <TbShieldCheck size={20} />,
        button: "Scan again",
      };
    }

    if (status === "infected") {
      return {
        title: "Threat detected in share files",
        description: shareScan?.virusScanThreats?.length
          ? shareScan.virusScanThreats.join(", ")
          : "Downloads are blocked until the share is cleaned up.",
        icon: <TbAlertTriangle size={20} />,
        button: "Rescan",
      };
    }

    if (status === "too_large") {
      return {
        title: "Some files are above scanner max",
        description:
          "One or more files could not be scanned. Download at your own risk.",
        icon: <TbAlertTriangle size={20} />,
        button: null,
      };
    }

    if (status === "failed") {
      return {
        title: "File scan failed",
        description:
          shareScan?.virusScanError ||
          "The scan could not finish. You can try again.",
        icon: <TbAlertTriangle size={20} />,
        button: "Try again",
      };
    }

    return {
      title: "Scan all share files",
      description: "Checks every file in this share before download.",
      icon: <TbShieldCheck size={20} />,
      button: "Scan files",
    };
  }, [classes.scanSpinIcon, shareScan]);

  const shouldShowShareScanCard = Boolean(
    virusScanEnabled &&
      share?.files?.length &&
      shareScan &&
      (shareScan.virusScanStatus !== "clean" || showCleanScanBanner),
  );

  const cleanScanTooltip = useMemo(() => {
    if (!shareScan?.virusScanCompletedAt) return "Scan completed recently";
    return `Scanned ${moment(shareScan.virusScanCompletedAt).fromNow()}`;
  }, [shareScan?.virusScanCompletedAt]);

  useEffect(() => {
    if (shareScan?.virusScanStatus !== "scanning") return;

    setShareScanLoading(true);
    const timer = pollShareVirusScan();
    return () => window.clearInterval(timer);
  }, [shareScan?.virusScanStatus, shareId]);

  useEffect(() => {
    if (!shareScan?.virusScanStatus) return;

    const previousStatus = previousShareScanStatusRef.current;
    previousShareScanStatusRef.current = shareScan.virusScanStatus;

    if (
      previousStatus === "scanning" &&
      shareScan.virusScanStatus === "clean"
    ) {
      setShowCleanScanBanner(true);

      if (cleanScanBannerTimerRef.current) {
        window.clearTimeout(cleanScanBannerTimerRef.current);
      }

      cleanScanBannerTimerRef.current = window.setTimeout(() => {
        setShowCleanScanBanner(false);
        cleanScanBannerTimerRef.current = null;
      }, 10000);
    }

    if (shareScan.virusScanStatus !== "clean") {
      setShowCleanScanBanner(false);
      if (cleanScanBannerTimerRef.current) {
        window.clearTimeout(cleanScanBannerTimerRef.current);
        cleanScanBannerTimerRef.current = null;
      }
    }
  }, [shareScan?.virusScanStatus]);

  useEffect(() => {
    return () => {
      if (cleanScanBannerTimerRef.current) {
        window.clearTimeout(cleanScanBannerTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    getFiles();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.documentElement.style.setProperty("--share-accent", accentColor);
    document.documentElement.style.setProperty(
      "--share-accent-rgb",
      hexToRgb(accentColor),
    );
    document.documentElement.style.setProperty(
      "--share-accent-hue",
      hexToHue(accentColor),
    );

    // Repoint the site header at this share's accent while the share is open,
    // otherwise the bar above a purple share stays the site's colour. 0.15
    // matches how the site's own header background relates to its accent.
    const headerBackground = shade(accentColor, 0.15);
    document.documentElement.style.setProperty(
      "--ls-header-bg",
      headerBackground,
    );
    document.documentElement.style.setProperty(
      "--ls-header-bg-rgb",
      hexToRgb(headerBackground),
    );
    document.documentElement.style.setProperty(
      "--ls-header-border-rgb",
      hexToRgb(accentColor),
    );

    updateThemeColor(accentColor);

    return () => {
      document.documentElement.style.removeProperty("--share-accent");
      document.documentElement.style.removeProperty("--share-accent-rgb");
      document.documentElement.style.removeProperty("--share-accent-hue");
      document.documentElement.style.removeProperty("--ls-header-bg");
      document.documentElement.style.removeProperty("--ls-header-bg-rgb");
      document.documentElement.style.removeProperty("--ls-header-border-rgb");
    };
  }, [accentColor]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    const resumeDecorMotion = () => {
      document.documentElement.style.setProperty(
        "--share-decor-motion",
        "running",
      );
    };

    const pauseDecorMotion = () => {
      document.documentElement.style.setProperty(
        "--share-decor-motion",
        "paused",
      );

      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
      scrollTimer = setTimeout(resumeDecorMotion, 160);
    };

    window.addEventListener("scroll", pauseDecorMotion, { passive: true });
    window.addEventListener("wheel", pauseDecorMotion, { passive: true });
    window.addEventListener("touchmove", pauseDecorMotion, { passive: true });

    return () => {
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
      resumeDecorMotion();
      window.removeEventListener("scroll", pauseDecorMotion);
      window.removeEventListener("wheel", pauseDecorMotion);
      window.removeEventListener("touchmove", pauseDecorMotion);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setCanEdit(false);
      return;
    }

    shareService
      .getFromOwner(shareId)
      .then(() => setCanEdit(true))
      .catch(() => setCanEdit(false));
  }, [shareId, user?.id]);

  const totalSize = useMemo(() => {
    if (!share?.files?.length) return 0;
    return share.files.reduce(
      (total: number, file: { size: string }) => total + parseInt(file.size),
      0,
    );
  }, [share?.files]);

  const expirationText = useMemo(() => {
    if (!share?.expiration) return null;
    const expDate = moment(share.expiration);
    if (expDate.year() === 9999 || expDate.unix() === 0) return null;
    const now = moment();
    if (expDate.isBefore(now)) return "Expired";
    return `Expires ${expDate.fromNow()}`;
  }, [share?.expiration]);

  return (
    <>
      <Head>
        <title>{ogData.title || share?.name || "Share"}</title>
        <meta name="description" content={ogData.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${baseUrl}/share/${shareId}`} />
        <meta property="og:title" content={ogData.title} />
        <meta property="og:description" content={ogData.description} />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:image" content={ogImage} />
        <meta
          property="og:image:alt"
          content={ogData.title || share?.name || siteName}
        />

        <meta
          name="twitter:card"
          content={ogData.hasImage ? "summary_large_image" : "summary"}
        />
        <meta name="twitter:title" content={ogData.title} />
        <meta name="twitter:description" content={ogData.description} />
        <meta name="twitter:image" content={ogImage} />

        <meta
          name="theme-color"
          content={share?.accentColor || ogData.accentColor || DEFAULT_ACCENT}
          key="theme-color"
        />
      </Head>

      <div className={classes.pageTint} style={shareBackgroundVars} />
      <ShareStarField
        accentColor={accentColor}
        className={classes.starField}
        shareId={shareId}
      />
      <div className={`${classes.ribbon} ${classes.ribbonPrimary}`} />
      <div className={`${classes.ribbon} ${classes.ribbonSecondary}`} />
      <div className={`${classes.ribbon} ${classes.ribbonTertiary}`} />
      <div className={classes.backgroundPattern} />
      <div className={classes.ambientGlow} />

      <Box className={classes.wrapper}>
        <Box
          sx={(theme) => ({
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            width: "100%",
            gap: !isMobile && lyricsAvailable && lyricsPanelOpen ? 48 : 0,
            paddingInline: "clamp(12px, 2vw, 24px)",
            transition: "gap 0.24s ease",
            [theme.fn.smallerThan("md")]: {
              display: "block",
            },
          })}
        >
          <Box
            sx={(theme) => ({
              position: "relative",
              width: "min(100%, 980px)",
              minWidth: 0,
              [theme.fn.smallerThan("md")]: {
                width: "100%",
              },
            })}
          >
            <Box className={classes.headerCard}>
              <div className={classes.cardAccentLine} />

              {virusScanEnabled &&
                !!share?.files?.length &&
                shareScan?.virusScanStatus === "clean" && (
                  <Tooltip label={cleanScanTooltip} withArrow position="top">
                    <div className={classes.cleanScanBadge}>
                      <TbShieldCheck size={16} />
                      <span>No virus detected</span>
                    </div>
                  </Tooltip>
                )}

              <div className={classes.headerContent}>
                <div className={classes.headerLayout}>
                  <Box className={classes.headerInfo}>
                    {share ? (
                      <Title order={1} className={classes.shareName}>
                        {share.name || share.id}
                      </Title>
                    ) : (
                      <Skeleton height={36} width="60%" mb="sm" />
                    )}

                    {share?.description && (
                      <Text className={classes.description}>
                        {share.description}
                      </Text>
                    )}

                    {share ? (
                      !canEdit && share.files?.length > 1 ? (
                        <div className={classes.statsAndDownloadRow}>
                          <div className={classes.statsRowNoEdit}>
                            <div className={classes.statBadge}>
                              <TbFiles size={18} className={classes.statIcon} />
                              <span>
                                {share.files?.length || 0}{" "}
                                {share.files?.length === 1 ? "file" : "files"}
                                {totalSize > 0 &&
                                  ` · ${byteToHumanSizeString(totalSize)}`}
                              </span>
                            </div>

                            <div className={classes.statBadge}>
                              <TbEye size={18} className={classes.statIcon} />
                              <span>
                                {share.views ?? 0}{" "}
                                {(share.views ?? 0) === 1 ? "view" : "views"}
                              </span>
                            </div>

                            <div className={classes.statBadge}>
                              <TbDownload
                                size={18}
                                className={classes.statIcon}
                              />
                              <span>
                                {share.downloads ?? 0}{" "}
                                {(share.downloads ?? 0) === 1
                                  ? "download"
                                  : "downloads"}
                              </span>
                            </div>

                            {expirationText && (
                              <div className={classes.statBadge}>
                                <TbCalendar
                                  size={18}
                                  className={classes.statIcon}
                                />
                                <span>{expirationText}</span>
                              </div>
                            )}
                          </div>

                          <div className={classes.downloadAllInline}>
                            <DownloadAllButton
                              shareId={shareId}
                              accentColor={accentColor}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className={classes.statsRow}>
                          <div className={classes.statBadge}>
                            <TbFiles size={18} className={classes.statIcon} />
                            <span>
                              {share.files?.length || 0}{" "}
                              {share.files?.length === 1 ? "file" : "files"}
                              {totalSize > 0 &&
                                ` · ${byteToHumanSizeString(totalSize)}`}
                            </span>
                          </div>

                          <div className={classes.statBadge}>
                            <TbEye size={18} className={classes.statIcon} />
                            <span>
                              {share.views ?? 0}{" "}
                              {(share.views ?? 0) === 1 ? "view" : "views"}
                            </span>
                          </div>

                          <div className={classes.statBadge}>
                            <TbDownload
                              size={18}
                              className={classes.statIcon}
                            />
                            <span>
                              {share.downloads ?? 0}{" "}
                              {(share.downloads ?? 0) === 1
                                ? "download"
                                : "downloads"}
                            </span>
                          </div>

                          {expirationText && (
                            <div className={classes.statBadge}>
                              <TbCalendar
                                size={18}
                                className={classes.statIcon}
                              />
                              <span>{expirationText}</span>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className={classes.statsRow}>
                        <Skeleton height={40} width={120} radius="md" />
                        <Skeleton height={40} width={90} radius="md" />
                        <Skeleton height={40} width={110} radius="md" />
                      </div>
                    )}

                    {shouldShowShareScanCard && (
                      <div className={classes.shareScanCard}>
                        <Group spacing="sm" noWrap sx={{ minWidth: 0 }}>
                          <div className={classes.shareScanIcon}>
                            {shareScanCopy.icon}
                          </div>
                          <Box sx={{ minWidth: 0 }}>
                            <Text weight={800} size="sm" lineClamp={1}>
                              {shareScanCopy.title}
                            </Text>
                            <Text size="xs" color="dimmed" lineClamp={2}>
                              {shareScanCopy.description}
                            </Text>
                          </Box>
                        </Group>

                        {shareScanCopy.button ? (
                          <Button
                            variant="outline"
                            className={classes.shareScanButton}
                            loading={
                              shareScanLoading ||
                              shareScan?.virusScanStatus === "scanning"
                            }
                            disabled={shareScan?.virusScanStatus === "scanning"}
                            leftIcon={<TbShieldCheck size={16} />}
                            onClick={startShareVirusScan}
                            sx={(theme) => ({
                              [theme.fn.smallerThan("sm")]: {
                                width: "100%",
                              },
                            })}
                          >
                            {shareScanCopy.button}
                          </Button>
                        ) : null}
                      </div>
                    )}

                    {canEdit && (
                      <div className={classes.headerActionsRow}>
                        <div className={classes.headerActionsLeft}>
                          <Button
                            variant="outline"
                            leftIcon={<TbEdit size={16} />}
                            sx={(theme) => ({
                              borderColor: `rgba(${hexToRgb(accentColor)}, 0.35)`,
                              color:
                                theme.colorScheme === "dark"
                                  ? theme.white
                                  : theme.colors.dark[7],
                              background:
                                theme.colorScheme === "dark"
                                  ? "rgba(8, 14, 12, 0.4)"
                                  : "rgba(255,255,255,0.7)",
                              "&:hover": {
                                background: `rgba(${hexToRgb(accentColor)}, 0.14)`,
                                borderColor: `rgba(${hexToRgb(accentColor)}, 0.5)`,
                              },
                              [theme.fn.smallerThan("sm")]: {
                                width: "100%",
                              },
                            })}
                            onClick={() =>
                              window.location.assign(`/share/${shareId}/edit`)
                            }
                          >
                            Edit share
                          </Button>
                        </div>

                        <div className={classes.headerActionsRight}>
                          {share?.files && share.files.length > 1 && (
                            <DownloadAllButton
                              shareId={shareId}
                              accentColor={accentColor}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </Box>
                </div>
              </div>
            </Box>

            <Box className={classes.filesSection}>
              <FileList
                files={share?.files}
                setShare={setShare}
                share={share!}
                isLoading={!share}
                accentColor={accentColor}
                lyricsPanelOpen={!isMobile && lyricsPanelOpen}
                onLyricsPanelOpenChange={setLyricsPanelOpen}
                onLyricsAvailabilityChange={setLyricsAvailable}
                onLyricsDataChange={setLyricsPanelData}
              />
            </Box>
          </Box>

          <Box
            sx={(theme) => ({
              width: !isMobile && lyricsAvailable && lyricsPanelOpen ? 368 : 0,
              minWidth:
                !isMobile && lyricsAvailable && lyricsPanelOpen ? 368 : 0,
              flexShrink: 0,
              transition: "width 0.24s ease, min-width 0.24s ease",
              overflow: "hidden",
              [theme.fn.smallerThan("md")]: {
                display: "none",
              },
            })}
          >
            {lyricsAvailable && lyricsPanelData && (
              <Paper
                radius="xl"
                p="md"
                sx={(theme) => ({
                  width: 368,
                  marginLeft: 0,
                  minHeight: 220,
                  background:
                    `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.82 : 0.94})`,
                  backdropFilter: "blur(16px)",
                  border: "none",
                  boxShadow:
                    theme.colorScheme === "dark"
                      ? `0 16px 36px rgba(0, 0, 0, 0.28)`
                      : `0 14px 32px rgba(0, 0, 0, 0.07)`,
                })}
              >
                {lyricsPanelContent}
              </Paper>
            )}
          </Box>
        </Box>
      </Box>

      <Drawer
        opened={Boolean(
          isMobile && lyricsAvailable && lyricsPanelOpen && lyricsPanelData,
        )}
        onClose={() => setLyricsPanelOpen(false)}
        position="bottom"
        size="82vh"
        padding="md"
        title={
          <Group spacing="xs" noWrap>
            <TbMusic size={18} color={accentColor} />
            <Text weight={800}>Lyrics</Text>
          </Group>
        }
        styles={(theme) => ({
          drawer: {
            background:
              theme.colorScheme === "dark"
                ? "rgba(var(--ls-panel-bg-rgb), 0.98)"
                : "rgba(255, 255, 255, 0.99)",
            borderRadius: "22px 22px 0 0",
            borderTop: `1px solid rgba(${hexToRgb(accentColor)}, 0.32)`,
            boxShadow: `0 -18px 46px rgba(${hexToRgb(accentColor)}, 0.18)`,
          },
          header: {
            marginBottom: 8,
          },
          title: {
            minWidth: 0,
          },
          closeButton: {
            color:
              theme.colorScheme === "dark"
                ? theme.colors.gray[2]
                : theme.colors.dark[6],
          },
        })}
      >
        {lyricsPanelContent}
      </Drawer>
    </>
  );
};

export default Share;
