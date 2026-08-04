import {
  Anchor,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Tabs,
  Text,
  Title,
  createStyles,
  useMantineTheme,
} from "@mantine/core";
import Link from "next/link";
import Markdown from "markdown-to-jsx";
import {
  TbAlertCircle,
  TbExternalLink,
  TbHeadset,
  TbMail,
  TbScale,
  TbShield,
} from "react-icons/tb";
import Meta from "../components/Meta";
import useConfig from "../hooks/config.hook";

const useStyles = createStyles((theme) => ({
  container: {
    maxWidth: 960,
    margin: "0 auto",
    padding: theme.spacing.xl,
  },
  card: {
    background:
      theme.colorScheme === "dark"
        ? "rgba(30, 40, 38, 0.8)"
        : "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    padding: 40,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 8px 32px rgba(0, 0, 0, 0.3)"
        : "0 8px 32px rgba(0, 0, 0, 0.1)",
  },
  tab: {
    fontWeight: 500,
    padding: "12px 20px",
    "&[data-active]": {
      borderColor: "var(--ls-accent)",
      color: "var(--ls-accent)",
    },
  },
  lastUpdated: {
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[5]
        : theme.colors.gray[6],
    fontSize: 14,
    marginBottom: theme.spacing.xl,
  },
  markdown: {
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[3]
        : theme.colors.gray[7],
    lineHeight: 1.75,

    "& h2": {
      color: "rgb(var(--ls-panel-border-rgb))",
      marginTop: theme.spacing.xl,
      marginBottom: theme.spacing.sm,
    },

    "& h3": {
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xs,
    },

    "& p, & li": {
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[3]
          : theme.colors.gray[7],
    },

    "& ul, & ol": {
      paddingLeft: theme.spacing.xl,
    },

    "& li": {
      marginBottom: theme.spacing.xs,
    },

    "& pre": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? "rgba(50, 50, 50, 0.5)"
          : "rgba(220, 220, 220, 0.5)",
      padding: "0.75em",
      whiteSpace: "pre-wrap",
      borderRadius: 10,
    },
  },
  introText: {
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[4]
        : theme.colors.gray[6],
    maxWidth: 760,
    lineHeight: 1.7,
    marginBottom: theme.spacing.xl,
  },
  contactWrap: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.xl,
  },
  contactCard: {
    background:
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.025)"
        : "rgba(255, 255, 255, 0.72)",
    borderRadius: 18,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
    overflow: "hidden",
  },
  supportCard: {
    borderColor:
      `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.18 : 0.22})`,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 10px 30px rgba(0, 0, 0, 0.22), 0 0 30px rgba(var(--ls-accent-rgb), 0.04)"
        : "0 10px 30px rgba(0, 0, 0, 0.06)",
  },
  abuseCard: {
    borderColor:
      theme.colorScheme === "dark"
        ? "rgba(251, 191, 36, 0.2)"
        : "rgba(180, 83, 9, 0.24)",
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 10px 30px rgba(0, 0, 0, 0.22), 0 0 30px rgba(251, 191, 36, 0.04)"
        : "0 10px 30px rgba(0, 0, 0, 0.06)",
  },
  cardHeader: {
    padding: "24px 24px 18px",
    borderBottom: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(0, 0, 0, 0.07)"
    }`,
  },
  supportHeader: {
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(180deg, rgba(var(--ls-accent-rgb), 0.10) 0%, rgba(var(--ls-accent-rgb), 0.02) 100%)"
        : "linear-gradient(180deg, rgba(var(--ls-panel-border-rgb), 0.10) 0%, rgba(var(--ls-panel-border-rgb), 0.03) 100%)",
  },
  abuseHeader: {
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(180deg, rgba(251, 191, 36, 0.12) 0%, rgba(251, 191, 36, 0.03) 100%)"
        : "linear-gradient(180deg, rgba(180, 83, 9, 0.12) 0%, rgba(180, 83, 9, 0.03) 100%)",
  },
  cardBody: {
    padding: 24,
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    marginBottom: 18,
  },
  miniBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
  },
  supportBadge: {
    background:
      "rgba(var(--ls-panel-border-rgb), 0.10)",
    color: theme.colorScheme === "dark" ? "#8dffb9" : "var(--ls-accent-deep)",
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.16 : 0.18})`,
  },
  abuseBadge: {
    background:
      theme.colorScheme === "dark"
        ? "rgba(251, 191, 36, 0.10)"
        : "rgba(180, 83, 9, 0.10)",
    color: theme.colorScheme === "dark" ? "#ffd978" : "#9a4d00",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(251, 191, 36, 0.18)"
        : "rgba(180, 83, 9, 0.18)"
    }`,
  },
  criteriaTitle: {
    marginTop: 4,
    marginBottom: 12,
    fontWeight: 700,
  },
  criteriaList: {
    margin: 0,
    paddingLeft: 20,
    display: "grid",
    gap: 12,
    lineHeight: 1.75,
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[3]
        : theme.colors.gray[7],
  },
  criteriaSubList: {
    marginTop: 10,
    paddingLeft: 20,
    display: "grid",
    gap: 8,
  },
  criteriaCode: {
    display: "inline-block",
    marginTop: 8,
    padding: "12px 14px",
    borderRadius: 12,
    background:
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.04)"
        : "rgba(0, 0, 0, 0.04)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.08)"
    }`,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 14,
    wordBreak: "break-all",
  },
  disabledCard: {
    textAlign: "center",
  },
}));

