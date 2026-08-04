import { Anchor, Button, Text, Title, useMantineTheme } from "@mantine/core";
import Link from "next/link";
import Meta from "../../components/Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import { FormattedMessage } from "react-intl";
import useConfig from "../../hooks/config.hook";
import Markdown from "markdown-to-jsx";

const PrivacyPolicy = () => {
  const t = useTranslate();
  const { colorScheme } = useMantineTheme();
  const config = useConfig();
  const legalEnabled = config.get("legal.enabled");
  const privacyEnabled = config.get("legal.privacyPolicyEnabled");
  const privacyText = config.get("legal.privacyPolicyText");
  const privacyUrl = config.get("legal.privacyPolicyUrl");

  return (
    <>
      <Meta title={t("privacy.title")} />
      <Title mb={30} order={1}>
        <FormattedMessage id="privacy.title" />
      </Title>
      {!legalEnabled || !privacyEnabled ? (
        <>
          <Text color="dimmed" mb="lg">
            Privacy policy pages are currently disabled for this instance.
          </Text>
          <Button component={Link} href="/" variant="light">
            Go back home
          </Button>
        </>
      ) : privacyText ? (
        <Markdown
          options={{
            forceBlock: true,
            overrides: {
              pre: {
                props: {
                  style: {
                    backgroundColor:
                      colorScheme == "dark"
                        ? "rgba(50, 50, 50, 0.5)"
                        : "rgba(220, 220, 220, 0.5)",
                    padding: "0.75em",
                    whiteSpace: "pre-wrap",
                  },
                },
              },
              table: {
                props: {
                  className: "md",
                },
              },
              a: {
                props: {
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                component: Anchor,
              },
            },
          }}
        >
          {privacyText}
        </Markdown>
      ) : privacyUrl ? (
        <Button
          component="a"
          href={privacyUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="light"
        >
          Open privacy policy
        </Button>
      ) : (
        <Text color="dimmed">No privacy policy has been configured yet.</Text>
      )}
    </>
  );
};

export default PrivacyPolicy;
