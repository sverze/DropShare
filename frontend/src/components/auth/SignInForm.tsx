import {
  Anchor,
  Box,
  Button,
  Container,
  createStyles,
  Divider,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TbFingerprint, TbInfoCircle } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import * as yup from "yup";
import useConfig from "../../hooks/config.hook";
import useUser from "../../hooks/user.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import authService from "../../services/auth.service";
import passkeyService from "../../services/passkey.service";
import { getOAuthIcon, getOAuthUrl } from "../../utils/oauth.util";
import { AuthClient, AuthClientId, authClientQuery } from "../../utils/auth-client.util";
import { safeRedirectPath } from "../../utils/router.util";
import toast from "../../utils/toast.util";
import AuthBrandLockup from "./AuthBrandLockup";

const useStyles = createStyles((theme) => ({
  authPage: {
    minHeight: "100dvh",
    margin: 0,
    padding: "72px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at 20% 12%, rgba(var(--ls-accent-rgb), 0.28), transparent 34%), radial-gradient(circle at 78% 20%, rgba(var(--ls-accent-rgb), 0.14), transparent 32%), var(--ls-page-base)",
  },
  authCard: {
    width: "100%",
    maxWidth: 460,
  },
  brandPanel: {
    padding: 24,
    borderRadius: 28,
    border: "1px solid rgba(var(--ls-panel-border-rgb), 0.6)",
    background: `rgba(var(--ls-panel-bg-rgb), ${
      theme.colorScheme === "dark" ? 0.72 : 0.86
    })`,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 28px 90px rgba(0, 0, 0, 0.45), 0 0 70px rgba(var(--ls-accent-rgb), 0.14)"
        : "0 28px 80px rgba(15, 23, 42, 0.12), 0 0 60px rgba(var(--ls-accent-rgb), 0.10)",
    backdropFilter: "blur(22px)",
  },
  signInWith: {
    fontWeight: 500,
    "&:before": {
      content: "''",
      flex: 1,
      display: "block",
    },
    "&:after": {
      content: "''",
      flex: 1,
      display: "block",
    },
  },
  or: {
    "&:before": {
      content: "''",
      flex: 1,
      display: "block",
      borderTopWidth: 1,
      borderTopStyle: "solid",
      borderColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[3]
          : theme.colors.gray[4],
    },
    "&:after": {
      content: "''",
      flex: 1,
      display: "block",
      borderTopWidth: 1,
      borderTopStyle: "solid",
      borderColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[3]
          : theme.colors.gray[4],
    },
  },
  passkeyButton: {
    background:
      "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.18) 0%, rgba(var(--ls-accent-rgb), 0.10) 100%)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.32)",
    color: "var(--ls-accent)",
    fontWeight: 500,
    transition: "all 0.2s ease",

    "&:hover": {
      background:
        "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.28) 0%, rgba(var(--ls-accent-rgb), 0.16) 100%)",
      transform: "translateY(-1px)",
    },
  },
  purpleLink: {
    color: "var(--ls-accent)",
    fontWeight: 700,
    "&:hover": {
      opacity: 0.85,
    },
  },
  oauthButton: {
    background:
      "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.14), rgba(var(--ls-accent-rgb), 0.08))",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.22)",
    color: "var(--ls-text)",
    "&:hover": {
      background:
        "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.22), rgba(var(--ls-accent-rgb), 0.12))",
    },
  },
  authGradientButton: {
    border: 0,
    overflow: "hidden",
    backgroundImage:
      "linear-gradient(115deg, var(--ls-ring-outer) 0%, var(--ls-ring-inner) 22%, var(--ls-ring-center) 50%, var(--ls-ring-inner) 78%, var(--ls-ring-outer) 100%)",
    backgroundSize: "220% 220%",
    backgroundPosition: "0% 50%",
    color: "#fff",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
    fontWeight: 800,
    "@keyframes authRingShift": {
      "0%": { backgroundPosition: "0% 50%" },
      "50%": { backgroundPosition: "100% 50%" },
      "100%": { backgroundPosition: "0% 50%" },
    },
    animation: "authRingShift 8s ease-in-out infinite",
    "&:hover": {
      filter: "brightness(1.06)",
    },
  },
}));

