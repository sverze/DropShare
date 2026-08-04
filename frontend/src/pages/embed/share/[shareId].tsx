import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  createStyles,
} from "@mantine/core";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  TbDownload,
  TbExternalLink,
  TbFile,
  TbFileTypePdf,
  TbMusic,
  TbVideo,
} from "react-icons/tb";
import useConfig from "../../../hooks/config.hook";
import { logoVersion, versionedAsset } from "../../../utils/logo-asset.util";
import shareService from "../../../services/share.service";
import { FileMetaData } from "../../../types/File.type";
import { Share } from "../../../types/share.type";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import { rgbString as hexToRgb } from "../../../theme/theme.util";

type PreviewKind = "audio" | "video" | "pdf" | "image" | "file";
type AudioMetadata = {
  coverDataUrl?: string | null;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
};

const DEFAULT_ACCENT = "#00ff5a";

function shiftHue(hex: string, degrees: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;

  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  h = (h + degrees + 360) % 360;
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

function getPreviewKind(file?: FileMetaData | null): PreviewKind {
  const name = file?.name.toLowerCase() || "";
  if (/\.(mp3|wav|m4a|aac|ogg|flac|aif|aiff)$/i.test(name)) return "audio";
  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(name)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name)) return "image";
  if (name.endsWith(".pdf")) return "pdf";
  return "file";
}

function getFileLabel(kind: PreviewKind) {
  if (kind === "audio") return "Audio";
  if (kind === "video") return "Video";
  if (kind === "image") return "Image";
  if (kind === "pdf") return "PDF";
  return "File";
}

