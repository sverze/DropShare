import {
  Badge,
  Box,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  createStyles,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";
import {
  TbClock,
  TbCloudUpload,
  TbFolders,
  TbInbox,
  TbLock,
  TbPalette,
  TbPhoto,
} from "react-icons/tb";
import Meta from "../components/Meta";
import useConfig from "../hooks/config.hook";
import useUser from "../hooks/user.hook";
import { byteToHumanSizeString } from "../utils/fileSize.util";
import { logoVersion, versionedAsset } from "../utils/logo-asset.util";

const ACCENT = "var(--ls-accent)";

const useStyles = createStyles((theme) => ({
  wrapper: {
    width: "min(1180px, calc(100vw - 48px))",
    margin: "0 auto",
    paddingBottom: 80,

    [theme.fn.smallerThan("sm")]: {
      width: "calc(100vw - 32px)",
    },
  },

  hero: {
    textAlign: "center",
    paddingTop: 72,
    paddingBottom: 56,

    [theme.fn.smallerThan("sm")]: {
      paddingTop: 40,
    },
  },

  heroTitle: {
    fontSize: 54,
    lineHeight: 1.08,
    fontWeight: 800,
    letterSpacing: -1.5,
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],

    [theme.fn.smallerThan("sm")]: {
      fontSize: 36,
    },
  },

  accent: {
    color: ACCENT,
    textShadow: "0 0 28px rgba(var(--ls-accent-rgb), 0.35)",
  },

  heroText: {
    maxWidth: 660,
    margin: "18px auto 0",
    fontSize: 18,
    lineHeight: 1.65,
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[4]
        : theme.colors.gray[7],

    [theme.fn.smallerThan("sm")]: {
      fontSize: 16,
    },
  },

  primaryButton: {
    background: `linear-gradient(135deg, ${ACCENT} 0%, var(--ls-accent-deep) 100%)`,
    border: "none",
    color: "#04120a",
    fontWeight: 700,
    boxShadow: "0 10px 30px rgba(var(--ls-accent-rgb), 0.25)",

    "&:hover": {
      background: "linear-gradient(135deg, var(--ls-accent-hover) 0%, var(--ls-accent-hover-deep) 100%)",
    },
  },

  sectionTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
  },

  card: {
    height: "100%",
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.82})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.14 : 0.18})`,
    padding: 22,
    transition: "transform 0.2s ease, border-color 0.2s ease",

    "&:hover": {
      transform: "translateY(-3px)",
      borderColor:
        "rgba(var(--ls-panel-border-rgb), 0.34)",
    },
  },

  cardIcon: {
    color: ACCENT,
    marginBottom: 12,
    filter: "drop-shadow(0 0 10px rgba(var(--ls-accent-rgb), 0.28))",
  },

  cardTitle: {
    fontWeight: 600,
    fontSize: 16,
    marginBottom: 6,
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
  },

  cardText: {
    fontSize: 14,
    lineHeight: 1.6,
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[5]
        : theme.colors.gray[7],
  },

  stepNumber: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
    color: "#04120a",
    background: `linear-gradient(135deg, ${ACCENT} 0%, var(--ls-accent-deep) 100%)`,
  },

  howItWorks: {
    marginTop: 72,
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.07) 0%, rgba(var(--ls-panel-bg-rgb), 0.6) 100%)"
        : "linear-gradient(135deg, rgba(var(--ls-panel-border-rgb), 0.07) 0%, rgba(255, 255, 255, 0.85) 100%)",
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.2 : 0.24})`,
    borderRadius: 20,
    padding: 40,

    [theme.fn.smallerThan("sm")]: {
      padding: 24,
    },
  },
}));

const FEATURES = [
  {
    icon: TbClock,
    title: "Links that expire",
    text: "Set how long a link lives, minutes to never. When it expires, it stops working.",
  },
  {
    icon: TbLock,
    title: "Lock it down",
    text: "Add a password, or cap how many times a share can be opened.",
  },
  {
    icon: TbInbox,
    title: "Ask for files",
    text: "Send a link others can upload to, no account needed on their end.",
  },
  {
    icon: TbPhoto,
    title: "Look before downloading",
    text: "Video, audio, photos, PDFs and text open right in the browser.",
  },
  {
    icon: TbFolders,
    title: "Whole folders",
    text: "Drop in a folder and its structure is kept, take it all as a zip or pick files.",
  },
  {
    icon: TbPalette,
    title: "Make it look right",
    text: "Give each share its own accent color and layout.",
  },
];

const STEPS = [
  {
    title: "Upload",
    text: "Drag in files or a whole folder.",
  },
  {
    title: "Set the rules",
    text: "Choose expiry, add a password or view limit, and name it.",
  },
  {
    title: "Send the link",
    text: "Copy it, or have us email it for you.",
  },
];