const SignInForm = ({
  redirectPath,
  authClient,
}: {
  redirectPath: string;
  authClient: AuthClient;
}) => {
  const config = useConfig();
  const router = useRouter();
  const t = useTranslate();
  useUser();
  const { classes } = useStyles();

  const [oauthProviders, setOauthProviders] = useState<string[] | null>(null);
  const [isRedirectingToOauthProvider, setIsRedirectingToOauthProvider] =
    useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const validationSchema = yup.object().shape({
    emailOrUsername: yup.string().required(t("common.error.field-required")),
    password: yup.string().required(t("common.error.field-required")),
  });

  const form = useForm({
    initialValues: {
      emailOrUsername: "",
      password: "",
    },
    validate: yupResolver(validationSchema),
  });

  const handlePostSignInRedirect = async (targetPath: string) => {
    window.location.href = safeRedirectPath(targetPath);
  };

  const signIn = async (email: string, password: string) => {
    await authService
      .signIn(email.trim(), password.trim())
      .then(async (response) => {
        if (response.data["loginToken"]) {
          if (response.data["verificationMethod"] === "email") {
            showNotification({
              icon: <TbInfoCircle />,
              color: "blue",
              radius: "md",
              title: "Check your email",
              message: "We sent a 6-digit code to finish signing in.",
            });
            const hint = response.data["emailHint"]
              ? `&hint=${encodeURIComponent(response.data["emailHint"])}`
              : "";
            router.push(
              `/auth/email-code/${
                response.data["loginToken"]
              }?redirect=${encodeURIComponent(redirectPath)}${hint}`,
            );
          } else {
            showNotification({
              icon: <TbInfoCircle />,
              color: "blue",
              radius: "md",
              title: t("signIn.notify.totp-required.title"),
              message: t("signIn.notify.totp-required.description"),
            });
            router.push(
              `/auth/totp/${
                response.data["loginToken"]
              }?redirect=${encodeURIComponent(redirectPath)}`,
            );
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
          await handlePostSignInRedirect(redirectPath);
        }
      })
      .catch(toast.axiosError);
  };

  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true);
    try {
      const result = await passkeyService.authenticateWithPasskey(
        form.values.emailOrUsername || undefined
      );
      
      if (result.success) {
        sessionStorage.setItem("just_logged_in", "1");
        await new Promise(resolve => setTimeout(resolve, 500));
        await handlePostSignInRedirect(redirectPath);
      } else if (result.error && result.error !== "Authentication was cancelled") {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Passkey authentication failed");
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  useEffect(() => {
    passkeyService.isPlatformAuthenticatorAvailable().then(setPasskeySupported);

    authService
      .getAvailableOAuth()
      .then((providers) => {
        setOauthProviders(providers.data);
        if (
          providers.data.length === 1 &&
          config.get("oauth.disablePassword")
        ) {
          setIsRedirectingToOauthProvider(true);
          router.push(getOAuthUrl(window.location.origin, providers.data[0], undefined, authClient.id));
        }
      })
      .catch(toast.axiosError);
  }, []);

  if (!oauthProviders) return null;

  if (isRedirectingToOauthProvider)
    return (
      <Group align="center" position="center">
        <Loader size="sm" />
        <Text align="center">
          <FormattedMessage id="common.text.redirecting" />
        </Text>
      </Group>
    );

  return (
    <Box className={classes.authPage}>
      <Container
        size={460}
        className={classes.authCard}
        style={{ "--auth-client-accent": "var(--ls-accent)" } as any}
      >
        <Box className={classes.brandPanel}>
          <AuthBrandLockup />
          <Title order={2} align="center" weight={900} sx={{ letterSpacing: -0.6 }}>
            <FormattedMessage id="signin.title" />
          </Title>
      {config.get("share.allowRegistration") && (
        <Text color="dimmed" size="sm" align="center" mt={8}>
          <FormattedMessage id="signin.description" />{" "}
          <Anchor
            component={Link}
            href={`signUp?${authClientQuery(authClient.id as AuthClientId)}&redirect=${encodeURIComponent(redirectPath)}`}
            size="sm"
            className={classes.purpleLink}
          >
            <FormattedMessage id="signin.button.signup" />
          </Anchor>
        </Text>
      )}
      <Paper
        withBorder
        shadow="md"
        p={30}
        mt={30}
        radius="md"
        sx={(theme) => ({
          borderColor: "rgba(var(--ls-accent-rgb), 0.24)",
          boxShadow:
            theme.colorScheme === "dark"
              ? "0 18px 50px rgba(0, 0, 0, 0.28), 0 0 36px rgba(var(--ls-accent-rgb), 0.10)"
              : "0 18px 50px rgba(15, 23, 42, 0.08), 0 0 28px rgba(var(--ls-accent-rgb), 0.08)",
        })}
      >
        {passkeySupported && (
          <>
            <Button
              fullWidth
              leftIcon={<TbFingerprint size={20} />}
              className={classes.passkeyButton}
              onClick={handlePasskeyLogin}
              loading={isPasskeyLoading}
              mb="md"
            >
              Sign in with Passkey
            </Button>
            {!config.get("oauth.disablePassword") && (
              <Divider 
                label="or continue with password" 
                labelPosition="center" 
                my="md"
              />
            )}
          </>
        )}

        {config.get("oauth.disablePassword") || (
          <form
            onSubmit={form.onSubmit((values) => {
              signIn(values.emailOrUsername, values.password);
            })}
          >
            <TextInput
              label={t("signin.input.email-or-username")}
              placeholder={t("signin.input.email-or-username.placeholder")}
              {...form.getInputProps("emailOrUsername")}
            />
            <PasswordInput
              label={t("signin.input.password")}
              placeholder={t("signin.input.password.placeholder")}
              mt="md"
              {...form.getInputProps("password")}
            />
            {config.get("smtp.enabled") && (
              <Group position="right" mt="xs">
                <Anchor component={Link} href="/auth/resetPassword" size="xs" className={classes.purpleLink}>
                  <FormattedMessage id="resetPassword.title" />
                </Anchor>
              </Group>
            )}
            <Button fullWidth mt="xl" type="submit" className={classes.authGradientButton}>
              <FormattedMessage id="signin.button.submit" />
            </Button>
          </form>
        )}
        {oauthProviders.length > 0 && (
          <Stack mt={config.get("oauth.disablePassword") ? undefined : "xl"}>
            {config.get("oauth.disablePassword") ? (
              <Group align="center" className={classes.signInWith}>
                <Text>{t("signIn.oauth.signInWith")}</Text>
              </Group>
            ) : (
              <Group align="center" className={classes.or}>
                <Text>{t("signIn.oauth.or")}</Text>
              </Group>
            )}
            <Group position="center">
              {oauthProviders.map((provider) => (
                <Button
                  key={provider}
                  component="a"
                  title={t(`signIn.oauth.${provider}`)}
                  href={getOAuthUrl(window.location.origin, provider, undefined, authClient.id)}
                  variant="light"
                  fullWidth
                  className={classes.oauthButton}
                >
                  {getOAuthIcon(provider)}
                  {"\u2002" + t(`signIn.oauth.${provider}`)}
                </Button>
              ))}
            </Group>
          </Stack>
        )}
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default SignInForm;
