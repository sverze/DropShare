import {
  Center,
  Col,
  createStyles,
  Grid,
  Group,
  Stack,
  Text,
  Box,
  LoadingOverlay,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TbLink, TbMail, TbRefresh, TbSettings, TbUsers, TbChevronRight, TbSpeakerphone, TbChartBar, TbList, TbShieldLock } from "react-icons/tb";
import {
  canAccessAdmin,
  canAccessAdminRoute,
} from "../../utils/capabilities.util";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import useConfig from "../../hooks/config.hook";
import useUser from "../../hooks/user.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import configService from "../../services/config.service";

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

  title: {
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    fontWeight: 700,
    fontSize: 28,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  titleIcon: {
    color: "var(--ls-accent)",
    filter: "drop-shadow(0 0 8px rgba(var(--ls-accent-rgb), 0.4))",
  },

  subtitle: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6],
    marginTop: 4,
  },

  gridContainer: {
    background: theme.colorScheme === "dark"
      ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.88) 0%, rgba(var(--ls-panel-bg-rgb), 0.8) 100%)"
      : "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    padding: theme.spacing.xl,
    boxShadow: theme.colorScheme === "dark"
      ? "0 18px 46px rgba(0, 0, 0, 0.24), 0 0 34px rgba(var(--ls-accent-rgb), 0.06)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  item: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    textAlign: "left",
    minHeight: 112,
    padding: "20px 24px",
    background: theme.colorScheme === "dark"
      ? "rgba(0, 0, 0, 0.2)"
      : "rgba(255, 255, 255, 0.6)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
    borderRadius: 12,
    transition: "all 0.25s ease",
    textDecoration: "none",

    "&:hover": {
      background: theme.colorScheme === "dark"
        ? "rgba(var(--ls-accent-rgb), 0.08)"
        : "rgba(var(--ls-accent-rgb), 0.05)",
      borderColor: "rgba(var(--ls-accent-rgb), 0.4)",
      boxShadow: "0 4px 20px rgba(var(--ls-accent-rgb), 0.15)",
      transform: "translateY(-2px)",
    },
  },

  itemLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
  },

  itemIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: theme.colorScheme === "dark"
      ? "rgba(var(--ls-accent-rgb), 0.1)"
      : "rgba(var(--ls-accent-rgb), 0.08)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.2)",
  },

  itemIcon: {
    color: "var(--ls-accent)",
    filter: "drop-shadow(0 0 6px rgba(var(--ls-accent-rgb), 0.4))",
  },

  itemTitle: {
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    fontWeight: 600,
    fontSize: 16,
  },

  itemDescription: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
    fontSize: 13,
    marginTop: 2,
    lineHeight: 1.35,
  },

  itemArrow: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[6] : theme.colors.gray[5],
    transition: "all 0.25s ease",
  },

  versionText: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[6] : theme.colors.gray[5],
    fontSize: 12,
  },

  versionBadge: {
    background: theme.colorScheme === "dark"
      ? "rgba(var(--ls-accent-rgb), 0.1)"
      : "rgba(var(--ls-accent-rgb), 0.08)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.2)",
    borderRadius: 8,
    padding: "4px 12px",
    fontSize: 12,
    color: "var(--ls-accent)",
    fontFamily: "monospace",
  },
}));

const Admin = () => {
  const { classes } = useStyles();
  const t = useTranslate();
  const config = useConfig();
  const appName = config.get("general.appName") || "your site";
  const router = useRouter();
  const { user } = useUser();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const managementOptionsBase = [
    {
      title: t("admin.button.users"),
      description: "Manage user accounts and permissions",
      icon: TbUsers,
      route: "/admin/users",
      capability: "users.view",
    },
    {
      title: "Statistics",
      description: "Views, downloads, and the exportable report",
      icon: TbChartBar,
      route: "/admin/stats",
      capability: "stats.view",
    },
    {
      title: t("admin.button.shares"),
      description: "Shares, zip archives, security, and preview processing",
      icon: TbLink,
      route: "/admin/shares",
      capability: "shares.view",
    },
    {
      title: "Email Center",
      description: "Manage email templates and send broadcasts",
      icon: TbMail,
      route: "/admin/emails",
      capability: "emails.view",
    },
    {
      title: "Request Logs",
      description: "Browse recent requests",
      icon: TbList,
      route: "/admin/logs",
      capability: "logs.view",
    },
    {
      title: t("admin.button.config"),
      description: "Configure application settings",
      icon: TbSettings,
      route: "/admin/config/general",
    },
    {
      title: "Access Levels",
      description: "Choose what Managers can do",
      icon: TbShieldLock,
      route: "/admin/access-levels",
    },
    {
      title: "Banners",
      description: "Site-wide notices with links and page targeting",
      icon: TbSpeakerphone,
      route: "/admin/banners",
    },
  ];

  const [updateAvailable, setUpdateAvailable] = useState(false);

  const managementOptions = [
    ...managementOptionsBase.filter((item) =>
      canAccessAdminRoute(user, item.route),
    ),
    ...(updateAvailable
      ? [
          {
            title: "Update Available",
            description: "A new version is ready to install",
            icon: TbRefresh,
            route: "https://your-domain.com",
            capability: undefined as string | undefined,
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (user === undefined) {
      return;
    }

    if (!canAccessAdmin(user)) {
      router.replace("/upload");
    } else {
      setIsCheckingAuth(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (isCheckingAuth) return;

    configService
      .isNewReleaseAvailable()
      .then((isNewReleaseAvailable) => {
        if (isNewReleaseAvailable) setUpdateAvailable(true);
      })
      .catch();
  }, [isCheckingAuth]);

  if (isCheckingAuth) {
    return <LoadingOverlay visible overlayOpacity={1} />;
  }

  return (
    <>
      <Meta title={t("admin.title")} />
      <Stack className={classes.wrapper} justify="space-between">
        <div>
          <Box className={classes.headerCard}>
            <div className={classes.title}>
              <TbSettings size={32} className={classes.titleIcon} />
              <FormattedMessage id="admin.title" />
            </div>
            <Text className={classes.subtitle}>
              Manage your {appName} instance
            </Text>
          </Box>

          <Box className={classes.gridContainer}>
            <Grid gutter="md">
              {managementOptions.map((item) => (
                <Col xs={12} sm={6} key={item.route}>
                  <Link href={item.route} passHref legacyBehavior>
                    <a className={classes.item}>
                      <div className={classes.itemLeft}>
                        <div className={classes.itemIconWrapper}>
                          <item.icon size={24} className={classes.itemIcon} />
                        </div>
                        <div>
                          <Text className={classes.itemTitle}>{item.title}</Text>
                          <Text className={classes.itemDescription}>
                            {item.description}
                          </Text>
                        </div>
                      </div>
                      <TbChevronRight size={20} className={classes.itemArrow} />
                    </a>
                  </Link>
                </Col>
              ))}
            </Grid>
          </Box>
        </div>

        <Center>
          <Group spacing="xs">
            <Text className={classes.versionText}>
              <FormattedMessage id="admin.version" />
            </Text>
            <span className={classes.versionBadge}>{process.env.VERSION}</span>
          </Group>
        </Center>
      </Stack>
    </>
  );
};

export default Admin;
