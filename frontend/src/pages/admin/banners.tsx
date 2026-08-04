import {
  Box,
  Button,
  Checkbox,
  Container,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
  createStyles,
} from "@mantine/core";
import { useEffect, useState } from "react";
import {
  TbCheck,
  TbChevronDown,
  TbChevronUp,
  TbInfoCircle,
  TbLink,
  TbPlus,
  TbSpeakerphone,
  TbTrash,
  TbX,
} from "react-icons/tb";
import Banner from "../../components/Banner";
import Meta from "../../components/Meta";
import configService from "../../services/config.service";
import {
  BANNER_VARIANTS,
  Banner as BannerType,
  BannerVariant,
  PAGE_TARGETS,
} from "../../types/banner.type";
import { emptyBanner, parseBanners } from "../../utils/banner.util";

const PANEL = (dark: boolean) => ({
  background: dark
    ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.88) 0%, rgba(var(--ls-panel-bg-rgb), 0.8) 100%)"
    : "rgba(255, 255, 255, 0.8)",
  backdropFilter: "blur(12px)",
  borderRadius: 16,
  boxShadow: dark
    ? "0 18px 46px rgba(0, 0, 0, 0.24), 0 0 34px rgba(var(--ls-accent-rgb), 0.06)"
    : "0 4px 24px rgba(0, 0, 0, 0.06)",
});

const useStyles = createStyles((theme) => {
  const dark = theme.colorScheme === "dark";

  return {
    wrapper: { minHeight: "calc(100vh - 180px)" },

    headerCard: {
      ...PANEL(dark),
      border: `1px solid rgba(var(--ls-panel-border-rgb), ${dark ? 0.2 : 0.3})`,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
    },

    titleSection: { display: "flex", alignItems: "center", gap: 12 },

    titleIcon: {
      color: "var(--ls-accent)",
      filter: "drop-shadow(0 0 8px rgba(var(--ls-accent-rgb), 0.4))",
    },

    title: {
      color: dark ? theme.white : theme.colors.dark[7],
      fontWeight: 700,
      fontSize: 28,
    },

    subtitle: {
      color: dark ? theme.colors.gray[4] : theme.colors.gray[6],
      marginTop: 6,
      maxWidth: 640,
      lineHeight: 1.55,
    },

    noteCard: {
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      background: dark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
      border: `1px solid ${dark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}`,
      borderRadius: 12,
      padding: "14px 16px",
      marginBottom: theme.spacing.xl,
    },

    noteIcon: {
      color: dark ? theme.colors.gray[5] : theme.colors.gray[6],
      flexShrink: 0,
      marginTop: 2,
    },

    noteText: {
      fontSize: 13,
      lineHeight: 1.5,
      color: dark ? theme.colors.gray[4] : theme.colors.gray[7],
    },

    statusBar: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      padding: "12px 16px",
      marginBottom: theme.spacing.xl,
      fontSize: 14,
      fontWeight: 500,
    },

    statusOk: {
      background: "rgba(var(--ls-accent-rgb), 0.1)",
      border: "1px solid rgba(var(--ls-accent-rgb), 0.25)",
      color: "var(--ls-accent)",
    },

    statusError: {
      background: "rgba(239, 68, 68, 0.1)",
      border: "1px solid rgba(239, 68, 68, 0.3)",
      color: "#ef4444",
    },

    bannerCard: {
      ...PANEL(dark),
      border: `1px solid rgba(var(--ls-panel-border-rgb), ${dark ? 0.15 : 0.2})`,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.lg,
    },

    cardHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      borderBottom: `1px solid ${dark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)"}`,
    },

    cardTitle: {
      fontWeight: 700,
      fontSize: 16,
      color: dark ? theme.white : theme.colors.dark[7],
    },

    sectionLabel: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: dark ? theme.colors.gray[5] : theme.colors.gray[6],
      marginBottom: 8,
    },

    previewShell: {
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTop: `1px solid ${dark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)"}`,
    },

    linkRow: { display: "flex", gap: 10, alignItems: "flex-end" },

    iconButton: {
      background: "none",
      border: `1px solid ${dark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)"}`,
      borderRadius: 10,
      cursor: "pointer",
      padding: 8,
      lineHeight: 0,
      color: dark ? theme.colors.gray[4] : theme.colors.gray[7],
      transition: "background 120ms ease, color 120ms ease",
      "&:hover": {
        background: dark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
        color: dark ? theme.white : theme.colors.dark[7],
      },
      "&:disabled": { opacity: 0.35, cursor: "not-allowed" },
    },

    dangerButton: {
      color: "#ef4444",
      borderColor: "rgba(239, 68, 68, 0.35)",
      "&:hover": { background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" },
    },

    accentButton: {
      background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
      border: "none",
      borderRadius: 10,
      fontWeight: 600,
      boxShadow: "0 4px 15px rgba(var(--ls-accent-rgb), 0.3)",
      transition: "all 0.25s ease",
      "&:hover": {
        background:
          "linear-gradient(135deg, var(--ls-accent-hover) 0%, var(--ls-accent-hover-deep) 100%)",
        boxShadow: "0 6px 20px rgba(var(--ls-accent-rgb), 0.4)",
        transform: "translateY(-1px)",
      },
    },

    ghostButton: {
      background: "none",
      border: `1px solid rgba(var(--ls-accent-rgb), 0.35)`,
      color: "var(--ls-accent)",
      borderRadius: 10,
      fontWeight: 600,
      "&:hover": { background: "rgba(var(--ls-accent-rgb), 0.08)" },
    },

    empty: {
      textAlign: "center",
      padding: "48px 24px",
      color: dark ? theme.colors.gray[5] : theme.colors.gray[6],
    },
  };
});

