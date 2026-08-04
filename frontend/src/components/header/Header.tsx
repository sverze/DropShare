import {
  Avatar,
  Box,
  Burger,
  Button,
  Container,
  createStyles,
  Divider,
  Group,
  Image,
  Menu,
  Paper,
  Stack,
  Text,
  Transition,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import {
  TbChartBar,
  TbChevronDown,
  TbLogout,
  TbPlaylistAdd,
  TbSettings,
  TbArrowLoopLeft,
  TbShare,
  TbShieldLock,
  TbUpload,
  TbScale,
  TbUsers,
} from "react-icons/tb";
import useConfig from "../../hooks/config.hook";
import { getBulkUploadMode } from "../../utils/bulk-upload-mode.util";
import useUser from "../../hooks/user.hook";
import { canAccessAdmin, hasCapability } from "../../utils/capabilities.util";
import useTranslate from "../../hooks/useTranslate.hook";
import authService from "../../services/auth.service";
import { splitWordmark } from "../../theme/theme.util";
import { logoVersion, versionedAsset } from "../../utils/logo-asset.util";
import {
  getLeaderGroupMemberships,
  getUserGroupMemberships,
} from "../../utils/group-memberships.util";

const HEADER_HEIGHT = 64;

const SITE_ACCENT = "var(--ls-accent)";
const SITE_ACCENT_RGB = "var(--ls-accent-rgb)";

import {
  HeaderVariant,
  headerVariantStyles,
  isHeaderVariant,
  toHeaderVariant,
} from "./headerVariants";

const useStyles = createStyles(
  (
    theme,
    {
      isDrive,
      isKit,
      isShare,
      variant,
      logoUrl,
    }: {
      isDrive: boolean;
      isKit: boolean;
      isShare: boolean;
      variant: HeaderVariant;
      logoUrl: string;
    },
  ) => {
    const accent = isShare
      ? "var(--share-accent, var(--ls-accent))"
      : SITE_ACCENT;
    const accentRgb = isShare
      ? "var(--share-accent-rgb, var(--ls-accent-rgb))"
      : SITE_ACCENT_RGB;

    const outlineRgb = isShare
      ? "var(--share-accent-rgb, var(--ls-header-border-rgb))"
      : "var(--ls-header-border-rgb)";

    const shell = headerVariantStyles(
      variant,
      theme as any,
      outlineRgb,
      HEADER_HEIGHT,
    );

    return {
      headerWrapper: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 220,
        padding: "12px 16px",
        pointerEvents: "none",

        [theme.fn.smallerThan("sm")]: {
          padding: "8px 12px",
        },

        ...shell.headerWrapper,
      },

      root: {
        position: "relative",
        zIndex: 220,
        pointerEvents: "auto",
        backgroundColor: `rgba(var(--ls-header-bg-rgb), ${
          theme.colorScheme === "dark" ? 0.75 : 0.9
        })`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 16,
        border: `1px solid rgba(${outlineRgb}, ${theme.colorScheme === "dark" ? 0.3 : 0.38})`,
        boxShadow:
          theme.colorScheme === "dark"
            ? `0 8px 32px rgba(0, 0, 0, 0.4),
         0 0 20px rgba(${outlineRgb}, 0.15),
         inset 0 1px 0 rgba(255, 255, 255, 0.05)`
            : `0 20px 42px rgba(15, 23, 42, 0.08),
         0 0 46px rgba(${outlineRgb}, 0.22),
         inset 0 1px 0 rgba(255, 255, 255, 0.96)`,
        transition: "all 0.3s ease",
        maxWidth: 1200,
        margin: "0 auto",

        "&:hover": {
          border: `1px solid rgba(${outlineRgb}, 0.5)`,
          boxShadow:
            theme.colorScheme === "dark"
              ? `0 12px 40px rgba(0, 0, 0, 0.5),
           0 0 30px rgba(${outlineRgb}, 0.25),
           0 0 60px rgba(${outlineRgb}, 0.1)`
              : `0 22px 48px rgba(15, 23, 42, 0.11),
           0 0 54px rgba(${outlineRgb}, 0.28)`,
        },

        ...shell.root,
      },

      headerSpacer: {
        height: HEADER_HEIGHT + 24 + 12,
        ...shell.headerSpacer,
      },

      dropdown: {
        position: "absolute",
        top: HEADER_HEIGHT + 8,
        left: 16,
        right: 16,
        zIndex: 215,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: `rgba(var(--ls-header-bg-rgb), ${
          theme.colorScheme === "dark" ? 0.95 : 0.98
        })`,
        backdropFilter: "blur(20px)",
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.1)"
            : `rgba(${outlineRgb}, 0.24)`
        }`,
        boxShadow:
          theme.colorScheme === "dark"
            ? "0 16px 48px rgba(0, 0, 0, 0.4)"
            : `0 24px 52px rgba(15, 23, 42, 0.1), 0 0 32px rgba(${outlineRgb}, 0.16)`,

        [theme.fn.largerThan("sm")]: {
          display: "none",
        },
      },

      header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: "100%",
        ...shell.header,
      },

      links: {
        [theme.fn.smallerThan("sm")]: {
          display: "none",
        },
      },

      burger: {
        [theme.fn.largerThan("sm")]: {
          display: "none",
        },
      },

      link: {
        display: "block",
        lineHeight: 1,
        padding: "10px 14px",
        borderRadius: 8,
        textDecoration: "none",
        color:
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.75)"
            : theme.colors.gray[7],
        fontSize: 14,
        fontWeight: 500,
        transition: "all 0.2s ease",

        "&:hover": {
          backgroundColor:
            theme.colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.08)"
              : `rgba(${accentRgb}, 0.1)`,
          color: theme.colorScheme === "dark" ? "#fff" : accent,
        },

        [theme.fn.smallerThan("sm")]: {
          borderRadius: 0,
          padding: theme.spacing.md,
        },
      },

      linkActive: {
        "&, &:hover": {
          backgroundColor: isDrive || isKit || isShare
            ? `rgba(${accentRgb}, 0.1)`
            : "rgba(var(--ls-home-btn-rgb), 0.1)",
          color: isDrive || isKit || isShare ? accent : "var(--ls-home-btn)",
        },
      },

      logoGroup: {
        cursor: "pointer",
        textDecoration: "none",
        "&:hover": {
          opacity: 0.9,
        },
      },

      logoText: {
        color: "var(--ls-logo-text)",
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: "-0.5px",
      },

      logoAccent: {
        // Always the site accent. This used to fall back to --ls-logo-accent on
        // anything that was not a share page, which left the wordmark on the
        // home page ignoring the configured accent color.
        color: accent,
      },

      logoImage: {
        transition: "filter 0.25s ease, transform 0.25s ease",
      },

      logoMask: {
        width: 56,
        height: 56,
        flexShrink: 0,
        backgroundColor: accent,
        boxShadow: `0 0 18px rgba(${accentRgb}, 0.18)`,
        WebkitMaskImage: `url('${logoUrl}')`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: `url('${logoUrl}')`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
      },

      primaryButton: {
        background: isShare
          ? `linear-gradient(135deg, rgba(${accentRgb}, 0.98) 0%, rgba(${accentRgb}, 0.82) 100%)`
          : "var(--ls-upload-grad)",
        border: "none",
        color: isShare ? "#fff" : "var(--ls-on-upload)",
        fontWeight: 600,
        fontSize: 14,
        padding: "10px 20px",
        height: 38,
        borderRadius: 10,
        boxShadow: `0 4px 15px rgba(${
          isShare ? accentRgb : "var(--ls-upload-btn-rgb)"
        }, 0.3)`,
        transition: "all 0.2s ease",

        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: `0 6px 20px rgba(${
            isShare ? accentRgb : "var(--ls-upload-btn-rgb)"
          }, 0.4)`,
        },
      },

      massUploadButton: {
        background: "var(--ls-bulk-grad)",
        border: `1px solid rgba(var(--ls-bulk-btn-rgb), ${
          theme.colorScheme === "dark" ? 0.28 : 0.25
        })`,
        color: "var(--ls-on-bulk)",
        fontWeight: 600,
        fontSize: 14,
        padding: "10px 16px",
        height: 38,
        borderRadius: 10,
        boxShadow: "0 4px 15px rgba(var(--ls-bulk-btn-rgb), 0.18)",
        transition: "all 0.2s ease",

        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 8px 24px rgba(var(--ls-bulk-btn-rgb), 0.26)",
          background: "var(--ls-bulk-grad-hover)",
        },
      },

      secondaryButton: {
        backgroundColor: "transparent",
        border: `1.5px solid rgba(${accentRgb}, 0.5)`,
        color: accent,
        fontWeight: 600,
        fontSize: 14,
        padding: "10px 20px",
        height: 38,
        borderRadius: 10,
        transition: "all 0.2s ease",

        "&:hover": {
          backgroundColor: `rgba(${accentRgb}, 0.1)`,
          borderColor: accent,
        },
      },

      toolsButton: {
        padding: "8px 14px",
        borderRadius: 10,
        color:
          theme.colorScheme === "dark"
            ? theme.colors.gray[3]
            : theme.colors.gray[7],
        backgroundColor:
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.05)"
            : "rgba(0, 0, 0, 0.04)",
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.06)"
        }`,
        fontWeight: 500,
        fontSize: 14,
        transition: "all 0.2s ease",

        "&:hover": {
          backgroundColor: `rgba(${accentRgb}, 0.15)`,
          color: accent,
          borderColor: `rgba(${accentRgb}, 0.3)`,
        },

        "&[data-expanded]": {
          backgroundColor: `rgba(${accentRgb}, 0.15)`,
          color: accent,
          borderColor: `rgba(${accentRgb}, 0.3)`,
        },
      },

      userButton: {
        padding: "6px 12px",
        borderRadius: 10,
        transition: "all 0.2s ease",
        backgroundColor:
          theme.colorScheme === "dark"
            ? isShare
              ? `rgba(${accentRgb}, 0.08)`
              : "rgba(255, 255, 255, 0.05)"
            : "rgba(0, 0, 0, 0.03)",
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? isShare
              ? `rgba(${accentRgb}, 0.24)`
              : "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.06)"
        }`,
        boxShadow: isShare ? `0 4px 18px rgba(${accentRgb}, 0.14)` : "none",

        "&:hover": {
          backgroundColor: `rgba(${accentRgb}, 0.1)`,
          borderColor: `rgba(${accentRgb}, 0.2)`,
        },
      },

      userAvatar: {
        border: `2px solid rgba(${accentRgb}, 0.3)`,
        boxShadow: isShare ? `0 0 16px rgba(${accentRgb}, 0.18)` : "none",
        backgroundColor:
          theme.colorScheme === "dark"
            ? "rgba(17, 24, 39, 0.9)"
            : "rgba(255, 255, 255, 0.95)",
        flexShrink: 0,
      },

      userName: {
        color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[7],
        fontWeight: 500,
        fontSize: 14,
        maxWidth: 120,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },

      menuDropdown: {
        backgroundColor:
          theme.colorScheme === "dark"
            ? "rgba(15, 23, 42, 0.95)"
            : "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(16px)",
        border: `1px solid rgba(${accentRgb}, ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
        borderRadius: 12,
        boxShadow:
          theme.colorScheme === "dark"
            ? "0 8px 32px rgba(0, 0, 0, 0.4)"
            : "0 8px 32px rgba(0, 0, 0, 0.1)",
        zIndex: 1000,
      },

      menuItem: {
        padding: "10px 14px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,

        "&:hover": {
          backgroundColor: `rgba(${accentRgb}, ${theme.colorScheme === "dark" ? 0.1 : 0.08})`,
        },
      },

      menuItemDanger: {
        color: theme.colors.red[6],
        "&:hover": {
          backgroundColor:
            theme.colorScheme === "dark"
              ? "rgba(255, 0, 0, 0.1)"
              : "rgba(255, 0, 0, 0.08)",
        },
      },

      menuLabel: {
        color:
          theme.colorScheme === "dark"
            ? theme.colors.gray[5]
            : theme.colors.gray[6],
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        padding: "8px 14px 4px",
      },

      fixedLegalButton: {
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 50,
        backgroundColor:
          theme.colorScheme === "dark"
            ? "rgba(15, 23, 42, 0.95)"
            : "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(16px)",
        border: `1px solid rgba(${accentRgb}, 0.15)`,
        borderRadius: 12,
        padding: "10px 16px",
        boxShadow:
          theme.colorScheme === "dark"
            ? "0 8px 24px rgba(0, 0, 0, 0.4)"
            : "0 8px 24px rgba(0, 0, 0, 0.1)",
        color:
          theme.colorScheme === "dark"
            ? theme.colors.gray[4]
            : theme.colors.gray[7],
        fontSize: 14,
        fontWeight: 500,
        transition: "all 0.2s ease",
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
        [theme.fn.smallerThan("sm")]: {
          display: "none",
        },

        "&:hover": {
          backgroundColor: `rgba(${accentRgb}, 0.1)`,
          borderColor: `rgba(${accentRgb}, 0.3)`,
          color: accent,
          transform: "translateY(-2px)",
          boxShadow:
            theme.colorScheme === "dark"
              ? `0 12px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(${accentRgb}, 0.2)`
              : `0 12px 32px rgba(0, 0, 0, 0.15), 0 0 24px rgba(${accentRgb}, 0.2)`,
        },
      },

      authMenuButton: {
        backgroundColor: "transparent",
        border: `1.5px solid rgba(${accentRgb}, 0.5)`,
        color: accent,
        fontWeight: 600,
        fontSize: 14,
        padding: "10px 20px",
        height: 38,
        borderRadius: 10,
        transition: "all 0.2s ease",

        "&:hover": {
          backgroundColor: `rgba(${accentRgb}, 0.1)`,
          borderColor: accent,
        },
      },

      categoryButton: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "12px 14px",
        borderRadius: 8,
        backgroundColor:
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.03)"
            : "rgba(0, 0, 0, 0.02)",
        border: `1px solid ${
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.05)"
            : "rgba(0, 0, 0, 0.05)"
        }`,
        color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[8],
        fontWeight: 600,
        fontSize: 14,
        textDecoration: "none",
        transition: "all 0.2s ease",
        marginBottom: 4,

        "&:hover": {
          backgroundColor: `rgba(${accentRgb}, 0.1)`,
          borderColor: `rgba(${accentRgb}, 0.3)`,
          transform: "translateX(2px)",
        },
      },

      toolsList: {
        paddingLeft: 32,
        marginTop: 4,
        marginBottom: 12,
      },

      toolItem: {
        fontSize: 12,
        color:
          theme.colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.6)"
            : theme.colors.gray[6],
        padding: "4px 0",
        display: "flex",
        alignItems: "center",
        gap: 6,

        "&:before": {
          content: "\"•\"",
          color: `rgba(${accentRgb}, 0.5)`,
          fontWeight: 700,
        },
      },
    };
  },
);

