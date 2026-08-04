import { Box, Text, createStyles } from "@mantine/core";
import useConfig from "../../hooks/config.hook";
import { splitWordmark } from "../../theme/theme.util";
import { logoVersion, versionedAsset } from "../../utils/logo-asset.util";

const useStyles = createStyles((_theme, { logoUrl }: { logoUrl: string }) => ({
  lockup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginBottom: 18,
  },
  logoImage: {
    width: 46,
    height: 46,
    objectFit: "contain",
    flexShrink: 0,
  },
  logoMask: {
    width: 46,
    height: 46,
    flexShrink: 0,
    backgroundColor: "var(--ls-accent)",
    boxShadow: "0 0 18px rgba(var(--ls-accent-rgb), 0.18)",
    WebkitMaskImage: `url('${logoUrl}')`,
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    WebkitMaskSize: "contain",
    maskImage: `url('${logoUrl}')`,
    maskRepeat: "no-repeat",
    maskPosition: "center",
    maskSize: "contain",
  },
  word: {
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: -0.5,
    color: "var(--ls-logo-text)",
    whiteSpace: "nowrap",
  },
  accent: {
    color: "var(--ls-logo-accent)",
  },
}));

const AuthBrandLockup = () => {
  const config = useConfig();
  const logoUrl = versionedAsset(
    "/img/logo.png",
    logoVersion((key) => config.get(key as `${string}.${string}`)),
  );
  const { classes } = useStyles({ logoUrl });
  const appName = (config.get("general.appName") as string) || "This site";
  const logoIsOpaque = config.get("general.themeLogoIsOpaque") === true;
  const wordmark = splitWordmark(appName);

  return (
    <Box className={classes.lockup}>
      {logoIsOpaque ? (
        <Box
          component="img"
          src={logoUrl}
          alt={`${appName} logo`}
          className={classes.logoImage}
        />
      ) : (
        <Box
          className={classes.logoMask}
          role="img"
          aria-label={`${appName} logo`}
        />
      )}
      <Text className={classes.word}>
        {wordmark.head}
        {wordmark.tail && (
          <span className={classes.accent}>{wordmark.tail}</span>
        )}
      </Text>
    </Box>
  );
};

export default AuthBrandLockup;
