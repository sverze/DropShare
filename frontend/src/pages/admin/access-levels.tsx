import {
  Box,
  Button,
  Container,
  Group,
  Loader,
  Stack,
  Switch,
  Text,
  Title,
  createStyles,
} from "@mantine/core";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TbCheck, TbInfoCircle, TbLock, TbShieldLock, TbX } from "react-icons/tb";
import Meta from "../../components/Meta";
import useUser from "../../hooks/user.hook";
import api from "../../services/api.service";

type Settings = {
  groups: { category: string; capabilities: { key: string; label: string }[] }[];
  catalog: Record<string, string>;
  capabilities: Record<string, boolean>;
};

const useStyles = createStyles((theme) => ({
  wrapper: {
    minHeight: "calc(100vh - 180px)",
  },

  headerCard: {
    background: theme.colorScheme === "dark"
      ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.88) 0%, rgba(var(--ls-panel-bg-rgb), 0.8) 100%)"
      : "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.2 : 0.3})`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    boxShadow: theme.colorScheme === "dark"
      ? "0 18px 46px rgba(0, 0, 0, 0.24), 0 0 34px rgba(var(--ls-accent-rgb), 0.06)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  titleSection: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  titleIcon: {
    color: "var(--ls-accent)",
    filter: "drop-shadow(0 0 8px rgba(var(--ls-accent-rgb), 0.4))",
  },

  title: {
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    fontWeight: 700,
    fontSize: 28,
  },

  subtitle: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6],
    marginTop: 6,
    maxWidth: 640,
    lineHeight: 1.55,
  },

  noteCard: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    background: theme.colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.03)"
      : "rgba(0, 0, 0, 0.02)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: theme.spacing.xl,
  },

  noteIcon: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
    flexShrink: 0,
    marginTop: 2,
  },

  noteText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[7],
  },

  banner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: "12px 16px",
    marginBottom: theme.spacing.xl,
    fontSize: 14,
    fontWeight: 500,
  },

  bannerOk: {
    background: "rgba(var(--ls-accent-rgb), 0.1)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.25)",
    color: "var(--ls-accent)",
  },

  bannerError: {
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#ef4444",
  },

  groupCard: {
    background: theme.colorScheme === "dark"
      ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.88) 0%, rgba(var(--ls-panel-bg-rgb), 0.8) 100%)"
      : "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    boxShadow: theme.colorScheme === "dark"
      ? "0 18px 46px rgba(0, 0, 0, 0.24), 0 0 34px rgba(var(--ls-accent-rgb), 0.06)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  groupHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottom: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(0, 0, 0, 0.06)"
    }`,
  },

  groupIcon: {
    color: "var(--ls-accent)",
  },

  groupTitle: {
    fontWeight: 700,
    fontSize: 16,
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
  },

  capRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 0",
    borderBottom: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.04)"
        : "rgba(0, 0, 0, 0.04)"
    }`,

    "&:last-of-type": { borderBottom: "none" },
  },

  capLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: theme.colorScheme === "dark" ? theme.colors.gray[2] : theme.colors.dark[6],
  },

  saveButton: {
    background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
    border: "none",
    borderRadius: 10,
    fontWeight: 600,
    boxShadow: "0 4px 15px rgba(var(--ls-accent-rgb), 0.3)",
    transition: "all 0.25s ease",

    "&:hover": {
      background: "linear-gradient(135deg, var(--ls-accent-hover) 0%, var(--ls-accent-hover-deep) 100%)",
      boxShadow: "0 6px 20px rgba(var(--ls-accent-rgb), 0.4)",
      transform: "translateY(-1px)",
    },
  },
}));

const AccessLevels = () => {
  const router = useRouter();
  const { user } = useUser();
  const { classes, cx } = useStyles();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (user === undefined) return;
    if (!user || !user.isAdmin) router.replace("/upload");
  }, [user, router]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    api
      .get("/admin/access-levels")
      .then(({ data }) => setSettings(data))
      .catch(() => setMessage({ ok: false, text: "Could not load settings." }))
      .finally(() => setLoading(false));
  }, [user]);

  const toggle = (key: string, value: boolean) =>
    setSettings((prev) =>
      prev
        ? { ...prev, capabilities: { ...prev.capabilities, [key]: value } }
        : prev,
    );

  const save = () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    api
      .patch("/admin/access-levels", { capabilities: settings.capabilities })
      .then(({ data }) => {
        setSettings(data);
        setMessage({ ok: true, text: "Saved." });
      })
      .catch(() => setMessage({ ok: false, text: "Could not save." }))
      .finally(() => setSaving(false));
  };

  if (!user?.isAdmin || loading) {
    return (
      <Container size="md" py={80}>
        <Group position="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  const renderGroup = (
    category: string,
    caps: { key: string; label: string }[],
  ) => (
    <Box className={classes.groupCard} key={category}>
      <div className={classes.groupHeader}>
        <TbLock size={18} className={classes.groupIcon} />
        <Text className={classes.groupTitle}>{category}</Text>
      </div>
      <Stack spacing={0}>
        {caps.map(({ key, label }) => (
          <div className={classes.capRow} key={key}>
            <Text className={classes.capLabel}>{label}</Text>
            <Switch
              checked={!!settings?.capabilities[key]}
              onChange={(e) => toggle(key, e.currentTarget.checked)}
              aria-label={label}
            />
          </div>
        ))}
      </Stack>
    </Box>
  );

  return (
    <>
      <Meta title="Access Levels" />
      <Container size="md" py="xl" className={classes.wrapper}>
        <Box className={classes.headerCard}>
          <div className={classes.titleSection}>
            <TbShieldLock size={32} className={classes.titleIcon} />
            <Title className={classes.title}>Access Levels</Title>
          </div>
          <Text className={classes.subtitle}>
            Choose what a <b>Manager</b> can do. Everything is off by default, so
            a new Manager can do nothing until you grant it here. Admins always
            have full access; these toggles never apply to them.
          </Text>
        </Box>

        <Box className={classes.noteCard}>
          <TbInfoCircle size={18} className={classes.noteIcon} />
          <Text className={classes.noteText}>
            Changing a user&apos;s access level and site config are always
            admin-only and can never be granted to a Manager.
          </Text>
        </Box>

        {message && (
          <Box
            className={cx(classes.banner, {
              [classes.bannerOk]: message.ok,
              [classes.bannerError]: !message.ok,
            })}
          >
            {message.ok ? <TbCheck size={16} /> : <TbX size={16} />}
            {message.text}
          </Box>
        )}

        {(settings?.groups ?? []).map((g) =>
          renderGroup(g.category, g.capabilities),
        )}

        <Group position="right" mt="xl">
          <Button
            className={classes.saveButton}
            onClick={save}
            loading={saving}
          >
            Save changes
          </Button>
        </Group>
      </Container>
    </>
  );
};

export default AccessLevels;
