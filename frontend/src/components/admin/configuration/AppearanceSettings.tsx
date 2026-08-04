
import {
  Box,
  Button,
  ColorInput,
  Group,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
  createStyles,
  SegmentedControl,
} from "@mantine/core";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import { TbArrowBackUp, TbMoon, TbPalette, TbSun } from "react-icons/tb";
import {
  DEFAULT_SHARE_PRESETS,
  MODE_COLOR_KEYS,
  ModeColors,
  SHARED_COLOR_KEYS,
  SharePreset,
  SharedColors,
  THEME_PRESETS,
  ThemeMode,
  ThemePreset,
} from "../../../theme/theme.constants";
import {
  isHexColor,
  resolveTheme,
  splitWordmark,
  themeVariablesFor,
} from "../../../theme/theme.util";
import { AdminConfig, UpdateConfig } from "../../../types/config.type";
import {
  HEADER_VARIANTS,
  toHeaderVariant,
} from "../../header/headerVariants";

const MODE_LABELS: Record<keyof ModeColors, { label: string; help: string }> = {
  accent: {
    label: "Accent",
    help: "The main brand color. Links, focus rings, progress bars and glows all follow it, as do the Mantine component colors.",
  },
  background: {
    label: "Page background",
    help: "The base of the page gradient. The gradient's shape stays fixed; only its color changes.",
  },
  headerBackground: {
    label: "Header background",
    help: "The frosted bar at the top of every page, and the menus that drop out of it.",
  },
  headerBorder: {
    label: "Header outline",
    help: "The header's border and halo. Separate from the accent so a bright brand color doesn't have to mean a bright glow.",
  },
  logoText: {
    label: "Site name",
    help: "The first part of the site name in the header.",
  },
  logoAccent: {
    label: "Site name accent",
    help: "The second part of the site name, after its last capital letter. See Wordmark below for how the current name splits.",
  },
  uploadButton: {
    label: "Upload button",
    help: "The primary Upload button. Its label color is chosen automatically for contrast.",
  },
  bulkUploadButton: {
    label: "Bulk upload button",
    help: "The secondary Bulk upload button, deliberately a different color so the two actions read apart.",
  },
  homeButton: {
    label: "Home / active nav",
    help: "The highlighted state of the current page in the header navigation.",
  },
  panelBackground: {
    label: "Panel background",
    help: "The frosted cards used across the admin pages and account area.",
  },
  panelBorder: {
    label: "Panel outline",
    help: "The border on those cards.",
  },
};

const SHARED_LABELS: Record<keyof SharedColors, { label: string; help: string }> = {
  modalRingOuter: {
    label: "Modal ring - outer",
    help: "The animated ring around the share and upload modals runs outer to centre and back. Shared by both color schemes.",
  },
  modalRingInner: {
    label: "Modal ring - middle",
    help: "The middle stop of that ring.",
  },
  modalRingCenter: {
    label: "Modal ring - centre",
    help: "The brightest stop, which sweeps around as the ring animates.",
  },
};