const Header = () => {
  const { user } = useUser();
  const [stableAvatar, setStableAvatar] = useState<string | undefined>(undefined);
  const router = useRouter();
  const config = useConfig();
  const t = useTranslate();
  const bulkUploadPageInHeader = getBulkUploadMode(config.get) === "page";

  const [opened, toggleOpened] = useDisclosure(false);
  const [menuOpened, setMenuOpened] = useState(false);
  const [currentRoute, setCurrentRoute] = useState("");
  const [isSharePage, setIsSharePage] = useState(false);
  const [mounted, setMounted] = useState(false);


  useEffect(() => {
    if (user?.avatar) {
      setStableAvatar(user.avatar);
    }
  }, [user?.avatar]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSharePage(
        router.pathname.startsWith("/share/") ||
          router.pathname.startsWith("/s/"),
      );
      setMounted(true);
    }
    setCurrentRoute(router.pathname);
  }, [router.pathname]);

  const headerVariant: HeaderVariant = isHeaderVariant(router.query.header)
    ? router.query.header
    : toHeaderVariant(
        (() => {
          try {
            return config.get("general.themeHeaderStyle");
          } catch {
            return undefined;
          }
        })(),
      );

  const siteLogoUrl = versionedAsset(
    "/img/logo.png",
    logoVersion((key) => config.get(key as `${string}.${string}`)),
  );

  const { classes, cx } = useStyles({
    isDrive: false,
    isKit: false,
    isShare: isSharePage,
    variant: headerVariant,
    logoUrl: siteLogoUrl,
  });

  const iconColor = isSharePage
    ? "var(--share-accent, var(--ls-accent))"
    : SITE_ACCENT;

  const getHomeUrl = () => "/";

  const appName = (config.get("general.appName") as string) || "This site";
  const logoIsOpaque = config.get("general.themeLogoIsOpaque") === true;
  const wordmark = splitWordmark(appName);

  const getUploadUrl = () => "/upload";
  const getMassUploadUrl = () => "/upload/mass";
  const getAccountUrl = (path: string) => path;
  const getAuthUrl = (path: string) => path;

  const getInitials = (username: string) => {
    return username
      .split(/[\s._-]/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const navigateTo = (url: string) => {
    if (typeof window !== "undefined" && isSharePage) {
      window.location.assign(url);
      return;
    }
    if (url.startsWith("http")) {
      window.location.href = url;
    } else {
      router.push(url);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut({ redirect: false });
    if (typeof window !== "undefined") {
      window.location.href = "/?logged_out=1";
    }
  };

  const UserMenu = () => (
    <Menu
      opened={menuOpened}
      onChange={setMenuOpened}
      position="bottom-end"
      offset={8}
      width={200}
      shadow="lg"
      zIndex={240}
      classNames={{ dropdown: classes.menuDropdown }}
    >
      <Menu.Target>
        <UnstyledButton className={classes.userButton}>
          <Group spacing={10}>
            <Avatar
              src={stableAvatar}
              size={32}
              radius="xl"
              color="green"
              className={classes.userAvatar}
              imageProps={{
                referrerPolicy: "no-referrer",
                loading: "eager",
                draggable: false,
              }}
            >
              {user?.username ? getInitials(user.username) : "U"}
            </Avatar>
            <Box sx={{ flex: 1 }} className={classes.userName}>
              {user?.username || "User"}
            </Box>
            <TbChevronDown
              size={16}
              style={{
                transition: "transform 0.2s ease",
                transform: menuOpened ? "rotate(180deg)" : "rotate(0deg)",
                color: iconColor,
              }}
            />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          icon={<TbShare size={18} />}
          className={classes.menuItem}
          onClick={() => navigateTo(getAccountUrl("/account/shares"))}
        >
          My Shares
        </Menu.Item>
        {getUserGroupMemberships(user).length > 0 ? (
          <Menu.Item
            icon={<TbUsers size={18} />}
            className={classes.menuItem}
            onClick={() => navigateTo(getAccountUrl("/account/group-shares"))}
          >
            Group Shares
          </Menu.Item>
        ) : null}
        {getLeaderGroupMemberships(user).length > 0 ? (
          <Menu.Item
            icon={<TbSettings size={18} />}
            className={classes.menuItem}
            onClick={() => navigateTo(getAccountUrl("/account/manage-group"))}
          >
            Manage Group
          </Menu.Item>
        ) : null}
        {config.get("share.allowReverseShares") && (
          <Menu.Item
            icon={<TbArrowLoopLeft size={18} />}
            className={classes.menuItem}
            onClick={() => navigateTo(getAccountUrl("/account/reverseShares"))}
          >
            Reverse Shares
          </Menu.Item>
        )}
        <Menu.Item
          icon={<TbSettings size={18} />}
          className={classes.menuItem}
          onClick={() => navigateTo(getAccountUrl("/account"))}
        >
          Settings
        </Menu.Item>
        {canAccessAdmin(user) && (
          <>
            <Divider my={6} color="rgba(255,255,255,0.1)" />
            <Menu.Item
              icon={<TbShieldLock size={18} />}
              className={classes.menuItem}
              onClick={() => navigateTo(getAccountUrl("/admin"))}
            >
              Admin Panel
            </Menu.Item>
            {hasCapability(user, "stats.view") && (
              <Menu.Item
                icon={<TbChartBar size={18} />}
                className={classes.menuItem}
                onClick={() => navigateTo(getAccountUrl("/admin/stats"))}
              >
                Stats
              </Menu.Item>
            )}
          </>
        )}

        <Divider my={6} color="rgba(255,255,255,0.1)" />
        <Menu.Item
          icon={<TbLogout size={18} />}
          className={cx(classes.menuItem, classes.menuItemDanger)}
          onClick={handleSignOut}
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  const AuthenticatedNav = () => (
    <Group spacing={12}>
      {config.get("general.showHomePage") && (
        <Link
          href="/"
          className={cx(classes.link, {
            [classes.linkActive]: currentRoute === "/",
          })}
        >
          {t("navbar.home")}
        </Link>
      )}

      {(
        <>
          <a href={getUploadUrl()}>
            <Button
              leftIcon={<TbUpload size={18} />}
              className={classes.primaryButton}
            >
              {t("navbar.upload")}
            </Button>
          </a>
          {bulkUploadPageInHeader && (
            <a href={getMassUploadUrl()}>
              <Button
                leftIcon={<TbPlaylistAdd size={18} />}
                className={classes.massUploadButton}
              >
                Bulk Upload
              </Button>
            </a>
          )}
        </>
      )}
      <UserMenu />
    </Group>
  );

  const UnauthenticatedNav = () => (
    <Group spacing={12}>
      {config.get("general.showHomePage") && (
        <Link
          href="/"
          className={cx(classes.link, {
            [classes.linkActive]: currentRoute === "/",
          })}
        >
          {t("navbar.home")}
        </Link>
      )}

      {config.get("share.allowUnauthenticatedShares") && (
        <>
          <a href={getUploadUrl()}>
            <Button
              leftIcon={<TbUpload size={18} />}
              className={classes.primaryButton}
            >
              {t("navbar.upload")}
            </Button>
          </a>
          {bulkUploadPageInHeader && (
            <a href={getMassUploadUrl()}>
              <Button
                leftIcon={<TbPlaylistAdd size={18} />}
                className={classes.massUploadButton}
              >
                Bulk Upload
              </Button>
            </a>
          )}
        </>
      )}

      <Menu shadow="md" width={160} position="bottom-end">
        <Menu.Target>
          <Button className={classes.authMenuButton}>
            {t("navbar.signin")}
          </Button>
        </Menu.Target>

        <Menu.Dropdown className={classes.menuDropdown}>
          <a
            href={getAuthUrl("/auth/signIn")}
            style={{ textDecoration: "none" }}
          >
            <Menu.Item className={classes.menuItem}>Sign In</Menu.Item>
          </a>
          {config.get("share.allowRegistration") && (
            <a
              href={getAuthUrl("/auth/signUp")}
              style={{ textDecoration: "none" }}
            >
              <Menu.Item className={classes.menuItem}>Sign Up</Menu.Item>
            </a>
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );

  const MobileNav = () => (
    <Stack spacing={0} p="md">
      {user ? (
        <>
          <Box px={6} py={8}>
            <Group spacing={12}>
              <Avatar
                src={stableAvatar}
                size={40}
                radius="xl"
                color="green"
                imageProps={{
                  referrerPolicy: "no-referrer",
                  loading: "eager",
                  draggable: false,
                }}
              >
                {user?.username ? getInitials(user.username) : "U"}
              </Avatar>
              <Box>
                <Text weight={600} size="sm">
                  {user.username}
                </Text>
                <Text size="xs" color="dimmed">
                  {user.email}
                </Text>
              </Box>
            </Group>
          </Box>

          <Divider my="xs" color="rgba(255,255,255,0.05)" />

          {config.get("general.showHomePage") && (
            <Link
              href="/"
              className={cx(classes.link, {
                [classes.linkActive]: currentRoute === "/",
              })}
              onClick={() => toggleOpened.close()}
            >
              {t("navbar.home")}
            </Link>
          )}

          <a
            href={getUploadUrl()}
            className={classes.link}
            onClick={() => toggleOpened.close()}
          >
            <Group spacing="xs">
              <TbUpload size={18} />
              Upload
            </Group>
          </a>
          {bulkUploadPageInHeader && (
            <a
              href={getMassUploadUrl()}
              className={classes.link}
              onClick={() => toggleOpened.close()}
            >
              <Group spacing="xs">
                <TbPlaylistAdd
                  size={18}
                  style={{ color: "var(--ls-bulk-soft)" }}
                />
                Bulk Upload
              </Group>
            </a>
          )}

          <Divider my="xs" color="rgba(255,255,255,0.05)" />

          <a
            href={getAccountUrl("/account/shares")}
            className={classes.link}
            onClick={() => toggleOpened.close()}
          >
            <Group spacing="xs">
              <TbShare size={18} />
              My Shares
            </Group>
          </a>
          {getUserGroupMemberships(user).length > 0 ? (
            <a
              href={getAccountUrl("/account/group-shares")}
              className={classes.link}
              onClick={() => toggleOpened.close()}
            >
              <Group spacing="xs">
                <TbUsers size={18} />
                Group Shares
              </Group>
            </a>
          ) : null}
          {getLeaderGroupMemberships(user).length > 0 ? (
            <a
              href={getAccountUrl("/account/manage-group")}
              className={classes.link}
              onClick={() => toggleOpened.close()}
            >
              <Group spacing="xs">
                <TbSettings size={18} />
                Manage Group
              </Group>
            </a>
          ) : null}
          {config.get("share.allowReverseShares") && (
            <a
              href={getAccountUrl("/account/reverseShares")}
              className={classes.link}
              onClick={() => toggleOpened.close()}
            >
              <Group spacing="xs">
                <TbArrowLoopLeft size={18} />
                Reverse Shares
              </Group>
            </a>
          )}
          <a
            href={getAccountUrl("/account")}
            className={classes.link}
            onClick={() => toggleOpened.close()}
          >
            <Group spacing="xs">
              <TbSettings size={18} />
              Settings
            </Group>
          </a>

          {canAccessAdmin(user) && (
            <>
              <Divider my="xs" color="rgba(255,255,255,0.05)" />
              <a
                href={getAccountUrl("/admin")}
                className={classes.link}
                onClick={() => toggleOpened.close()}
              >
                <Group spacing="xs">
                  <TbShieldLock size={18} />
                  Admin Panel
                </Group>
              </a>
              {hasCapability(user, "stats.view") && (
                <a
                  href={getAccountUrl("/admin/stats")}
                  className={classes.link}
                  onClick={() => toggleOpened.close()}
                >
                  <Group spacing="xs">
                    <TbChartBar size={18} />
                    Stats
                  </Group>
                </a>
              )}
            </>
          )}

          <Divider my="xs" color="rgba(255,255,255,0.05)" />
          <UnstyledButton
            className={cx(classes.link, classes.menuItemDanger)}
            onClick={() => {
              toggleOpened.close();
              handleSignOut();
            }}
          >
            <Group spacing="xs">
              <TbLogout size={18} />
              Logout
            </Group>
          </UnstyledButton>
        </>
      ) : (
        <>
          {config.get("general.showHomePage") && (
            <Link
              href="/"
              className={cx(classes.link, {
                [classes.linkActive]: currentRoute === "/",
              })}
              onClick={() => toggleOpened.close()}
            >
              {t("navbar.home")}
            </Link>
          )}

          {config.get("share.allowUnauthenticatedShares") && (
            <>
              <a
                href={getUploadUrl()}
                className={classes.link}
                onClick={() => toggleOpened.close()}
              >
                <Group spacing="xs">
                  <TbUpload size={18} />
                  Upload
                </Group>
              </a>
              {bulkUploadPageInHeader && (
                <a
                  href={getMassUploadUrl()}
                  className={classes.link}
                  onClick={() => toggleOpened.close()}
                >
                  <Group spacing="xs">
                    <TbPlaylistAdd
                      size={18}
                      style={{ color: "var(--ls-bulk-soft)" }}
                    />
                    Bulk Upload
                  </Group>
                </a>
              )}
            </>
          )}

          <Divider my="xs" color="rgba(255,255,255,0.05)" />

          <a
            href={getAuthUrl("/auth/signIn")}
            className={classes.link}
            onClick={() => toggleOpened.close()}
          >
            {t("navbar.signin")}
          </a>
          {config.get("share.allowRegistration") && (
            <a
              href={getAuthUrl("/auth/signUp")}
              className={classes.link}
              onClick={() => toggleOpened.close()}
            >
              {t("navbar.signup")}
            </a>
          )}
        </>
      )}
    </Stack>
  );

  return (
    <>
      <Box className={classes.headerSpacer} />

      <Box
        className={classes.headerWrapper}
        sx={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.15s ease-in-out",
        }}
      >
        <Box className={classes.root}>
          <Container
            className={classes.header}
            size="lg"
            sx={{ height: HEADER_HEIGHT }}
          >
            <a href={getHomeUrl()} className={classes.logoGroup}>
              <Group spacing={12}>
                {!logoIsOpaque ? (
                  <Box
                    className={classes.logoMask}
                    aria-label={`${appName} Logo`}
                  />
                ) : (
                  <Image
                    src={siteLogoUrl}
                    alt={`${appName} Logo`}
                    height={56}
                    width={56}
                    className={classes.logoImage}
                  />
                )}
                <Text className={classes.logoText}>
                  {wordmark.head}
                  {wordmark.tail && (
                    <span className={classes.logoAccent}>{wordmark.tail}</span>
                  )}
                </Text>
              </Group>
            </a>

            <Group className={classes.links}>
              {user ? <AuthenticatedNav /> : <UnauthenticatedNav />}
            </Group>

            <Burger
              opened={opened}
              onClick={() => toggleOpened.toggle()}
              className={classes.burger}
              size="sm"
              color={opened ? iconColor : undefined}
            />

            <Transition
              transition="pop-top-right"
              duration={200}
              mounted={opened}
            >
              {(styles) => (
                <Paper className={classes.dropdown} withBorder style={styles}>
                  <MobileNav />
                </Paper>
              )}
            </Transition>
          </Container>
        </Box>
      </Box>

      {config.get("legal.enabled") &&
        (config.get("legal.termsOfServiceEnabled") ||
          config.get("legal.privacyPolicyEnabled") ||
          config.get("legal.dmcaEnabled") ||
          config.get("legal.contactEnabled") ||
          (config.get("legal.imprintEnabled") &&
            !!(
              config.get("legal.imprintText") || config.get("legal.imprintUrl")
            ))) && (
          <Link href="/legal" className={classes.fixedLegalButton}>
            <TbScale size={18} />
            <span>Help / Legal</span>
          </Link>
        )}
    </>
  );
};

export default Header;