const useStyles = createStyles(
  (theme, { accent, logoUrl }: { accent: string; logoUrl: string }) => {
  const rgb = hexToRgb(accent);
  const secondaryRgb = hexToRgb(shiftHue(accent, 18));
  const tertiaryRgb = hexToRgb(shiftHue(accent, -18));

  return {
    shell: {
      minHeight: "100vh",
      padding: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background:
        theme.colorScheme === "dark"
          ? `
            radial-gradient(circle at 26% 18%, rgba(${rgb}, 0.1) 0%, rgba(${rgb}, 0.035) 18%, rgba(${rgb}, 0) 36%),
            radial-gradient(circle at 72% 22%, rgba(${secondaryRgb}, 0.07) 0%, rgba(${secondaryRgb}, 0.02) 16%, rgba(${secondaryRgb}, 0) 34%),
            radial-gradient(circle at 58% 74%, rgba(${tertiaryRgb}, 0.06) 0%, rgba(${tertiaryRgb}, 0.018) 16%, rgba(${tertiaryRgb}, 0) 36%),
            linear-gradient(180deg, rgba(3, 10, 8, 0.96) 0%, rgba(4, 9, 8, 0.985) 100%)
          `
          : `
            radial-gradient(circle at 26% 18%, rgba(${rgb}, 0.14) 0%, rgba(${rgb}, 0.045) 18%, rgba(${rgb}, 0) 36%),
            radial-gradient(circle at 72% 22%, rgba(${secondaryRgb}, 0.095) 0%, rgba(${secondaryRgb}, 0.03) 16%, rgba(${secondaryRgb}, 0) 34%),
            radial-gradient(circle at 58% 74%, rgba(${tertiaryRgb}, 0.085) 0%, rgba(${tertiaryRgb}, 0.025) 16%, rgba(${tertiaryRgb}, 0) 36%),
            linear-gradient(180deg, rgba(248,252,248,0.98) 0%, rgba(245,249,243,0.98) 40%, rgba(248,244,236,0.98) 100%)
          `,
      backgroundColor: theme.colorScheme === "dark" ? "#040908" : "#f7fbf8",
    },

    frame: {
      width: "min(720px, 100%)",
      borderRadius: 26,
      padding: 1,
      background: `linear-gradient(135deg, rgba(${rgb}, 0.72), rgba(255,255,255,0.1), rgba(${rgb}, 0.25))`,
      boxShadow:
        theme.colorScheme === "dark"
          ? `0 24px 70px rgba(0, 0, 0, 0.62), 0 0 90px rgba(${rgb}, 0.16)`
          : `0 24px 66px rgba(15, 23, 42, 0.14), 0 0 90px rgba(${rgb}, 0.16)`,
    },

    card: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 29,
      padding: 18,
      background:
        theme.colorScheme === "dark"
          ? "linear-gradient(135deg, rgba(var(--ls-panel-bg-rgb), 0.82), rgba(var(--ls-panel-bg-rgb), 0.92))"
          : "linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(239, 250, 248, 0.95))",
      backdropFilter: "blur(24px)",
      border: `1px solid rgba(${rgb}, ${theme.colorScheme === "dark" ? 0.2 : 0.26})`,

      "&::before": {
        content: "\"\"",
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `
          radial-gradient(circle at 16% 10%, rgba(${rgb}, 0.18), transparent 32%),
          linear-gradient(120deg, rgba(255,255,255,0.08), transparent 34%)
        `,
      },
    },

    content: {
      position: "relative",
      zIndex: 1,
    },

    logoMask: {
      width: 36,
      height: 36,
      flexShrink: 0,
      backgroundColor: accent,
      boxShadow: `0 0 24px rgba(${rgb}, 0.18)`,
      WebkitMaskImage: `url('${logoUrl}')`,
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      WebkitMaskSize: "contain",
      maskImage: `url('${logoUrl}')`,
      maskRepeat: "no-repeat",
      maskPosition: "center",
      maskSize: "contain",
    },

    mediaGrid: {
      display: "grid",
      gridTemplateColumns: "126px 1fr",
      gap: 18,
      alignItems: "center",

      [theme.fn.smallerThan("xs")]: {
        gridTemplateColumns: "1fr",
      },
    },

    videoMediaGrid: {
      gridTemplateColumns: "1fr",
    },

    artwork: {
      width: 126,
      height: 126,
      aspectRatio: "1 / 1",
      alignSelf: "start",
      borderRadius: 18,
      display: "grid",
      placeItems: "center",
      color: accent,
      background:
        theme.colorScheme === "dark"
          ? `linear-gradient(135deg, rgba(${rgb}, 0.18), rgba(255,255,255,0.05))`
          : `linear-gradient(135deg, rgba(${rgb}, 0.16), rgba(255,255,255,0.78))`,
      border: `1px solid rgba(${rgb}, 0.22)`,
      overflow: "hidden",

      [theme.fn.smallerThan("xs")]: {
        width: "100%",
        maxWidth: 180,
        height: 180,
      },
    },

    videoPreview: {
      width: "100%",
      maxHeight: 180,
      borderRadius: 18,
      display: "block",
      backgroundColor: "#000",
      border: `1px solid rgba(${rgb}, 0.22)`,
      boxShadow: `0 18px 38px rgba(${rgb}, 0.12)`,
    },

    title: {
      color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
      letterSpacing: "-0.03em",
      lineHeight: 1.08,
      fontSize: 26,

      [theme.fn.smallerThan("xs")]: {
        fontSize: 22,
      },
    },

    progressTrack: {
      position: "relative",
      height: 10,
      borderRadius: 999,
      background:
        theme.colorScheme === "dark"
          ? "rgba(255,255,255,0.12)"
          : "rgba(15,23,42,0.12)",
      overflow: "hidden",
    },

    progressFill: {
      position: "absolute",
      inset: 0,
      width: "38%",
      borderRadius: 999,
      background: `linear-gradient(90deg, ${accent}, rgba(${rgb}, 0.58))`,
      boxShadow: `0 0 22px rgba(${rgb}, 0.36)`,
    },

    glassButton: {
      borderRadius: 14,
      border: `1px solid rgba(${rgb}, 0.32)`,
      background:
        theme.colorScheme === "dark"
          ? `rgba(${rgb}, 0.13)`
          : `rgba(${rgb}, 0.12)`,
      color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],

      "&:hover": {
        background: `rgba(${rgb}, 0.22)`,
      },
    },

    primaryButton: {
      borderRadius: 16,
      background: `linear-gradient(135deg, ${accent}, rgba(${rgb}, 0.72))`,
      color: "#06100c",
      fontWeight: 800,
      boxShadow: `0 14px 32px rgba(${rgb}, 0.26)`,

      "&:hover": {
        background: `linear-gradient(135deg, ${accent}, rgba(${rgb}, 0.86))`,
      },
    },
  };
});

