import {
  Alert,
  Box,
  Button,
  Container,
  Drawer,
  Group,
  Stack,
  Text,
  Title,
  createStyles,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  TbInfoCircle,
  TbSettings,
  TbDeviceFloppy,
  TbMenu2,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../../components/Meta";
import AdminConfigInput from "../../../components/admin/configuration/AdminConfigInput";
import AppearanceSettings from "../../../components/admin/configuration/AppearanceSettings";
import ConfigurationNavBar from "../../../components/admin/configuration/ConfigurationNavBar";
import LogoConfigInput from "../../../components/admin/configuration/LogoConfigInput";
import TestEmailButton from "../../../components/admin/configuration/TestEmailButton";
import CenterLoader from "../../../components/core/CenterLoader";
import useConfig from "../../../hooks/config.hook";
import useTranslate from "../../../hooks/useTranslate.hook";
import configService from "../../../services/config.service";
import { AdminConfig, UpdateConfig } from "../../../types/config.type";
import { camelToKebab } from "../../../utils/string.util";
import toast from "../../../utils/toast.util";

const configTextFallbacks: Record<
  string,
  { title: string; description: string }
> = {
  "email.loginVerification": {
    title: "Email a sign-in code",
    description:
      "After a correct password, email the user a six digit code that they have to enter to finish signing in. People using an authenticator app are asked for that code instead, and anyone signing in through an OAuth provider skips this step, because the provider has already verified them. It is also skipped when SMTP is off or the account has no real email address, so turning this on cannot lock anyone out.",
  },
  "donations.serverCostPerMonthUsd": {
    title: "Server cost per month (USD)",
    description:
      "Your fixed monthly hosting bill. It is added to the calculated storage cost to produce the running total shown in the donation panel, converted into each visitor's own currency. Set it to 0 to show storage costs on their own.",
  },
  "s3.publicUrl": {
    title: "Public CDN URL",
    description:
      "Optional address for serving files through a CDN, for example https://files.example.com. When it is set, download links point at the CDN instead of a signed storage URL. Inline previews deliberately keep using signed URLs, so video and audio still play if the CDN is unhealthy. Leave this blank to serve everything from signed storage URLs.",
  },
  "legal.termsOfServiceEnabled": {
    title: "Show Terms of Service",
    description:
      "Whether to show the Terms of Service section on the legal page.",
  },
  "legal.privacyPolicyEnabled": {
    title: "Show Privacy Policy",
    description:
      "Whether to show the Privacy Policy section on the legal page and privacy link.",
  },
  "legal.dmcaEnabled": {
    title: "Show DMCA section",
    description:
      "Whether to show the DMCA & takedowns section on the legal page.",
  },
  "legal.contactEnabled": {
    title: "Show contact section",
    description:
      "Whether to show the Contact & Reporting section on the legal page.",
  },
  "legal.supportEmail": {
    title: "Support email",
    description:
      "Where the Support card on the legal page sends people. Leave blank to hide that card; if both contact addresses are blank the Contact & Reporting tab is hidden entirely.",
  },
  "legal.abuseEmail": {
    title: "Abuse / takedown email",
    description:
      "Where abuse reports, DMCA notices and takedown requests should go. Leave blank to hide the Report card.",
  },
  "legal.imprintEnabled": {
    title: "Show imprint",
    description:
      "Whether to show the imprint section on the legal page and imprint link.",
  },
  "share.virusScanEnabled": {
    title: "Virus scanning",
    description:
      "Scan uploads with ClamAV. Turn this off if no ClamAV service is reachable, otherwise every upload queues a scan that can never complete. Requires VIRUS_SCAN_AUTO_START=true in the environment as well.",
  },
  "general.requestLogRetentionDays": {
    title: "Request log retention (days)",
    description:
      "How long request logs are kept before the nightly prune removes them. Request logs are the largest table in most installs, so lower this if the database file is growing faster than you want. Minimum 1.",
  },
  "donations.enabled": {
    title: "Enable group donations",
    description:
      "Shows a subtle donation prompt on group shares pages when at least one wallet is configured.",
  },
  "donations.provider": {
    title: "Donation provider",
    description:
      "Use btcpay for unique invoice addresses and automatic confirmation. Manual is kept as a fallback for static wallet donations.",
  },
  "donations.storageCostPerGibMonthUsd": {
    title: "Storage cost per GB-month",
    description:
      "Used to estimate each group's monthly storage cost. Exoscale object storage is currently around 0.0198 USD per GB-month.",
  },
  "donations.btcAddress": {
    title: "BTC wallet address",
    description: "Wallet address shown when a group member chooses BTC.",
  },
  "donations.externalUrl": {
    title: "External donate link",
    description:
      "An http(s) link to PayPal, Ko-fi or similar. Set this to keep donations on with BTCPay off: the donation note and this button still show, and no invoice is created. Leave empty to hide the button.",
  },
  "donations.externalLabel": {
    title: "External donate button label",
    description: "Text on the external donate button, for example 'Donate via PayPal'.",
  },
  "donations.btcpayServerUrl": {
    title: "BTCPay server URL",
    description:
      "Self-hosted BTCPay Server URL, for example https://pay.example.org.",
  },
  "donations.btcpayStoreId": {
    title: "BTCPay store ID",
    description: "Optional BTCPay store ID for a later automated invoice flow.",
  },
  "donations.btcpayApiKey": {
    title: "BTCPay API key",
    description: "Optional BTCPay API key. Keep this secret.",
  },
  "donations.btcpayWebhookSecret": {
    title: "BTCPay webhook secret",
    description:
      "Secret used to verify BTCPay webhook signatures before automatically confirming donations.",
  },
  "donations.btcpayInvoiceExpirationMinutes": {
    title: "BTCPay invoice expiration",
    description:
      "How long a generated BTCPay invoice should stay payable, in minutes.",
  },
  "donations.note": {
    title: "Donation note",
    description: "Short message shown inside the donation modal.",
  },
  "share.bulkUploadMode": {
    title: "Bulk upload location",
    description:
      "Bulk upload creates a separate share - and a separate link - for each file dropped, then downloads a text file listing them all. \"Separate Bulk Upload page\" adds a Bulk Upload link to the header that opens a dedicated page. \"Standard / Bulk switch in the upload dialog\" hides that link and instead puts a Standard/Bulk toggle at the top of the normal upload dialog, so people choose per upload. Either way the feature does the same thing; this only changes where people reach it.",
  },
  "share.allowUninvitedRegisteredShares": {
    title: "Allow limited registered shares",
    description:
      "Allow signed-in users without a redeemed invite code to create shares with restricted limits.",
  },
  "share.maxUninvitedRegisteredExpiration": {
    title: "Limited registered max expiration",
    description:
      "Maximum share lifetime for registered users who have not redeemed an invite code.",
  },
  "share.maxAnonymousExpiration": {
    title: "Guest max expiration",
    description: "Maximum share lifetime for uploads created while signed out.",
  },
  "share.maxUninvitedRegisteredSize": {
    title: "Limited registered max share size",
    description:
      "Maximum total file size for shares created by registered users without a redeemed invite code.",
  },
};

const SUPERSEDED_BY_EMAIL_CENTER = new Set([
  "email.shareRecipientsSubject",
  "email.shareRecipientsMessage",
  "email.reverseShareSubject",
  "email.reverseShareMessage",
  "email.resetPasswordSubject",
  "email.resetPasswordMessage",
  "email.inviteSubject",
  "email.inviteMessage",
]);

const isAppearanceKey = (key: string) => key.startsWith("general.theme");

const useStyles = createStyles((theme) => ({
  page: {
    minHeight: "calc(100vh - 140px)",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "240px minmax(0, 1fr)",
    gap: 0,
    alignItems: "start",
    overflow: "hidden",
    borderRadius: 20,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.12 : 0.16})`,
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.82) 0%, rgba(var(--ls-panel-bg-rgb), 0.72) 100%)"
        : "rgba(255, 255, 255, 0.78)",
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 18px 52px rgba(0, 0, 0, 0.24), 0 0 32px rgba(var(--ls-accent-rgb), 0.05)"
        : "0 16px 48px rgba(0, 0, 0, 0.08)",

    [theme.fn.smallerThan("md")]: {
      gridTemplateColumns: "1fr",
      gap: theme.spacing.md,
      background: "transparent",
      border: "none",
      boxShadow: "none",
      overflow: "visible",
    },
  },

  navColumn: {
    minHeight: "100%",
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.96) 0%, rgba(var(--ls-panel-bg-rgb), 0.92) 100%)"
        : "rgba(248, 249, 250, 0.98)",

    [theme.fn.smallerThan("md")]: {
      display: "none",
    },
  },

  mobileNavButton: {
    display: "none",
    marginBottom: theme.spacing.md,
    borderRadius: 14,
    background:
      `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.08})`,
    color: theme.colorScheme === "dark" ? theme.white : "var(--ls-accent-deep)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.18)",

    [theme.fn.smallerThan("md")]: {
      display: "inline-flex",
    },
  },

  contentColumn: {
    padding: theme.spacing.xl,
    minWidth: 0,

    [theme.fn.smallerThan("md")]: {
      padding: 0,
    },
  },

  contentWrapper: {
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.88) 0%, rgba(var(--ls-panel-bg-rgb), 0.8) 100%)"
        : "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    padding: theme.spacing.xl,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 18px 46px rgba(0, 0, 0, 0.24), 0 0 34px rgba(var(--ls-accent-rgb), 0.06)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
    width: "100%",
  },

  categoryHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottom: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
  },

  categoryIcon: {
    color: "var(--ls-accent)",
    filter: "drop-shadow(0 0 8px rgba(var(--ls-accent-rgb), 0.4))",
  },

  categoryTitle: {
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    fontWeight: 700,
  },

  configItem: {
    padding: "20px 0",
    borderBottom: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.05)"
    }`,

    "&:last-child": {
      borderBottom: "none",
    },
  },

  legalConfigItem: {
    padding: "24px 0",
    borderBottom: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.05)"
    }`,

    "&:last-child": {
      borderBottom: "none",
    },
  },

  configItemTitle: {
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    fontWeight: 600,
    marginBottom: 4,
  },

  configItemDescription: {
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[5]
        : theme.colors.gray[6],
    fontSize: 13,
    lineHeight: 1.5,
    whiteSpace: "pre-line",
  },

  inputWrapper: {
    "& input, & textarea, & select": {
      background:
        theme.colorScheme === "dark"
          ? "rgba(0, 0, 0, 0.2)"
          : "rgba(255, 255, 255, 0.6)",
      border: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.1)"
      }`,
      borderRadius: 10,
      transition: "all 0.25s ease",

      "&:focus": {
        borderColor: "rgba(var(--ls-accent-rgb), 0.5)",
        boxShadow: "0 0 20px rgba(var(--ls-accent-rgb), 0.1)",
      },
    },

    "& .mantine-Switch-track": {
      background:
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.1)",
      borderColor: "transparent",
    },

    "& .mantine-Switch-input:checked + .mantine-Switch-track": {
      background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
      borderColor: "transparent",
    },
  },

  legalInputWrapper: {
    marginTop: theme.spacing.md,
    width: "100%",

    "& textarea": {
      minHeight: 360,
    },
  },

  alert: {
    background:
      theme.colorScheme === "dark"
        ? "rgba(59, 130, 246, 0.1)"
        : "rgba(59, 130, 246, 0.08)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: 12,

    "& .mantine-Alert-title": {
      color: "#3b82f6",
    },
  },

  buttonGroup: {
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    borderTop: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
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

  testButton: {
    background:
      theme.colorScheme === "dark"
        ? "rgba(59, 130, 246, 0.15)"
        : "rgba(59, 130, 246, 0.1)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    color: "#3b82f6",
    borderRadius: 10,
    fontWeight: 600,
    transition: "all 0.25s ease",

    "&:hover": {
      background: "rgba(59, 130, 246, 0.25)",
      borderColor: "rgba(59, 130, 246, 0.5)",
    },
  },
}));