const CONFIG_KEY = "banners.items";

const AdminBanners = () => {
  const { classes, cx } = useStyles();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banners, setBanners] = useState<BannerType[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const configs = await configService.getByCategory("banners");
        const row = configs.find((c) => c.name === "items");
        setBanners(parseBanners(row?.value ?? row?.defaultValue ?? "[]"));
      } catch {
        setMessage({ ok: false, text: "Could not load banners." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (id: string, patch: Partial<BannerType>) =>
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const move = (index: number, delta: number) =>
    setBanners((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const add = () =>
    setBanners((prev) => [
      ...prev,
      // Date.now alone can collide when two are added in the same millisecond.
      emptyBanner(`banner-${Date.now()}-${prev.length}`),
    ]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await configService.updateMany([
        { key: CONFIG_KEY, value: JSON.stringify(banners) },
      ]);
      setMessage({ ok: true, text: "Banners saved." });
    } catch (e: any) {
      setMessage({
        ok: false,
        text: e?.response?.data?.message || "Could not save banners.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container size="md" py={80}>
        <Group position="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  const renderBanner = (banner: BannerType, index: number) => (
    <Box className={classes.bannerCard} key={banner.id}>
      <div className={classes.cardHeader}>
        <Text className={classes.cardTitle}>
          {banner.title || banner.message.slice(0, 48) || "Untitled banner"}
        </Text>
        <Group spacing={8}>
          <Switch
            checked={banner.enabled}
            onChange={(e) => update(banner.id, { enabled: e.currentTarget.checked })}
            aria-label="Enabled"
          />
          <button
            type="button"
            className={classes.iconButton}
            onClick={() => move(index, -1)}
            disabled={index === 0}
            aria-label="Move up"
          >
            <TbChevronUp size={16} />
          </button>
          <button
            type="button"
            className={classes.iconButton}
            onClick={() => move(index, 1)}
            disabled={index === banners.length - 1}
            aria-label="Move down"
          >
            <TbChevronDown size={16} />
          </button>
          <button
            type="button"
            className={cx(classes.iconButton, classes.dangerButton)}
            onClick={() => setBanners((prev) => prev.filter((b) => b.id !== banner.id))}
            aria-label="Delete banner"
          >
            <TbTrash size={16} />
          </button>
        </Group>
      </div>

      <Stack spacing="md">
        <TextInput
          label="Title"
          description="Optional bold heading. Leave empty for a message-only banner."
          value={banner.title}
          onChange={(e) => update(banner.id, { title: e.currentTarget.value })}
        />

        <Textarea
          label="Message"
          autosize
          minRows={2}
          value={banner.message}
          onChange={(e) => update(banner.id, { message: e.currentTarget.value })}
        />

        <Group grow align="flex-start">
          <Select
            label="Color"
            value={banner.variant}
            data={BANNER_VARIANTS.map((v) => ({
              value: v,
              label: v[0].toUpperCase() + v.slice(1),
            }))}
            onChange={(v) => v && update(banner.id, { variant: v as BannerVariant })}
          />
          <TextInput
            label="Show from"
            description="Optional. YYYY-MM-DD"
            placeholder="2026-08-01"
            value={banner.startsAt}
            onChange={(e) => update(banner.id, { startsAt: e.currentTarget.value })}
          />
          <TextInput
            label="Show until"
            description="Optional. YYYY-MM-DD"
            placeholder="2026-08-31"
            value={banner.endsAt}
            onChange={(e) => update(banner.id, { endsAt: e.currentTarget.value })}
          />
        </Group>

        <div>
          <Text className={classes.sectionLabel}>Pages</Text>
          <Group spacing="md">
            {PAGE_TARGETS.map((target) => (
              <Checkbox
                key={target.value}
                label={target.label}
                checked={banner.pages.includes(target.value)}
                onChange={(e) => {
                  const on = e.currentTarget.checked;
                  const pages = on
                    ? [...banner.pages, target.value]
                    : banner.pages.filter((p) => p !== target.value);
                  update(banner.id, { pages });
                }}
              />
            ))}
          </Group>
          <TextInput
            mt="sm"
            label="Extra paths"
            description='Comma separated. Exact ("/pricing") or subtree ("/docs/*").'
            value={banner.pages
              .filter((p) => !PAGE_TARGETS.some((t) => t.value === p))
              .join(", ")}
            onChange={(e) => {
              const custom = e.currentTarget.value
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);
              const presets = banner.pages.filter((p) =>
                PAGE_TARGETS.some((t) => t.value === p),
              );
              update(banner.id, { pages: [...presets, ...custom] });
            }}
          />
        </div>

        <div>
          <Text className={classes.sectionLabel}>Links</Text>
          <Stack spacing="sm">
            {banner.links.map((link, i) => (
              <div className={classes.linkRow} key={i}>
                <TextInput
                  style={{ flex: 1 }}
                  label={i === 0 ? "Text" : undefined}
                  placeholder="Learn more"
                  value={link.label}
                  onChange={(e) => {
                    const links = [...banner.links];
                    links[i] = { ...links[i], label: e.currentTarget.value };
                    update(banner.id, { links });
                  }}
                />
                <TextInput
                  style={{ flex: 2 }}
                  label={i === 0 ? "URL" : undefined}
                  placeholder="/export or https://example.com"
                  value={link.href}
                  onChange={(e) => {
                    const links = [...banner.links];
                    links[i] = { ...links[i], href: e.currentTarget.value };
                    update(banner.id, { links });
                  }}
                />
                <button
                  type="button"
                  className={cx(classes.iconButton, classes.dangerButton)}
                  onClick={() =>
                    update(banner.id, {
                      links: banner.links.filter((_, j) => j !== i),
                    })
                  }
                  aria-label="Remove link"
                >
                  <TbX size={16} />
                </button>
              </div>
            ))}
            <Group>
              <Button
                size="xs"
                className={classes.ghostButton}
                leftIcon={<TbLink size={14} />}
                onClick={() =>
                  update(banner.id, {
                    links: [...banner.links, { label: "", href: "" }],
                  })
                }
              >
                Add link
              </Button>
            </Group>
          </Stack>
        </div>

        <Switch
          label="Visitors can dismiss this banner"
          checked={banner.dismissible}
          onChange={(e) => update(banner.id, { dismissible: e.currentTarget.checked })}
        />

        <div className={classes.previewShell}>
          <Text className={classes.sectionLabel}>Preview</Text>
          <Banner banner={banner} />
        </div>
      </Stack>
    </Box>
  );

  return (
    <>
      <Meta title="Banners" />
      <Container size="md" py="xl" className={classes.wrapper}>
        <Box className={classes.headerCard}>
          <div className={classes.titleSection}>
            <TbSpeakerphone size={32} className={classes.titleIcon} />
            <Title className={classes.title}>Banners</Title>
          </div>
          <Text className={classes.subtitle}>
            Site-wide notices shown above the page content. Use them for
            maintenance windows, outages, or anything visitors need to see.
            Banners appear in the order listed here.
          </Text>
        </Box>

        <Box className={classes.noteCard}>
          <TbInfoCircle size={18} className={classes.noteIcon} />
          <Text className={classes.noteText}>
            A banner needs a title or a message to show. Dismissals are remembered
            in the visitor&apos;s browser per banner, so editing an existing
            banner will not bring it back for someone who has closed it. Add a
            new one instead.
          </Text>
        </Box>

        {message && (
          <Box
            className={cx(classes.statusBar, {
              [classes.statusOk]: message.ok,
              [classes.statusError]: !message.ok,
            })}
          >
            {message.ok ? <TbCheck size={16} /> : <TbX size={16} />}
            {message.text}
          </Box>
        )}

        {banners.length === 0 ? (
          <Box className={cx(classes.bannerCard, classes.empty)}>
            <Text>No banners yet.</Text>
          </Box>
        ) : (
          banners.map(renderBanner)
        )}

        <Group position="apart" mt="xl">
          <Button
            className={classes.ghostButton}
            leftIcon={<TbPlus size={16} />}
            onClick={add}
          >
            Add banner
          </Button>
          <Button className={classes.accentButton} onClick={save} loading={saving}>
            Save changes
          </Button>
        </Group>
      </Container>
    </>
  );
};

export default AdminBanners;