const LegalMarkdown = ({ content }: { content: string }) => {
  const theme = useMantineTheme();

  return (
    <Markdown
      options={{
        forceBlock: true,
        overrides: {
          a: {
            props: {
              target: "_blank",
              rel: "noopener noreferrer",
            },
            component: Anchor,
          },
          pre: {
            props: {
              style: {
                backgroundColor:
                  theme.colorScheme === "dark"
                    ? "rgba(50, 50, 50, 0.5)"
                    : "rgba(220, 220, 220, 0.5)",
                padding: "0.75em",
                whiteSpace: "pre-wrap",
              },
            },
          },
        },
      }}
    >
      {content}
    </Markdown>
  );
};

const LegalPage = () => {
  const { classes } = useStyles();
  const config = useConfig();
  const theme = useMantineTheme();

  const legalEnabled = config.get("legal.enabled");
  const termsText = config.get("legal.termsOfServiceText");
  const privacyText = config.get("legal.privacyPolicyText");
  const dmcaText = config.get("legal.dmcaText");
  const imprintText = config.get("legal.imprintText");
  const imprintUrl = config.get("legal.imprintUrl");
  const appName = config.get("general.appName") || "This site";
  const appUrl =
    config.get("general.appUrl") || "https://your-domain.com";
  const supportEmail = (config.get("legal.supportEmail") || "").trim();
  const abuseEmail = (config.get("legal.abuseEmail") || "").trim();
  const hasContactDetails = Boolean(supportEmail || abuseEmail);
  const visibleTabs = [
    config.get("legal.termsOfServiceEnabled") ? "terms" : null,
    config.get("legal.privacyPolicyEnabled") ? "privacy" : null,
    config.get("legal.dmcaEnabled") ? "dmca" : null,
    config.get("legal.contactEnabled") && hasContactDetails ? "contact" : null,
    config.get("legal.imprintEnabled") && (imprintText || imprintUrl)
      ? "imprint"
      : null,
  ].filter(Boolean) as string[];
  const defaultTab = visibleTabs[0] ?? "terms";

  return (
    <>
      <Meta
        title="Legal"
        description="Terms of Service, Privacy Policy, DMCA, and legal information"
      />

      <Container className={classes.container}>
        <Box
          className={`${classes.card} ${
            !legalEnabled || visibleTabs.length === 0
              ? classes.disabledCard
              : ""
          }`}
        >
          {!legalEnabled || visibleTabs.length === 0 ? (
            <>
              <Title order={1} mb="sm">
                Legal notices are disabled
              </Title>
              <Text color="dimmed" mb="xl">
                This {appName} instance currently has no public legal sections
                enabled.
              </Text>
              <Button component={Link} href="/" variant="light">
                Go back home
              </Button>
            </>
          ) : (
            <>
              <Title order={1} mb="sm">
                Help Center
              </Title>
              <Tabs defaultValue={defaultTab} variant="outline">
                <Tabs.List mb="xl">
                  {config.get("legal.termsOfServiceEnabled") && (
                    <Tabs.Tab
                      value="terms"
                      icon={<TbScale size={18} />}
                      className={classes.tab}
                    >
                      Terms of Service
                    </Tabs.Tab>
                  )}
                  {config.get("legal.privacyPolicyEnabled") && (
                    <Tabs.Tab
                      value="privacy"
                      icon={<TbShield size={18} />}
                      className={classes.tab}
                    >
                      Privacy Policy
                    </Tabs.Tab>
                  )}
                  {config.get("legal.dmcaEnabled") && (
                    <Tabs.Tab
                      value="dmca"
                      icon={<TbAlertCircle size={18} />}
                      className={classes.tab}
                    >
                      DMCA & Takedowns
                    </Tabs.Tab>
                  )}
                  {config.get("legal.contactEnabled") && hasContactDetails && (
                    <Tabs.Tab
                      value="contact"
                      icon={<TbHeadset size={18} />}
                      className={classes.tab}
                    >
                      Contact & Reporting
                    </Tabs.Tab>
                  )}
                  {config.get("legal.imprintEnabled") &&
                    (imprintText || imprintUrl) && (
                      <Tabs.Tab
                        value="imprint"
                        icon={<TbExternalLink size={18} />}
                        className={classes.tab}
                      >
                        Imprint
                      </Tabs.Tab>
                    )}
                </Tabs.List>

                {config.get("legal.termsOfServiceEnabled") && (
                  <Tabs.Panel value="terms" className={classes.markdown}>
                    <LegalMarkdown content={termsText} />
                  </Tabs.Panel>
                )}

                {config.get("legal.privacyPolicyEnabled") && (
                  <Tabs.Panel value="privacy" className={classes.markdown}>
                    <LegalMarkdown content={privacyText} />
                  </Tabs.Panel>
                )}

                {config.get("legal.dmcaEnabled") && (
                  <Tabs.Panel value="dmca" className={classes.markdown}>
                    <LegalMarkdown content={dmcaText} />
                  </Tabs.Panel>
                )}

                {config.get("legal.contactEnabled") && hasContactDetails && (
                  <Tabs.Panel value="contact">
                    <Box className={classes.contactWrap}>
                      <Grid gutter="xl">
                        {supportEmail && (
                        <Grid.Col md={6}>
                          <Box
                            className={`${classes.contactCard} ${classes.supportCard}`}
                          >
                            <Box
                              className={`${classes.cardHeader} ${classes.supportHeader}`}
                            >
                              <Title order={3}>Support</Title>
                              <Text mt={8} color="dimmed">
                                For account help, upload/download issues,
                                bugs, and feature requests.
                              </Text>
                              <Box className={classes.badgeRow}>
                                <Box
                                  className={`${classes.miniBadge} ${classes.supportBadge}`}
                                >
                                  <TbMail size={15} />
                                  {supportEmail}
                                </Box>
                              </Box>
                              <Button
                                component="a"
                                href={`mailto:${supportEmail}?subject=${encodeURIComponent(`${appName} Support Request`)}`}
                                leftIcon={<TbMail size={16} />}
                                variant="light"
                              >
                                Email support
                              </Button>
                            </Box>
                            <Box className={classes.cardBody}>
                              <Text className={classes.criteriaTitle}>
                                What to include
                              </Text>
                              <Box
                                component="ul"
                                className={classes.criteriaList}
                              >
                                <li>
                                  Use a clear subject line that briefly
                                  describes the issue.
                                </li>
                                <li>
                                  Include the full {appName} link, share ID, or
                                  page URL involved.
                                </li>
                                <li>
                                  Explain what happened, what you expected, and
                                  when it happened.
                                </li>
                                <li>
                                  Include screenshots, browser/device details,
                                  and any error text if relevant.
                                </li>
                                <li>
                                  For account issues, include the email address
                                  tied to your account.
                                </li>
                              </Box>
                            </Box>
                          </Box>
                        </Grid.Col>
                        )}

                        {abuseEmail && (
                        <Grid.Col md={6}>
                          <Box
                            className={`${classes.contactCard} ${classes.abuseCard}`}
                          >
                            <Box
                              className={`${classes.cardHeader} ${classes.abuseHeader}`}
                            >
                              <Title order={3}>Abuse & Takedowns</Title>
                              <Text mt={8} color="dimmed">
                                For content reports, takedown requests, legal
                                notices, impersonation, malware, or other policy
                                violations.
                              </Text>
                              <Box className={classes.badgeRow}>
                                <Box
                                  className={`${classes.miniBadge} ${classes.abuseBadge}`}
                                >
                                  <TbMail size={15} />
                                  {abuseEmail}
                                </Box>
                              </Box>
                              <Button
                                component="a"
                                href={`mailto:${abuseEmail}?subject=${encodeURIComponent(`${appName} Abuse Report`)}`}
                                leftIcon={<TbMail size={16} />}
                                variant="light"
                                color="yellow"
                              >
                                Report content
                              </Button>
                            </Box>
                            <Box className={classes.cardBody}>
                              <Text className={classes.criteriaTitle}>
                                Required report criteria
                              </Text>
                              <Box
                                component="ul"
                                className={classes.criteriaList}
                              >
                                <li>
                                  Use a subject line that explains the type of
                                  report and who it is from.
                                </li>
                                <li>
                                  Identify yourself and explain your
                                  relationship to the content.
                                </li>
                                <li>
                                  Explain why the content violates policy or
                                  law, and include the relevant category or
                                  basis for the report.
                                </li>
                                <li>
                                  Provide enough information to show you have
                                  the right to request review or removal when
                                  applicable.
                                </li>
                                <li>
                                  Include full, direct {appName} links in a
                                  clear and non-obfuscated form.
                                  <Box
                                    component="ul"
                                    className={classes.criteriaSubList}
                                  >
                                    <li>
                                      Share links:
                                      <Box className={classes.criteriaCode}>
                                        {appUrl}/share/SHARE_ID
                                      </Box>
                                    </li>
                                    <li>
                                      Short links:
                                      <Box className={classes.criteriaCode}>
                                        {appUrl}/s/SHARE_ID
                                      </Box>
                                    </li>
                                  </Box>
                                </li>
                              </Box>
                            </Box>
                          </Box>
                        </Grid.Col>
                        )}
                      </Grid>

                      <Divider
                        my="sm"
                        color={
                          theme.colorScheme === "dark" ? "dark.4" : "gray.3"
                        }
                      />

                      <Text color="dimmed" size="sm">
                        Reports missing the required details may be delayed
                        because the {appName} team may not have enough
                        information to verify or investigate the request.
                      </Text>
                    </Box>
                  </Tabs.Panel>
                )}

                {config.get("legal.imprintEnabled") &&
                  (imprintText || imprintUrl) && (
                    <Tabs.Panel value="imprint" className={classes.markdown}>
                      {imprintText ? (
                        <LegalMarkdown content={imprintText} />
                      ) : (
                        <Button
                          component="a"
                          href={imprintUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          leftIcon={<TbExternalLink size={16} />}
                          variant="light"
                        >
                          Open imprint page
                        </Button>
                      )}
                    </Tabs.Panel>
                  )}
              </Tabs>
            </>
          )}
        </Box>
      </Container>
    </>
  );
};

export default LegalPage;
