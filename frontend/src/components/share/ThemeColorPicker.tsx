import {
  ActionIcon,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
  createStyles,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { TbPlus, TbX } from "react-icons/tb";
import useUser from "../../hooks/user.hook";
import userService from "../../services/user.service";
import { rgbString as hexToRgb } from "../../theme/theme.util";
import useSiteTheme from "../../theme/useSiteTheme";
import toast from "../../utils/toast.util";

const MAX_CUSTOM_THEME_COLORS = 7;

function normalizeHex(hex: string): string {
  const normalized = hex.trim().toLowerCase();
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(normalizeHex(hex));
}

const useStyles = createStyles((theme) => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontWeight: 500,
    marginBottom: theme.spacing.xs,
    fontSize: 14,
  },
  swatchRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "2px solid transparent",
    position: "relative",
    overflow: "hidden",
    flexShrink: 0,

    "&:hover": {
      transform: "scale(1.08)",
    },

    "&::after": {
      content: "\"\"",
      position: "absolute",
      inset: 0,
      background: "inherit",
      borderRadius: 8,
    },
  },
  swatchSelected: {
    transform: "scale(1.08)",
    boxShadow: `0 0 0 2px ${
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white
    }, 0 4px 12px rgba(0, 0, 0, 0.3)`,

    "&::before": {
      content: "\"✓\"",
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontWeight: "bold",
      fontSize: 16,
      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
      zIndex: 1,
    },
  },
  customRemove: {
    position: "absolute",
    top: 1,
    right: 1,
    zIndex: 3,
    width: 12,
    minWidth: 12,
    maxWidth: 12,
    height: 12,
    minHeight: 12,
    maxHeight: 12,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    borderRadius: 0,
    background: "transparent",
    color: theme.white,
    opacity: 1,
    boxShadow: "none",
    transition: "transform 0.2s ease, opacity 0.2s ease",
    filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.55))",
    "&:hover": {
      transform: "scale(1.06)",
      opacity: 0.85,
    },
  },
  customSwatch: {},
  addSwatch: {
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: `1px dashed ${
      theme.colorScheme === "dark"
        ? "rgba(255,255,255,0.22)"
        : "rgba(0,0,0,0.18)"
    }`,
    color:
      theme.colorScheme === "dark" ? theme.colors.gray[3] : theme.colors.gray[7],
    background:
      theme.colorScheme === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(0,0,0,0.02)",
    transition: "all 0.2s ease",
    "&:hover": {
      transform: "scale(1.08)",
      borderColor:
        theme.colorScheme === "dark"
          ? "rgba(255,255,255,0.38)"
          : "rgba(0,0,0,0.28)",
      background:
        theme.colorScheme === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.04)",
    },
  },
  description: {
    fontSize: 12,
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[5]
        : theme.colors.gray[6],
    marginTop: theme.spacing.xs,
  },
  modalPreview: {
    width: 44,
    height: 44,
    borderRadius: 12,
    flexShrink: 0,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255,255,255,0.12)"
        : "rgba(0,0,0,0.08)"
    }`,
  },
}));

interface ThemeColorPickerProps {
  value: string | null;
  onChange: (_color: string | null) => void;
}

type ThemePreset = {
  color: string;
  name: string;
  id?: string;
  isCustom?: boolean;
};

const ThemeColorPicker = ({ value, onChange }: ThemeColorPickerProps) => {
  const { classes, cx } = useStyles();
  const { user, refreshUser } = useUser();
  const { presets: builtInPresets } = useSiteTheme();
  const defaultColor = builtInPresets[0]?.color ?? "#00ff5a";
  const selectedColor = (value || defaultColor).toLowerCase();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customHex, setCustomHex] = useState("#7dd3fc");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const [customColors, setCustomColors] = useState(
    (user?.shareThemeColors || []).map((item) => ({
      ...item,
      color: item.color.toLowerCase(),
    })),
  );

  useEffect(() => {
    if (!user?.shareThemeColors?.length) return;
    setCustomColors(
      user.shareThemeColors.map((item) => ({
        ...item,
        color: item.color.toLowerCase(),
      })),
    );
  }, [user?.shareThemeColors]);

  useEffect(() => {
    let isMounted = true;

    userService
      .listOwnShareThemeColors()
      .then((colors) => {
        if (!isMounted) return;
        setCustomColors(
          colors.map((item) => ({
            ...item,
            color: item.color.toLowerCase(),
          })),
        );
      })
      .catch(() => {
      });

    return () => {
      isMounted = false;
    };
  }, [isCreateOpen, user?.id]);

  const builtInFirstRow = builtInPresets.slice(0, 8);
  const builtInSecondRow = builtInPresets.slice(8);

  const remainingCustomSlots = MAX_CUSTOM_THEME_COLORS - customColors.length;

  const allThemeColors: ThemePreset[] = useMemo(
    () => [
      ...builtInPresets,
      ...customColors.map((color) => ({
        id: color.id,
        color: color.color,
        name: color.name,
        isCustom: true,
      })),
    ],
    [builtInPresets, customColors],
  );

  const handleCreateCustomColor = async () => {
    const normalizedHex = normalizeHex(customHex);
    const trimmedName = customName.trim();

    if (!trimmedName) {
      toast.error("Please give your custom share color a name.");
      return;
    }

    if (!isValidHex(normalizedHex)) {
      toast.error("Please enter a valid 6-digit hex color.");
      return;
    }

    if (
      allThemeColors.some((item) => item.color.toLowerCase() === normalizedHex)
    ) {
      toast.error("That share color already exists in your palette.");
      return;
    }

    setIsSaving(true);
    try {
      const created = await userService.createOwnShareThemeColor({
        name: trimmedName,
        color: normalizedHex,
      });
      setCustomColors((current) => [
        ...current,
        {
          id: created.id,
          name: created.name,
          color: created.color.toLowerCase(),
          createdAt: created.createdAt,
        },
      ]);
      await refreshUser();
      onChange(created.color);
      setCustomName("");
      setCustomHex("#7dd3fc");
      setIsCreateOpen(false);
      toast.success("Custom share color saved.");
    } catch (error: any) {
      toast.axiosError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomColor = async (color: {
    id: string;
    color: string;
  }) => {
    setDeletingId(color.id);
    try {
      await userService.deleteOwnShareThemeColor(color.id);
      setCustomColors((current) => current.filter((item) => item.id !== color.id));
      await refreshUser();
      if (selectedColor === color.color.toLowerCase()) {
        onChange(defaultColor);
      }
      toast.success("Custom share color removed.");
    } catch (error: any) {
      toast.axiosError(error);
    } finally {
      setDeletingId(null);
    }
  };

  const renderSwatch = (preset: ThemePreset) => (
    <Tooltip key={preset.id || preset.color} label={preset.name} position="top" withArrow>
      <UnstyledButton
        className={cx(classes.swatch, {
          [classes.swatchSelected]: selectedColor === preset.color.toLowerCase(),
          [classes.customSwatch]: preset.isCustom,
        })}
        style={{
          background: preset.color,
          boxShadow:
            selectedColor === preset.color.toLowerCase()
              ? `0 4px 16px rgba(${hexToRgb(preset.color)}, 0.5)`
              : `0 2px 8px rgba(${hexToRgb(preset.color)}, 0.3)`,
        }}
        onClick={() => onChange(preset.color)}
      >
        {preset.isCustom && preset.id ? (
          <ActionIcon
            className={classes.customRemove}
            radius="xl"
            variant="filled"
            loading={deletingId === preset.id}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!preset.id) return;
              handleDeleteCustomColor({ id: preset.id, color: preset.color });
            }}
          >
            <TbX size={8} />
          </ActionIcon>
        ) : null}
      </UnstyledButton>
    </Tooltip>
  );

  return (
    <Box className={classes.container}>
      <Text className={classes.label}>Share Theme Color</Text>
      <div className={classes.swatchRow}>
        {builtInFirstRow.map(renderSwatch)}
      </div>
      <div className={classes.swatchRow}>
        {builtInSecondRow.map(renderSwatch)}
        {customColors.map((customColor) =>
          renderSwatch({
            id: customColor.id,
            color: customColor.color,
            name: customColor.name,
            isCustom: true,
          }),
        )}
        {remainingCustomSlots > 0 ? (
          <Tooltip
            label={`Add custom share color (${remainingCustomSlots} slot${
              remainingCustomSlots === 1 ? "" : "s"
            } left)`}
            position="top"
            withArrow
          >
            <UnstyledButton
              className={classes.addSwatch}
              onClick={() => setIsCreateOpen(true)}
            >
              <TbPlus size={18} />
            </UnstyledButton>
          </Tooltip>
        ) : null}
      </div>
      <Text className={classes.description}>
        Choose a color theme for your share page. Save up to{" "}
        {MAX_CUSTOM_THEME_COLORS} custom colors to fill the second row.
      </Text>

      <Modal
        opened={isCreateOpen}
        onClose={() => {
          if (isSaving) return;
          setIsCreateOpen(false);
        }}
        title="Save custom share color"
        centered
      >
        <Stack spacing="md">
          <Group align="flex-end" noWrap>
            <TextInput
              label="Color name"
              placeholder="Midnight Blue"
              value={customName}
              onChange={(event) => setCustomName(event.currentTarget.value)}
              sx={{ flex: 1 }}
              maxLength={24}
            />
            <Box sx={{ position: "relative" }}>
              <Box
                className={classes.modalPreview}
                style={{
                  background: isValidHex(customHex)
                    ? normalizeHex(customHex)
                    : "#7dd3fc",
                }}
                onClick={() => colorInputRef.current?.click()}
                sx={{ cursor: "pointer" }}
              />
              <Box
                component="input"
                type="color"
                aria-label="Custom share color picker"
                ref={colorInputRef}
                value={
                  isValidHex(customHex) ? normalizeHex(customHex) : "#7dd3fc"
                }
                onChange={(event: { currentTarget: HTMLInputElement }) =>
                  setCustomHex(event.currentTarget.value)
                }
                sx={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  zIndex: 1,
                  width: "100%",
                  height: "100%",
                  cursor: "pointer",
                }}
              />
            </Box>
          </Group>
          <Group align="flex-end" noWrap>
            <TextInput
              label="Hex color"
              placeholder="#7dd3fc"
              value={customHex}
              onChange={(event) => setCustomHex(event.currentTarget.value)}
              sx={{ flex: 1 }}
              maxLength={7}
            />
          </Group>
          <Button onClick={handleCreateCustomColor} loading={isSaving}>
            Save custom color
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
};

export default ThemeColorPicker;
export { MAX_CUSTOM_THEME_COLORS };
