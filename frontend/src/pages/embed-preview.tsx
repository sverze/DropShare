import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
  createStyles,
} from "@mantine/core";
import Head from "next/head";
import { useMemo, useState } from "react";
import {
  TbBrandLastfm,
  TbDownload,
  TbExternalLink,
  TbFile,
  TbFileTypePdf,
  TbMusic,
  TbPlayerPause,
  TbPlayerPlay,
  TbVideo,
  TbVolume,
} from "react-icons/tb";
import { rgbString as hexToRgb } from "../theme/theme.util";

type PreviewKind = "audio" | "video" | "pdf" | "file";

const ACCENTS: Record<PreviewKind, string> = {
  audio: "#5cc8ff",
  video: "#ff6fb7",
  pdf: "#ffb454",
  file: "#00ff5a",
};


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

const useStyles = createStyles((theme, { accent }: { accent: string }) => {
  const rgb = hexToRgb(accent);
  const secondaryRgb = hexToRgb(shiftHue(accent, 18));
  const tertiaryRgb = hexToRgb(shiftHue(accent, -18));

  return {
    shell: {
      minHeight: "100vh",
      padding: 24,
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

      [theme.fn.smallerThan("sm")]: {
        padding: 14,
      },
    },

    stage: {
      width: "min(920px, 100%)",
    },

    previewFrame: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 34,
      padding: 1,
      background: `linear-gradient(135deg, rgba(${rgb}, 0.72), rgba(255,255,255,0.1), rgba(${rgb}, 0.25))`,
      boxShadow:
        theme.colorScheme === "dark"
          ? `0 30px 90px rgba(0, 0, 0, 0.62), 0 0 110px rgba(${rgb}, 0.18)`
          : `0 30px 80px rgba(15, 23, 42, 0.16), 0 0 100px rgba(${rgb}, 0.18)`,
    },

    card: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 33,
      padding: 28,
      background:
        theme.colorScheme === "dark"
          ? "linear-gradient(135deg, rgba(var(--ls-panel-bg-rgb), 0.78), rgba(var(--ls-panel-bg-rgb), 0.9))"
          : "linear-gradient(135deg, rgba(255, 255, 255, 0.86), rgba(239, 250, 248, 0.94))",
      backdropFilter: "blur(24px)",
      border: `1px solid rgba(${rgb}, ${theme.colorScheme === "dark" ? 0.2 : 0.26})`,

      [theme.fn.smallerThan("sm")]: {
        padding: 18,
        borderRadius: 26,
      },

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

    topBar: {
      position: "relative",
      zIndex: 1,
      marginBottom: 22,
    },

    logoBadge: {
      width: 42,
      height: 42,
      borderRadius: 15,
      display: "grid",
      placeItems: "center",
      color: accent,
      background: `rgba(${rgb}, 0.14)`,
      border: `1px solid rgba(${rgb}, 0.28)`,
      boxShadow: `0 0 24px rgba(${rgb}, 0.18)`,
    },

    mediaGrid: {
      position: "relative",
      zIndex: 1,
      display: "grid",
      gridTemplateColumns: "190px 1fr",
      gap: 24,
      alignItems: "center",

      [theme.fn.smallerThan("sm")]: {
        gridTemplateColumns: "1fr",
        gap: 16,
      },
    },

    artwork: {
      width: 190,
      height: 190,
      aspectRatio: "1 / 1",
      alignSelf: "start",
      borderRadius: 24,
      display: "grid",
      placeItems: "center",
      color: accent,
      background:
        theme.colorScheme === "dark"
          ? `linear-gradient(135deg, rgba(${rgb}, 0.18), rgba(255,255,255,0.05))`
          : `linear-gradient(135deg, rgba(${rgb}, 0.16), rgba(255,255,255,0.78))`,
      border: `1px solid rgba(${rgb}, 0.22)`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 36px rgba(${rgb}, 0.12)`,

      [theme.fn.smallerThan("sm")]: {
        width: "100%",
        maxWidth: 180,
        height: 180,
      },
    },

    details: {
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: 24,
    },

    title: {
      color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
      letterSpacing: "-0.03em",
      lineHeight: 1.08,
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
      width: "43%",
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

    copyPanel: {
      marginTop: 18,
      borderRadius: 22,
      padding: 16,
      background:
        theme.colorScheme === "dark"
          ? "rgba(255,255,255,0.055)"
          : "rgba(255,255,255,0.68)",
      border: `1px solid rgba(${rgb}, 0.18)`,
    },

    code: {
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      color: theme.colorScheme === "dark" ? theme.colors.gray[3] : theme.colors.dark[6],
      wordBreak: "break-all",
    },
  };
});

const copy = {
  audio: {
    title: "Blue Moon Demo",
    subtitle: "Lil Nas X · MP3 audio preview",
    meta: "3:14 · 320 kbps · 7.4 MB",
    icon: TbMusic,
  },
  video: {
    title: "Launch Cut v2",
    subtitle: "MP4 video preview",
    meta: "1080p · 2:18 · 84.2 MB",
    icon: TbVideo,
  },
  pdf: {
    title: "Project Notes",
    subtitle: "PDF document preview",
    meta: "12 pages · 3.8 MB",
    icon: TbFileTypePdf,
  },
  file: {
    title: "Archive Package",
    subtitle: "Download-only file card",
    meta: "ZIP archive · 486.1 MB",
    icon: TbFile,
  },
};

export default function EmbedPreview() {
  const [kind, setKind] = useState<PreviewKind>("audio");
  const accent = ACCENTS[kind];
  const { classes } = useStyles({ accent });
  const item = copy[kind];
  const Icon = item.icon;

  const embedCode = useMemo(
    () =>
      `<iframe src="https://your-domain.com/embed/file/demo-${kind}" width="720" height="300" loading="lazy" allow="fullscreen"></iframe>`,
    [kind],
  );

  return (
    <>
      <Head>
        <title>Embed Preview</title>
      </Head>

      <Box className={classes.shell}>
        <Stack className={classes.stage} spacing="md">
          <Group position="apart" align="center">
            <Box>
              <Badge
                variant="outline"
                sx={{
                  color: accent,
                  borderColor: `rgba(${hexToRgb(accent)}, 0.42)`,
                  background: `rgba(${hexToRgb(accent)}, 0.08)`,
                  letterSpacing: "0.12em",
                }}
              >
                Local mock
              </Badge>
              <Title order={2} mt={8}>
                Embed preview
              </Title>
              <Text color="dimmed" size="sm">
                A standalone iframe-style card for other websites.
              </Text>
            </Box>

            <SegmentedControl
              value={kind}
              onChange={(value) => setKind(value as PreviewKind)}
              data={[
                { label: "Audio", value: "audio" },
                { label: "Video", value: "video" },
                { label: "PDF", value: "pdf" },
                { label: "File", value: "file" },
              ]}
            />
          </Group>

          <Box className={classes.previewFrame}>
            <Paper className={classes.card}>
              <Group position="apart" className={classes.topBar}>
                <Group spacing="sm">
                  <Box className={classes.logoBadge}>
                    <TbBrandLastfm size={24} />
                  </Box>
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
                    background: `rgba(${hexToRgb(accent)}, 0.12)`,
                    border: `1px solid rgba(${hexToRgb(accent)}, 0.22)`,
                  }}
                >
                  {kind}
                </Badge>
              </Group>

              <Box className={classes.mediaGrid}>
                <Box className={classes.artwork}>
                  <Icon size={76} strokeWidth={1.5} />
                </Box>

                <Box className={classes.details}>
                  <Box>
                    <Title order={1} className={classes.title}>
                      {item.title}
                    </Title>
                    <Text color="dimmed" mt={8}>
                      {item.subtitle}
                    </Text>
                    <Text size="sm" color="dimmed" mt={4}>
                      {item.meta}
                    </Text>
                  </Box>

                  {kind === "audio" || kind === "video" ? (
                    <Stack spacing="xs">
                      <Group spacing="md" align="center" noWrap>
                        <ActionIcon size={52} radius="xl" className={classes.primaryButton}>
                          {kind === "audio" ? <TbPlayerPlay size={28} /> : <TbPlayerPause size={28} />}
                        </ActionIcon>
                        <Box sx={{ flex: 1 }}>
                          <Box className={classes.progressTrack}>
                            <Box className={classes.progressFill} />
                          </Box>
                          <Group position="apart" mt={6}>
                            <Text size="xs" color="dimmed">
                              1:21
                            </Text>
                            <Text size="xs" color="dimmed">
                              {kind === "audio" ? "3:14" : "2:18"}
                            </Text>
                          </Group>
                        </Box>
                      </Group>

                      <Group spacing="sm">
                        <TbVolume size={18} color={accent} />
                        <Box className={classes.progressTrack} sx={{ width: 132, height: 8 }}>
                          <Box className={classes.progressFill} sx={{ width: "72%" }} />
                        </Box>
                        <Text size="xs" color="dimmed">
                          72%
                        </Text>
                      </Group>
                    </Stack>
                  ) : (
                    <Paper
                      radius="lg"
                      p="md"
                      sx={{
                        border: `1px solid rgba(${hexToRgb(accent)}, 0.2)`,
                        background: `rgba(${hexToRgb(accent)}, 0.08)`,
                      }}
                    >
                      <Text weight={700}>
                        {kind === "pdf" ? "Document preview area" : "Secure download card"}
                      </Text>
                      <Text size="sm" color="dimmed" mt={4}>
                        {kind === "pdf"
                          ? "PDF pages would render here in the real embed."
                          : "Unsupported preview types can still show useful file details."}
                      </Text>
                    </Paper>
                  )}

                  <Group spacing="sm">
                    <Button leftIcon={<TbDownload size={18} />} className={classes.primaryButton}>
                      Download
                    </Button>
                    <Button leftIcon={<TbExternalLink size={18} />} className={classes.glassButton} variant="default">
                      Open share
                    </Button>
                  </Group>
                </Box>
              </Box>
            </Paper>
          </Box>

          <Paper className={classes.copyPanel}>
            <Text size="xs" weight={800} transform="uppercase" color="dimmed" mb={6}>
              Example embed code
            </Text>
            <Text className={classes.code}>{embedCode}</Text>
          </Paper>
        </Stack>
      </Box>
    </>
  );
}