const useStyles = createStyles((theme) => ({
  section: {
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    borderTop: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(0, 0, 0, 0.06)"
    }`,
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },

  sectionIcon: {
    color: "var(--ls-accent)",
    filter: "drop-shadow(0 0 8px rgba(var(--ls-accent-rgb), 0.4))",
  },

  sectionDescription: {
    fontSize: 13,
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[7],
    marginBottom: theme.spacing.lg,
    maxWidth: 720,
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: theme.spacing.xl,
    alignItems: "start",

    [theme.fn.smallerThan("lg")]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },

  row: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 200px auto",
    gap: theme.spacing.md,
    alignItems: "center",
    padding: "12px 0",
    borderBottom: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.04)"
        : "rgba(0, 0, 0, 0.04)"
    }`,

    "&:last-of-type": { borderBottom: "none" },

    [theme.fn.smallerThan("sm")]: {
      gridTemplateColumns: "minmax(0, 1fr) auto",
    },
  },

  rowLabel: { fontSize: 14, fontWeight: 600 },

  rowHelp: {
    fontSize: 12,
    lineHeight: 1.45,
    color: theme.colorScheme === "dark" ? theme.colors.gray[6] : theme.colors.gray[6],
  },

  changed: {
    color: "var(--ls-accent)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },

  presetRow: {
    display: "grid",
    gridTemplateColumns: "170px minmax(0, 1fr)",
    gap: theme.spacing.sm,
    alignItems: "center",
    padding: "8px 0",

    [theme.fn.smallerThan("sm")]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },

  themePresets: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },

  themePresetButton: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 14px 8px 10px",
    borderRadius: 12,
    cursor: "pointer",
    background: theme.colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.03)"
      : "rgba(0, 0, 0, 0.02)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.1)"
    }`,
    transition: "all 0.15s ease",

    "&:hover": {
      borderColor: "var(--ls-accent)",
      transform: "translateY(-1px)",
    },
  },

  themePresetActive: {
    borderColor: "var(--ls-accent)",
    boxShadow: "0 0 0 1px var(--ls-accent), 0 0 14px rgba(var(--ls-accent-rgb), 0.35)",
  },

  themePresetDots: {
    display: "flex",
    alignItems: "center",
  },

  themePresetDot: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: `2px solid ${theme.colorScheme === "dark" ? "#0b0b0b" : "#ffffff"}`,
    marginLeft: -6,

    "&:first-of-type": { marginLeft: 0 },
  },

  themePresetName: { fontSize: 13, fontWeight: 600 },

  preview: {
    position: "sticky",
    top: 96,
    borderRadius: 16,
    overflow: "hidden",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.1)"
    }`,
  },

  previewSurface: {
    background: "var(--ls-page-bg)",
    color: "var(--ls-text)",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 300,
  },

  previewHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 12,
    background: "rgba(var(--ls-header-bg-rgb), 0.75)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(var(--ls-header-border-rgb), 0.3)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25), 0 0 20px rgba(var(--ls-header-border-rgb), 0.15)",
  },

  previewHeaderMinimal: {
    borderRadius: 0,
    border: "none",
    borderBottom: "1px solid rgba(var(--ls-header-border-rgb), 0.32)",
    boxShadow: "0 6px 22px -14px rgba(var(--ls-header-border-rgb), 0.9)",
    background: "rgba(var(--ls-header-bg-rgb), 0.3)",
    marginLeft: -12,
    marginRight: -12,
    paddingLeft: 12,
    paddingRight: 12,
  },

  previewWordmark: { fontSize: 15, fontWeight: 700, letterSpacing: "-0.5px" },

  previewHome: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: 500,
    padding: "4px 8px",
    borderRadius: 6,
    background: "rgba(var(--ls-home-btn-rgb), 0.1)",
    color: "var(--ls-home-btn)",
  },

  previewButtons: { display: "flex", gap: 8 },

  previewPrimary: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    padding: "7px 10px",
    borderRadius: 8,
    background: "var(--ls-upload-grad)",
    color: "var(--ls-on-upload)",
    boxShadow: "0 4px 15px rgba(var(--ls-upload-btn-rgb), 0.3)",
  },

  previewBulk: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    padding: "7px 10px",
    borderRadius: 8,
    background: "var(--ls-bulk-grad)",
    border: "1px solid rgba(var(--ls-bulk-btn-rgb), 0.28)",
    color: "var(--ls-on-bulk)",
  },

  previewPanel: {
    borderRadius: 12,
    padding: 12,
    background: "rgba(var(--ls-panel-bg-rgb), 0.6)",
    border: "1px solid rgba(var(--ls-panel-border-rgb), 0.15)",
    backdropFilter: "blur(12px)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  previewPanelTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--ls-accent)",
  },

  previewBar: {
    height: 6,
    borderRadius: 4,
    background: "rgba(var(--ls-accent-rgb), 0.25)",
    overflow: "hidden",
  },

  previewBarFill: {
    height: "100%",
    width: "62%",
    borderRadius: 4,
    background: "linear-gradient(90deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
  },

  previewRing: {
    borderRadius: 14,
    padding: 2,
    background:
      "linear-gradient(115deg, var(--ls-ring-outer) 0%, var(--ls-ring-inner) 22%, var(--ls-ring-center) 50%, var(--ls-ring-inner) 78%, var(--ls-ring-outer) 100%)",
  },

  previewRingInner: {
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 11,
    background: "rgba(var(--ls-panel-bg-rgb), 0.96)",
  },

  previewSwatches: { display: "flex", flexWrap: "wrap", gap: 5 },

  previewSwatch: { width: 18, height: 18, borderRadius: 5 },

  previewCaption: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    opacity: 0.65,
  },
}));