const HomePage = () => {
  const { classes } = useStyles();
  const router = useRouter();
  const config = useConfig();
  const { user } = useUser();

  const showHomePage = !!config.get("general.showHomePage");
  const isPreview = router.query.preview !== undefined;
  const shouldRender = showHomePage || isPreview;

  useEffect(() => {
    if (!shouldRender) router.replace("/upload");
  }, [shouldRender, router]);

  if (!shouldRender) {
    return (
      <Center style={{ height: "50vh" }}>
        <Stack align="center" spacing="md">
          <Loader size="lg" />
          <Text color="dimmed">Redirecting...</Text>
        </Stack>
      </Center>
    );
  }

  const appName = config.get("general.appName") || "This site";
  const logoIsOpaque = config.get("general.themeLogoIsOpaque") === true;
  const heroLogoUrl = versionedAsset("/img/logo.png", logoVersion(config.get));
  const maxShareSize = parseInt(config.get("share.maxSize"));
  const maxSizeLabel = Number.isFinite(maxShareSize) && maxShareSize > 0
    ? byteToHumanSizeString(maxShareSize)
    : null;

  return (
    <>
      <Meta
        title="Share files, simply"
        description={`Send files with ${appName}: share a link that expires when you choose, protect it with a password, and preview videos, music, photos and PDFs in the browser.`}
      />


      <Box className={classes.wrapper}>
        {isPreview && !showHomePage && (
          <Badge color="yellow" variant="light" mt="md">
            Preview - hidden until “Show home page” is enabled in Configuration →
            General
          </Badge>
        )}

        <Box className={classes.hero}>
          {logoIsOpaque ? (
            <img
              src={heroLogoUrl}
              alt={appName}
              width={88}
              height={88}
              style={{ borderRadius: 20 }}
            />
          ) : (
            // Tint the mark with the site accent the same way the header does:
            // the PNG becomes a mask and the accent shows through it. Skipped
            // for opaque logos, which have no silhouette to mask against.
            <Box
              aria-label={`${appName} logo`}
              style={{
                width: 88,
                height: 88,
                margin: "0 auto",
                backgroundColor: ACCENT,
                filter: "drop-shadow(0 0 28px rgba(var(--ls-accent-rgb), 0.35))",
                WebkitMaskImage: `url('${heroLogoUrl}')`,
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                WebkitMaskSize: "contain",
                maskImage: `url('${heroLogoUrl}')`,
                maskRepeat: "no-repeat",
                maskPosition: "center",
                maskSize: "contain",
              }}
            />
          )}
          <Title className={classes.heroTitle} mt="lg">
            Send files without
            <br />
            <span className={classes.accent}>losing control of them</span>
          </Title>
          <Text className={classes.heroText}>
            Upload a file, decide who can open it and for how long, then send one
            link that expires on your terms.
          </Text>

          <Group position="center" spacing="md" mt={36}>
            <Button
              component={Link}
              href={user ? "/upload" : "/auth/signIn"}
              size="md"
              className={classes.primaryButton}
              leftIcon={<TbCloudUpload size={18} />}
            >
              {user ? "Start sharing" : "Sign in to start sharing"}
            </Button>
            {user && (
              <Button
                component={Link}
                href="/account/shares"
                size="md"
                variant="default"
              >
                My shares
              </Button>
            )}
          </Group>
          {maxSizeLabel && (
            <Text size="xs" color="dimmed" mt={14}>
              Shares of up to {maxSizeLabel} each.
            </Text>
          )}
        </Box>

        <Title order={2} className={classes.sectionTitle} mb="lg">
          What you get
        </Title>
        <Grid gutter="md">
          {FEATURES.map((feature) => (
            <Grid.Col key={feature.title} span={12} sm={6} md={4}>
              <Box className={classes.card}>
                <feature.icon size={26} className={classes.cardIcon} />
                <Text className={classes.cardTitle}>{feature.title}</Text>
                <Text className={classes.cardText}>{feature.text}</Text>
              </Box>
            </Grid.Col>
          ))}
        </Grid>

        <Box className={classes.howItWorks}>
          <Title order={2} className={classes.sectionTitle} mb="lg">
            How it works
          </Title>
          <Grid gutter="xl">
            {STEPS.map((step, index) => (
              <Grid.Col key={step.title} span={12} sm={4}>
                <Group spacing={12} align="center" mb={8} noWrap>
                  <Box className={classes.stepNumber}>{index + 1}</Box>
                  <Text className={classes.cardTitle} style={{ marginBottom: 0 }}>
                    {step.title}
                  </Text>
                </Group>
                <Text className={classes.cardText}>{step.text}</Text>
              </Grid.Col>
            ))}
          </Grid>

          <Group position="center" mt={40}>
            <Button
              component={Link}
              href={user ? "/upload" : "/auth/signIn"}
              size="md"
              className={classes.primaryButton}
              leftIcon={<TbCloudUpload size={18} />}
            >
              {user ? "Create a share" : "Sign in to get started"}
            </Button>
          </Group>
        </Box>
      </Box>
    </>
  );
};

export default HomePage;
