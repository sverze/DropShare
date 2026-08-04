import { Anchor, Box, SimpleGrid, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";

const Footer = () => {
  const t = useTranslate();
  const config = useConfig();
  const hasImprintContent = !!(
    config.get("legal.imprintUrl") || config.get("legal.imprintText")
  );
  const hasPrivacyContent = !!(
    config.get("legal.privacyPolicyUrl") ||
    config.get("legal.privacyPolicyText")
  );
  const hasImprint =
    config.get("legal.enabled") &&
    config.get("legal.imprintEnabled") &&
    hasImprintContent;
  const hasPrivacy =
    config.get("legal.enabled") &&
    config.get("legal.privacyPolicyEnabled") &&
    hasPrivacyContent;
  const imprintUrl =
    (!config.get("legal.imprintText") && config.get("legal.imprintUrl")) ||
    "/imprint";
  const privacyUrl =
    (!config.get("legal.privacyPolicyText") &&
      config.get("legal.privacyPolicyUrl")) ||
    "/privacy";

  const isMobile = useMediaQuery("(max-width: 700px)");

  return (
    <Box
      component="footer"
      py={isMobile ? 12 : 6}
      px="xl"
      sx={{
        border: "none",
        borderTop: "none",
        background: "transparent",
        width: "100%",
        marginTop: isMobile ? 20 : 8,
        paddingBottom: isMobile ? 18 : undefined,
      }}
    >
      <SimpleGrid cols={isMobile ? 1 : 3} m={0}>
        {!isMobile && <div></div>}
        <div>
          {(hasImprint || hasPrivacy) && (
            <Text
              size="xs"
              color="dimmed"
              align={isMobile ? "center" : "right"}
            >
              {hasImprint && (
                <Anchor size="xs" href={imprintUrl}>
                  {t("imprint.title")}
                </Anchor>
              )}
              {hasImprint && hasPrivacy && " • "}
              {hasPrivacy && (
                <Anchor size="xs" href={privacyUrl}>
                  {t("privacy.title")}
                </Anchor>
              )}
            </Text>
          )}
        </div>
      </SimpleGrid>
    </Box>
  );
};

export default Footer;