type Props = {
  configVariables: AdminConfig[];
  updateConfigVariable: (_configVariable: UpdateConfig) => void;
};

const HEADER_STYLE_KEY = "general.themeHeaderStyle";

const capitalise = (value: string) => value[0].toUpperCase() + value.slice(1);

const modeConfigKey = (mode: ThemeMode, field: keyof ModeColors) =>
  `general.theme${capitalise(mode)}${capitalise(field)}`;

const sharedConfigKey = (field: keyof SharedColors) =>
  `general.theme${capitalise(field)}`;

const AppearanceSettings = ({ configVariables, updateConfigVariable }: Props) => {
  const { classes, cx } = useStyles();
  const [mode, setMode] = useState<ThemeMode>("dark");

  const rows = useMemo(() => {
    const map: Record<string, AdminConfig> = {};
    for (const row of configVariables) map[row.key] = row;
    return map;
  }, [configVariables]);

  const [pending, setPending] = useState<Record<string, string>>({});

  const valueOf = (key: string) =>
    pending[key] ?? (rows[key]?.value as string) ?? rows[key]?.defaultValue ?? "";

  const defaultOf = (key: string) => rows[key]?.defaultValue ?? "";

  const setValue = (key: string, value: string) => {
    setPending((current) => ({ ...current, [key]: value }));

    const isNumeric = rows[key]?.type === "number";
    updateConfigVariable({
      key,
      value: isNumeric ? Number(value) : value,
    });
  };

  const resetToDefault = (key: string) => setValue(key, defaultOf(key));

  const headerStyle = toHeaderVariant(valueOf(HEADER_STYLE_KEY));

  const previewTheme = useMemo(
    () => resolveTheme((key) => valueOf(key) || undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, rows],
  );

  const previewVars = useMemo(
    () => themeVariablesFor(previewTheme, mode),
    [previewTheme, mode],
  );

  const [presetDraft, setPresetDraft] = useState<SharePreset[] | null>(null);

  const presets: SharePreset[] =
    presetDraft ??
    (previewTheme.presets.length ? previewTheme.presets : DEFAULT_SHARE_PRESETS);

  const setPresets = (next: SharePreset[]) => {
    setPresetDraft(next);
    setValue("general.themeSharePresets", JSON.stringify(next));
  };

  const updatePreset = (index: number, patch: Partial<SharePreset>) =>
    setPresets(presets.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const resetPresets = () => {
    setPresetDraft(null);
    resetToDefault("general.themeSharePresets");
  };

  const resetEverything = () => {
    for (const field of MODE_COLOR_KEYS) {
      for (const m of ["dark", "light"] as ThemeMode[]) {
        resetToDefault(modeConfigKey(m, field));
      }
    }
    for (const field of SHARED_COLOR_KEYS) resetToDefault(sharedConfigKey(field));
    resetPresets();
    // Re-lock onto whatever preset the shipped defaults represent.
    setSelectedPreset(detectPreset(defaultOf));
  };

  const CUSTOM = "custom";

  // The preset value for a given config key, or undefined if the key isn't one
  // of the theme color keys a preset covers.
  const presetValueForKey = (preset: ThemePreset, key: string) => {
    for (const m of ["dark", "light"] as ThemeMode[]) {
      for (const field of MODE_COLOR_KEYS) {
        if (modeConfigKey(m, field) === key) return preset[m][field];
      }
    }
    for (const field of SHARED_COLOR_KEYS) {
      if (sharedConfigKey(field) === key) return preset.shared[field];
    }
    return undefined;
  };

  // Does every theme color, read through `get`, equal this preset's?
  const paletteMatches = (
    preset: ThemePreset,
    get: (_key: string) => string,
  ) => {
    for (const field of MODE_COLOR_KEYS) {
      if (
        get(modeConfigKey("dark", field)).toLowerCase() !==
          preset.dark[field].toLowerCase() ||
        get(modeConfigKey("light", field)).toLowerCase() !==
          preset.light[field].toLowerCase()
      ) {
        return false;
      }
    }
    for (const field of SHARED_COLOR_KEYS) {
      if (
        get(sharedConfigKey(field)).toLowerCase() !==
        preset.shared[field].toLowerCase()
      ) {
        return false;
      }
    }
    return true;
  };

  const detectPreset = (get: (_key: string) => string) =>
    THEME_PRESETS.find((preset) => paletteMatches(preset, get))?.id ?? CUSTOM;

  // The palette the editor is working against. Once config loads we lock onto
  // whichever preset the saved colors match (or "custom" for a hand-tuned
  // palette), and keep that as the reference even after individual edits - so a
  // tweaked row can be shown as changed relative to the preset it came from.
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPreset !== null) return;
    if (!configVariables || configVariables.length === 0) return;
    setSelectedPreset(detectPreset(valueOf));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configVariables]);

  const effectivePreset = selectedPreset ?? detectPreset(valueOf);

  // Fill every color field from a preset in one go, and treat it as the new
  // reference. Share swatch presets are deliberately untouched. Staged like any
  // other edit, so nothing persists until the admin hits Save.
  const applyThemePreset = (preset: ThemePreset) => {
    for (const field of MODE_COLOR_KEYS) {
      setValue(modeConfigKey("dark", field), preset.dark[field]);
      setValue(modeConfigKey("light", field), preset.light[field]);
    }
    for (const field of SHARED_COLOR_KEYS) {
      setValue(sharedConfigKey(field), preset.shared[field]);
    }
    setSelectedPreset(preset.id);
  };

  // The reference a row compares against: the selected preset's color, or the
  // shipped default when the admin is on "Custom".
  const referenceFor = (key: string) => {
    if (effectivePreset !== CUSTOM) {
      const preset = THEME_PRESETS.find((p) => p.id === effectivePreset);
      const value = preset && presetValueForKey(preset, key);
      if (value) return value;
    }
    return defaultOf(key);
  };

  const colorRow = (key: string, label: string, help: string) => {
    const value = valueOf(key);
    const reference = referenceFor(key);
    const atReference = value.toLowerCase() === reference.toLowerCase();
    // On "Custom" there is no preset to diverge from, so nothing is ever
    // flagged. On a preset, a row reads as changed only once it differs from
    // that preset's color.
    const showChanged = effectivePreset !== CUSTOM && !atReference;

    return (
      <Box key={key} className={classes.row}>
        <Stack spacing={2}>
          <Text className={classes.rowLabel}>
            {label}
            {showChanged && <span className={classes.changed}> · changed</span>}
          </Text>
          <Text className={classes.rowHelp}>{help}</Text>
        </Stack>

        <ColorInput
          value={value}
          onChange={(next) => setValue(key, next)}
          format="hex"
          withEyeDropper
          size="sm"
          spellCheck={false}
          error={!isHexColor(value) && "Use a #rrggbb value"}
        />

        <Tooltip label={`Reset to ${reference}`} withArrow position="left">
          <Button
            variant="subtle"
            size="xs"
            px={8}
            disabled={atReference}
            onClick={() => setValue(key, reference)}
            aria-label={`Reset ${label}`}
          >
            <TbArrowBackUp size={16} />
          </Button>
        </Tooltip>
      </Box>
    );
  };

  const appName = (valueOf("general.appName") || "This site").trim();
  const wordmark = splitWordmark(appName);

  return (
    <Box className={classes.section}>
      <div className={classes.sectionHeader}>
        <TbPalette size={24} className={classes.sectionIcon} />
        <Title order={4}>Appearance</Title>
      </div>
      <Text className={classes.sectionDescription}>
        Colors for this instance. Light and dark are configured separately, and
        every field starts at the value the app ships with, so an untouched
        install looks exactly as it always has. Contrasting text colors are
        worked out automatically, so a pale accent will not leave unreadable
        button labels.
      </Text>

      <Title order={6} mb={4}>
        Theme presets
      </Title>
      <Text className={classes.rowHelp} mb="sm">
        A one-click starting point that fills every color below for both light
        and dark. Pick one, tweak any row you like, then Save. The per-share
        swatch palette further down is left untouched.
      </Text>
      <Box className={classes.themePresets}>
        {THEME_PRESETS.map((preset) => (
          <Box
            key={preset.id}
            role="button"
            tabIndex={0}
            className={cx(classes.themePresetButton, {
              [classes.themePresetActive]: effectivePreset === preset.id,
            })}
            onClick={() => applyThemePreset(preset)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                applyThemePreset(preset);
              }
            }}
          >
            <Box className={classes.themePresetDots}>
              {[
                preset.dark.accent,
                preset.dark.bulkUploadButton,
                preset.dark.headerBackground,
              ].map((color, index) => (
                <span
                  key={index}
                  className={classes.themePresetDot}
                  style={{ background: color }}
                />
              ))}
            </Box>
            <Text className={classes.themePresetName}>{preset.name}</Text>
          </Box>
        ))}
        <Box
          role="button"
          tabIndex={0}
          className={cx(classes.themePresetButton, {
            [classes.themePresetActive]: effectivePreset === CUSTOM,
          })}
          onClick={() => setSelectedPreset(CUSTOM)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelectedPreset(CUSTOM);
            }
          }}
        >
          <TbPalette size={16} style={{ opacity: 0.7 }} />
          <Text className={classes.themePresetName}>Custom</Text>
        </Box>
      </Box>

      <Box className={classes.layout}>
        <Box>
          <Tabs
            value={mode}
            onTabChange={(next) => next && setMode(next as ThemeMode)}
            variant="outline"
            radius="md"
          >
            <Tabs.List mb="md">
              <Tabs.Tab value="dark" icon={<TbMoon size={16} />}>
                Dark mode
              </Tabs.Tab>
              <Tabs.Tab value="light" icon={<TbSun size={16} />}>
                Light mode
              </Tabs.Tab>
            </Tabs.List>

            {(["dark", "light"] as ThemeMode[]).map((tabMode) => (
              <Tabs.Panel key={tabMode} value={tabMode}>
                {MODE_COLOR_KEYS.map((field) =>
                  colorRow(
                    modeConfigKey(tabMode, field),
                    MODE_LABELS[field].label,
                    MODE_LABELS[field].help,
                  ),
                )}
              </Tabs.Panel>
            ))}
          </Tabs>

          <Title order={6} mt="xl" mb={4}>
            Header style
          </Title>
          <Text className={classes.rowHelp}>
            Changes the shape of the header itself. Both options keep the same
            logo, name, navigation and buttons, so this only affects how the bar
            around them looks. The preview updates as you choose.
          </Text>
          <SegmentedControl
            mt={8}
            fullWidth
            value={headerStyle}
            onChange={(next) => setValue(HEADER_STYLE_KEY, next)}
            data={HEADER_VARIANTS.map((v) => ({
              value: v.id,
              label: v.name,
            }))}
          />
          <Text className={classes.rowHelp} mt={6}>
            {HEADER_VARIANTS.find((v) => v.id === headerStyle)?.description}
          </Text>

          <Title order={6} mt="xl" mb={4}>
            Shared by both modes
          </Title>
          {SHARED_COLOR_KEYS.map((field) =>
            colorRow(
              sharedConfigKey(field),
              SHARED_LABELS[field].label,
              SHARED_LABELS[field].help,
            ),
          )}

          <Title order={6} mt="xl" mb={4}>
            Wordmark
          </Title>
          <Text className={classes.rowHelp}>
            The header shows the site name from <strong>App name</strong> above,
            split at its last capital letter so the second part takes the accent
            color. {"\u201C"}{appName}{"\u201D"} renders as{" "}
            {wordmark.tail ? (
              <>
                <strong>{wordmark.head}</strong> +{" "}
                <strong>{wordmark.tail}</strong>
              </>
            ) : (
              <>
                <strong>{wordmark.head}</strong> in a single color - a name
                with no capital in the middle has no natural split
              </>
            )}
            .
          </Text>

          <Title order={6} mt="xl" mb={4}>
            Share color presets
          </Title>
          <Text className={classes.rowHelp} mb="sm">
            The palette offered when someone creates a share. The count is fixed
            so that a share which already uses one of these keeps its swatch.
            Members can still save their own colors on top of these.
          </Text>
          {presets.map((preset, index) => (
            <Box key={index} className={classes.presetRow}>
              <ColorInput
                value={preset.color}
                onChange={(next) => updatePreset(index, { color: next })}
                format="hex"
                size="xs"
                spellCheck={false}
                error={!isHexColor(preset.color)}
              />
              <TextInput
                value={preset.name}
                onChange={(event) =>
                  updatePreset(index, { name: event.currentTarget.value })
                }
                placeholder="Name shown on hover"
                size="xs"
                maxLength={32}
                error={!preset.name.trim()}
              />
            </Box>
          ))}
          <Group position="left" mt="md">
            <Button
              variant="subtle"
              size="xs"
              leftIcon={<TbArrowBackUp size={14} />}
              onClick={resetPresets}
            >
              Reset presets
            </Button>
          </Group>

          <Group position="left" mt="xl">
            <Button
              variant="outline"
              size="xs"
              leftIcon={<TbArrowBackUp size={14} />}
              onClick={resetEverything}
            >
              Reset all appearance settings
            </Button>
          </Group>
        </Box>

        <Box className={classes.preview} style={previewVars as CSSProperties}>
          <Box className={classes.previewSurface}>
            <Text className={classes.previewCaption}>
              {mode === "dark" ? "Dark mode" : "Light mode"} preview
            </Text>

            <Box
              className={cx(classes.previewHeader, {
                [classes.previewHeaderMinimal]: headerStyle === "minimal",
              })}
            >
              <Text className={classes.previewWordmark}>
                <span style={{ color: "var(--ls-logo-text)" }}>
                  {wordmark.head}
                </span>
                <span style={{ color: "var(--ls-logo-accent)" }}>
                  {wordmark.tail}
                </span>
              </Text>
              <span className={classes.previewHome}>Home</span>
            </Box>

            <Box className={classes.previewButtons}>
              <span className={classes.previewPrimary}>Upload</span>
              <span className={classes.previewBulk}>Bulk</span>
            </Box>

            <Box className={classes.previewPanel}>
              <Text className={classes.previewPanelTitle}>Panel heading</Text>
              <Box className={classes.previewBar}>
                <Box className={classes.previewBarFill} />
              </Box>
              <Box className={classes.previewSwatches}>
                {presets.map((preset, index) => (
                  <span
                    key={index}
                    className={classes.previewSwatch}
                    style={{ background: preset.color }}
                    title={preset.name}
                  />
                ))}
              </Box>
            </Box>

            <Box className={classes.previewRing}>
              <Box className={classes.previewRingInner}>Modal ring</Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AppearanceSettings;