export default function AppShellDemo() {
  const { classes } = useStyles();
  const router = useRouter();
  const t = useTranslate();

  const [isMobileNavBarOpened, setIsMobileNavBarOpened] = useState(false);
  const isMobile = useMediaQuery("(max-width: 992px)");
  const config = useConfig();

  const categoryId = (router.query.category as string | undefined) ?? "general";
  const isLegalCategory = categoryId === "legal";

  const [configVariables, setConfigVariables] = useState<AdminConfig[]>();
  const [updatedConfigVariables, setUpdatedConfigVariables] = useState<
    UpdateConfig[]
  >([]);

  const [logo, setLogo] = useState<File | null>(null);

  const isEditingAllowed = (): boolean => {
    return !configVariables || configVariables[0].allowEdit;
  };

  const saveConfigVariables = async () => {
    if (logo) {
      configService
        .changeLogo(logo)
        .then(() => {
          setLogo(null);
          toast.success(t("admin.config.notify.logo-success"));
        })
        .catch(toast.axiosError);
    }

    if (updatedConfigVariables.length > 0) {
      await configService
        .updateMany(updatedConfigVariables)
        .then(() => {
          setUpdatedConfigVariables([]);
          toast.success(t("admin.config.notify.success"));
        })
        .catch(toast.axiosError);
      void config.refresh();
    } else {
      toast.success(t("admin.config.notify.no-changes"));
    }
  };

  const updateConfigVariable = (configVariable: UpdateConfig) => {
    if (
      configVariable.key === "general.appUrl" &&
      typeof configVariable.value === "string"
    ) {
      configVariable.value = sanitizeUrl(configVariable.value);
    }

    setUpdatedConfigVariables((current) => [
      ...current.filter((item) => item.key !== configVariable.key),
      {
        ...current.find((item) => item.key === configVariable.key),
        ...configVariable,
      },
    ]);
  };

  const sanitizeUrl = (url: string): string => {
    return url.endsWith("/") ? url.slice(0, -1) : url;
  };

  useEffect(() => {
    configService.getByCategory(categoryId).then((configVariables) => {
      setConfigVariables(configVariables);
    });
  }, [categoryId]);

  return (
    <>
      <Meta title={t("admin.config.title")} />
      <Box className={classes.page}>
        <Container fluid py="xl" px="xl">
          <Button
            className={classes.mobileNavButton}
            leftIcon={<TbMenu2 size={18} />}
            onClick={() => setIsMobileNavBarOpened(true)}
          >
            Configuration: {t("admin.config.category." + categoryId)}
          </Button>
          <Drawer
            opened={isMobileNavBarOpened}
            onClose={() => setIsMobileNavBarOpened(false)}
            title="Configuration"
            padding="md"
            size="min(86vw, 320px)"
            withinPortal
          >
            <ConfigurationNavBar
              categoryId={categoryId}
              isMobileNavBarOpened={isMobileNavBarOpened}
              setIsMobileNavBarOpened={setIsMobileNavBarOpened}
            />
          </Drawer>
          <Box className={classes.layout}>
            <Box className={classes.navColumn}>
              <ConfigurationNavBar
                categoryId={categoryId}
                isMobileNavBarOpened={isMobileNavBarOpened}
                setIsMobileNavBarOpened={setIsMobileNavBarOpened}
              />
            </Box>
            <Box className={classes.contentColumn}>
              {!configVariables ? (
                <CenterLoader />
              ) : (
                <Box className={classes.contentWrapper}>
                  <Stack spacing={0}>
                    {!isEditingAllowed() && (
                      <Alert
                        mb="xl"
                        variant="light"
                        color="blue"
                        title={t("admin.config.config-file-warning.title")}
                        icon={<TbInfoCircle />}
                        className={classes.alert}
                      >
                        <FormattedMessage id="admin.config.config-file-warning.description" />
                      </Alert>
                    )}

                    <div className={classes.categoryHeader}>
                      <TbSettings size={28} className={classes.categoryIcon} />
                      <Title order={3} className={classes.categoryTitle}>
                        {t("admin.config.category." + categoryId)}
                      </Title>
                    </div>

                    {configVariables
                      .filter(
                        (c) =>
                          !SUPERSEDED_BY_EMAIL_CENTER.has(c.key) &&
                          !isAppearanceKey(c.key),
                      )
                      .map((configVariable) =>
                      isLegalCategory ? (
                        <Box
                          key={configVariable.key}
                          className={classes.legalConfigItem}
                        >
                          <Title order={6} className={classes.configItemTitle}>
                            <FormattedMessage
                              id={`admin.config.${camelToKebab(configVariable.key)}`}
                              defaultMessage={
                                configTextFallbacks[configVariable.key]?.title
                              }
                            />
                          </Title>
                          <Text className={classes.configItemDescription}>
                            <FormattedMessage
                              id={`admin.config.${camelToKebab(configVariable.key)}.description`}
                              defaultMessage={
                                configTextFallbacks[configVariable.key]
                                  ?.description
                              }
                              values={{ br: <br /> }}
                            />
                          </Text>
                          <Box
                            className={`${classes.inputWrapper} ${classes.legalInputWrapper}`}
                          >
                            <AdminConfigInput
                              key={configVariable.key}
                              configVariable={configVariable}
                              updateConfigVariable={updateConfigVariable}
                            />
                          </Box>
                        </Box>
                      ) : (
                        <Group
                          key={configVariable.key}
                          position="apart"
                          align="flex-start"
                          className={classes.configItem}
                          noWrap={!isMobile}
                        >
                          <Stack
                            style={{
                              maxWidth: isMobile ? "100%" : "40%",
                              flex: "0 0 auto",
                            }}
                            spacing={0}
                          >
                            <Title
                              order={6}
                              className={classes.configItemTitle}
                            >
                              <FormattedMessage
                                id={`admin.config.${camelToKebab(configVariable.key)}`}
                                defaultMessage={
                                  configTextFallbacks[configVariable.key]?.title
                                }
                              />
                            </Title>
                            <Text className={classes.configItemDescription}>
                              <FormattedMessage
                                id={`admin.config.${camelToKebab(configVariable.key)}.description`}
                                defaultMessage={
                                  configTextFallbacks[configVariable.key]
                                    ?.description
                                }
                                values={{ br: <br /> }}
                              />
                            </Text>
                          </Stack>
                          <Box
                            style={{ width: isMobile ? "100%" : "50%" }}
                            className={classes.inputWrapper}
                          >
                            <AdminConfigInput
                              key={configVariable.key}
                              configVariable={configVariable}
                              updateConfigVariable={updateConfigVariable}
                            />
                          </Box>
                        </Group>
                      ),
                    )}

                    {categoryId == "general" && (
                      <>
                        <Box className={classes.inputWrapper} mt="md">
                          <LogoConfigInput logo={logo} setLogo={setLogo} />
                        </Box>
                        <AppearanceSettings
                          configVariables={configVariables}
                          updateConfigVariable={updateConfigVariable}
                        />
                      </>
                    )}
                  </Stack>

                  <Group className={classes.buttonGroup} position="right">
                    {categoryId == "smtp" && (
                      <TestEmailButton
                        configVariablesChanged={
                          updatedConfigVariables.length != 0
                        }
                        saveConfigVariables={saveConfigVariables}
                      />
                    )}
                    <Button
                      onClick={saveConfigVariables}
                      className={classes.saveButton}
                      leftIcon={<TbDeviceFloppy size={18} />}
                    >
                      <FormattedMessage id="common.button.save" />
                    </Button>
                  </Group>
                </Box>
              )}
            </Box>
          </Box>
        </Container>
      </Box>
    </>
  );
}
