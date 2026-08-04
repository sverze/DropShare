import {
  Box,
  Button,
  createStyles,
  Group,
  MediaQuery,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import Link from "next/link";
import { Dispatch, SetStateAction } from "react";
import {
  TbAt,
  TbBinaryTree,
  TbBucket,
  TbCoins,
  TbMail,
  TbScale,
  TbServerBolt,
  TbSettings,
  TbShare,
  TbSocial,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useUser from "../../../hooks/user.hook";
import { accessibleConfigCategories } from "../../../utils/capabilities.util";

const categories = [
  { name: "General", icon: <TbSettings /> },
  { name: "Email", icon: <TbMail /> },
  { name: "Share", icon: <TbShare /> },
  { name: "Donations", icon: <TbCoins /> },
  { name: "SMTP", icon: <TbAt /> },
  { name: "OAuth", icon: <TbSocial /> },
  { name: "LDAP", icon: <TbBinaryTree /> },
  { name: "S3", icon: <TbBucket /> },
  { name: "Legal", icon: <TbScale /> },
  { name: "Cache", icon: <TbServerBolt /> },
];

const useStyles = createStyles((theme) => ({
  root: {
    width: "100%",
    background: theme.colorScheme === "dark"
      ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.95) 0%, rgba(var(--ls-panel-bg-rgb), 0.94) 100%)"
      : "rgba(255, 255, 255, 0.92)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-accent-rgb), 0.12)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
    borderRadius: 0,
    padding: theme.spacing.md,
    minHeight: "100%",
    boxShadow: theme.colorScheme === "dark"
      ? "inset 0 1px 0 rgba(255, 255, 255, 0.02)"
      : "none",

    [theme.fn.smallerThan("md")]: {
      background: "transparent",
      padding: 0,
    },
  },

  sectionTitle: {
    color:
      theme.colorScheme === "dark"
        ? "rgba(226, 232, 240, 0.56)"
        : theme.colors.gray[6],
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginBottom: theme.spacing.sm,
  },

  link: {
    display: "block",
    padding: "10px 12px",
    borderRadius: 14,
    color:
      theme.colorScheme === "dark"
        ? "rgba(226, 232, 240, 0.78)"
        : theme.colors.dark[5],
    textDecoration: "none",
    transition: "all 160ms ease",

    "&:hover": {
      background:
        `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.08})`,
      color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    },
  },

  activeLink: {
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.22), rgba(var(--ls-accent-rgb), 0.1))"
        : "linear-gradient(135deg, rgba(var(--ls-panel-border-rgb), 0.18), rgba(var(--ls-accent-rgb), 0.1))",
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    border: "1px solid rgba(var(--ls-accent-rgb), 0.22)",
    boxShadow: "0 10px 28px rgba(var(--ls-accent-rgb), 0.08)",
    fontWeight: 700,
  },

  icon: {
    background:
      `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.12 : 0.1})`,
    color: "var(--ls-accent)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.18)",
  },

  activeIcon: {
    background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
    color: theme.colors.dark[8],
    border: "none",
  },

  backButton: {
    marginTop: theme.spacing.xl,
    width: "100%",
    borderRadius: 12,
    background:
      `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.08})`,
    color: theme.colorScheme === "dark" ? theme.white : "var(--ls-accent-deep)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.18)",
  },
}));

const ConfigurationNavBar = ({
  categoryId,
  isMobileNavBarOpened,
  setIsMobileNavBarOpened,
}: {
  categoryId: string;
  isMobileNavBarOpened: boolean;
  setIsMobileNavBarOpened: Dispatch<SetStateAction<boolean>>;
}) => {
  const { classes } = useStyles();
  void isMobileNavBarOpened;

  const { user } = useUser();
  const allowed = accessibleConfigCategories(user);
  const visibleCategories = categories.filter((category) =>
    allowed.includes(category.name.toLowerCase()),
  );

  return (
    <Box className={classes.root}>
      <Box>
        <Text className={classes.sectionTitle}>
          <FormattedMessage id="admin.config.title" />
        </Text>
        <Stack spacing="xs">
          {visibleCategories.map((category) => (
            <Box
              component={Link}
              onClick={() => setIsMobileNavBarOpened(false)}
              className={`${classes.link} ${
                categoryId == category.name.toLowerCase()
                  ? classes.activeLink
                  : ""
              }`}
              key={category.name}
              href={`/admin/config/${category.name.toLowerCase()}`}
            >
              <Group spacing="sm" noWrap>
                <ThemeIcon
                  className={
                    categoryId == category.name.toLowerCase()
                      ? classes.activeIcon
                      : classes.icon
                  }
                  radius="md"
                >
                  {category.icon}
                </ThemeIcon>
                <Text size="sm">
                  <FormattedMessage
                    id={`admin.config.category.${category.name.toLowerCase()}`}
                  />
                </Text>
              </Group>
            </Box>
          ))}
        </Stack>
      </Box>
      <MediaQuery largerThan="sm" styles={{ display: "block" }}>
        <Button className={classes.backButton} variant="subtle" component={Link} href="/admin">
          <FormattedMessage id="common.button.go-back" />
        </Button>
      </MediaQuery>
    </Box>
  );
};

export default ConfigurationNavBar;