function ShareEmbedPageInner() {
  const router = useRouter();
  const config = useConfig();
  const shareId = typeof router.query.shareId === "string" ? router.query.shareId : "";
  const requestedFileId = typeof router.query.file === "string" ? router.query.file : "";
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioMetadata, setAudioMetadata] = useState<AudioMetadata | null>(null);

  useEffect(() => {
    if (!shareId) return;

    shareService
      .get(shareId)
      .then((data) => {
        setShare(data);
        setError(null);
      })
      .catch(() => {
        setError("This share cannot be embedded. It may be private, expired, or password protected.");
      });
  }, [shareId]);

  const files = useMemo<FileMetaData[]>(() => {
    if (!share?.files) return [];
    return [...share.files].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [share?.files]);

  const selectedFile =
    files.find((file) => file.id === requestedFileId) ||
    files.find((file) => getPreviewKind(file) !== "file") ||
    files[0] ||
    null;
  const kind = getPreviewKind(selectedFile);
  const accent = share?.accentColor || DEFAULT_ACCENT;
  const embedLogoUrl = versionedAsset(
    "/img/logo.png",
    logoVersion((key) => config.get(key)),
  );
  const { classes } = useStyles({ accent, logoUrl: embedLogoUrl });
  const rgb = hexToRgb(accent);
  const fileUrl = selectedFile
    ? `/api/shares/${shareId}/files/${selectedFile.id}?download=false&preview=1`
    : "";
  const downloadUrl = selectedFile
    ? `/api/shares/${shareId}/files/${selectedFile.id}`
    : `/s/${shareId}`;
  const openUrl = `/s/${shareId}`;

  const Icon =
    kind === "audio"
      ? TbMusic
      : kind === "video"
      ? TbVideo
      : kind === "pdf"
      ? TbFileTypePdf
      : TbFile;

  useEffect(() => {
    setAudioMetadata(null);

    if (!shareId || !selectedFile || kind !== "audio") return;

    fetch(`/api/shares/${shareId}/files/${selectedFile.id}/metadata`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAudioMetadata(data))
      .catch(() => setAudioMetadata(null));
  }, [kind, selectedFile?.id, shareId]);

  const artworkUrl =
    kind === "image"
      ? fileUrl
      : kind === "audio" && audioMetadata?.coverDataUrl
      ? audioMetadata.coverDataUrl
      : null;

  return (
    <>
      <Head>
        <title>{share?.name || selectedFile?.name || "Shared file"}</title>
      </Head>
      <style jsx global>{`
        html,
        body,
        #__next {
          background: ${
            share
              ? `radial-gradient(circle at 26% 18%, rgba(${rgb}, 0.1) 0%, rgba(${rgb}, 0.035) 18%, rgba(${rgb}, 0) 36%),
            radial-gradient(circle at 72% 22%, rgba(${hexToRgb(shiftHue(accent, 18))}, 0.07) 0%, rgba(${hexToRgb(shiftHue(accent, 18))}, 0.02) 16%, rgba(${hexToRgb(shiftHue(accent, 18))}, 0) 34%),
            radial-gradient(circle at 58% 74%, rgba(${hexToRgb(shiftHue(accent, -18))}, 0.06) 0%, rgba(${hexToRgb(shiftHue(accent, -18))}, 0.018) 16%, rgba(${hexToRgb(shiftHue(accent, -18))}, 0) 36%),
            linear-gradient(180deg, rgba(3, 10, 8, 0.96) 0%, rgba(4, 9, 8, 0.985) 100%)`
              : "#040908"
          } !important;
          background-attachment: fixed !important;
        }

        body::before {
          display: none !important;
          content: none !important;
        }
      `}</style>

      <Box className={classes.shell}>
        <Box className={classes.frame}>
          <Paper className={classes.card}>
            <Stack spacing="md" className={classes.content}>
              <Group position="apart" noWrap>
                <Group spacing="sm" noWrap>
                  <Box className={classes.logoMask} aria-label="Logo" />
                  <Box>
                    <Text weight={900} size="lg">
                      Last<span style={{ color: accent }}>Share</span>
                    </Text>
                    <Text size="xs" color="dimmed">
                      Embedded preview
                    </Text>
                  </Box>
                </Group>

                <Badge
                  sx={{
                    color: accent,
                    background: `rgba(${rgb}, 0.12)`,
                    border: `1px solid rgba(${rgb}, 0.22)`,
                  }}
                >
                  {getFileLabel(kind)}
                </Badge>
              </Group>

              {error ? (
                <Paper p="lg" radius="lg" className={classes.glassButton}>
                  <Text weight={800}>Preview unavailable</Text>
                  <Text color="dimmed" size="sm" mt={6}>
                    {error}
                  </Text>
                  <Button component="a" href={openUrl} target="_blank" mt="md" className={classes.primaryButton}>
                    Open on {config.get("general.appName") || "the site"}
                  </Button>
                </Paper>
              ) : !share || !selectedFile ? (
                <Paper p="lg" radius="lg" className={classes.glassButton}>
                  <Text weight={800}>Loading preview...</Text>
                </Paper>
              ) : (
                <Box className={`${classes.mediaGrid} ${kind === "video" ? classes.videoMediaGrid : ""}`}>
                  {kind !== "video" && (
                    <Box className={classes.artwork}>
                      {artworkUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={artworkUrl}
                          alt={selectedFile.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <Icon size={70} strokeWidth={1.5} />
                      )}
                    </Box>
                  )}

                  <Stack spacing="md" sx={{ minWidth: 0, justifyContent: "space-between" }}>
                    <Box>
                      <Title order={2} className={classes.title} lineClamp={2}>
                        {share.name || share.id}
                      </Title>
                      <Text color="dimmed" mt={6} lineClamp={1}>
                        {audioMetadata?.title || selectedFile.name}
                      </Text>
                      <Text size="sm" color="dimmed" mt={4}>
                        {getFileLabel(kind)} · {byteToHumanSizeString(parseInt(selectedFile.size || "0"))}
                      </Text>
                    </Box>

                    {kind === "video" ? (
                      <video controls preload="metadata" src={fileUrl} className={classes.videoPreview} />
                    ) : kind === "audio" ? (
                      <audio controls preload="metadata" src={fileUrl} style={{ width: "100%" }} />
                    ) : kind === "pdf" ? (
                      <Paper p="md" radius="lg" sx={{ border: `1px solid rgba(${rgb}, 0.2)`, background: `rgba(${rgb}, 0.08)` }}>
                        <Text weight={700}>PDF preview</Text>
                        <Text size="sm" color="dimmed" mt={4}>
                          Open the share to view or download this document.
                        </Text>
                      </Paper>
                    ) : (
                      <Box className={classes.progressTrack}>
                        <Box className={classes.progressFill} />
                      </Box>
                    )}

                    <Group spacing="sm">
                      <Button component="a" href={downloadUrl} target="_blank" leftIcon={<TbDownload size={18} />} className={classes.primaryButton}>
                        Download
                      </Button>
                      <Button component="a" href={openUrl} target="_blank" leftIcon={<TbExternalLink size={18} />} className={classes.glassButton} variant="default">
                        Open share
                      </Button>
                    </Group>
                  </Stack>
                </Box>
              )}
            </Stack>
          </Paper>
        </Box>
      </Box>
    </>
  );
}

export default function ShareEmbedPage() {
  return <ShareEmbedPageInner />;
}
