import { Anchor, Button, Text, Title, useMantineTheme } from "@mantine/core";
import Link from "next/link";
import Meta from "../../components/Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import { FormattedMessage } from "react-intl";
import useConfig from "../../hooks/config.hook";
import Markdown from "markdown-to-jsx";

const Imprint = () => {
  const t = useTranslate();
  const { colorScheme } = useMantineTheme();
  const config = useConfig();
  const legalEnabled = config.get("legal.enabled");
  const imprintEnabled = config.get("legal.imprintEnabled");
  const imprintText = config.get("legal.imprintText");
  const imprintUrl = config.get("legal.imprintUrl");

  return (
    <>
      <Meta title={t("imprint.title")} />
      <Title mb={30} order={1}>
        <FormattedMessage id="imprint.title" />
      </Title>
      {!legalEnabled || !imprintEnabled ? (
        <>
          <Text color="dimmed" mb="lg">
            Imprint pages are currently disabled for this instance.
          </Text>
          <Button component={Link} href="/" variant="light">
            Go back home
          </Button>
        </>
      ) : imprintText ? (
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
          {imprintText}
        </Markdown>
      ) : imprintUrl ? (
        <Button
          component="a"
          href={imprintUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="light"
        >
          Open imprint page
        </Button>
      ) : (
        <Text color="dimmed">No imprint has been configured yet.</Text>
      )}
    </>
  );
};

export default Imprint;
