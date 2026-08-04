import {
  Alert,
  Anchor,
  Box,
  Button,
  Container,
  createStyles,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TbInfoCircle } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import * as yup from "yup";
import useConfig from "../../hooks/config.hook";
import useUser from "../../hooks/user.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import authService from "../../services/auth.service";
import { safeRedirectPath } from "../../utils/router.util";
import passkeyService from "../../services/passkey.service";
import { getOAuthIcon, getOAuthUrl } from "../../utils/oauth.util";
import { AuthClient, AuthClientId, authClientQuery } from "../../utils/auth-client.util";
import toast from "../../utils/toast.util";
import PasskeySetupModal from "./PasskeySetupModal";
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
}));

const SignUpForm = ({ authClient }: { authClient: AuthClient }) => {
  const config = useConfig();
  const router = useRouter();
  const t = useTranslate();
  const { refreshUser } = useUser();
  const { classes } = useStyles();

  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<string[] | null>(null);
  const rawRedirect = router.query.redirect || router.query.returnUrl;
  const redirectPath =
    typeof rawRedirect === "string"
      ? rawRedirect
      : Array.isArray(rawRedirect) && rawRedirect[0]
        ? rawRedirect[0]
        : null;

  const finishAuth = () => {
    window.location.href = safeRedirectPath(
      redirectPath || "/account?setup2fa=true",
    );
  };

  const inviteFromUrl = router.query.invite;
  const inviteControlsInviteGate = (() => {
    try {
      return !!config.get("share.requireInviteCodeForRegistration");
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    authService
      .getAvailableOAuth()
      .then((providers) => {
        setOauthProviders(providers.data);
      })
      .catch(toast.axiosError);
  }, []);

  const validationSchema = yup.object().shape({
    email: yup
      .string()
      .email("Invalid email address")
      .required("Email is required"),
    username: yup
      .string()
      .min(3, "Username must be at least 3 characters")
      .required("Username is required"),
    password: yup
      .string()
      .min(8, "Password must be at least 8 characters")
      .required("Password is required"),
    inviteCode: yup.string().optional(),
  });

  const form = useForm({
    initialValues: {
      email: "",
      username: "",
      password: "",
      inviteCode: "",
    },
    validate: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (inviteFromUrl && typeof inviteFromUrl === "string") {
      form.setFieldValue("inviteCode", inviteFromUrl.toUpperCase());
    }
  }, [inviteFromUrl]);

  const signUp = async (
    email: string,
    username: string,
    password: string,
    submittedInviteCode?: string,
  ) => {
    await authService
      .signUp(
        email,
        username,
        password,
        submittedInviteCode?.trim().toUpperCase() || undefined,
        authClient.id,
      )
      .then(async () => {
        await refreshUser();

        const supported =
          await passkeyService.isPlatformAuthenticatorAvailable();
        if (supported) {
          setShowPasskeyPrompt(true);
        } else {
          finishAuth();
        }
      })
      .catch(toast.axiosError);
  };

  const handleOAuthSignUp = (provider: string) => {
    const inviteCode = form.values.inviteCode.trim().toUpperCase();

    window.location.href = getOAuthUrl(
      window.location.origin,
      provider,
      inviteCode || undefined,
      authClient.id,
    );
  };

  const handlePasskeySetupComplete = () => {
    setShowPasskeyPrompt(false);
    finishAuth();
  };

  const handlePasskeySetupSkip = () => {
    setShowPasskeyPrompt(false);
    finishAuth();
  };

  if (!oauthProviders) return null;

  return (
    <>
      <Box className={classes.authPage}>
        <Container
          size={460}
          className={classes.authCard}
          style={{ "--auth-client-accent": "var(--ls-accent)" } as any}
        >
          <Box className={classes.brandPanel}>
            <AuthBrandLockup />
            <Title order={2} align="center" weight={900} sx={{ letterSpacing: -0.6 }}>
              <FormattedMessage id="signup.title" />
            </Title>
        <Text color="dimmed" size="sm" align="center" mt={8}>
          Already have an account?{" "}
          <Anchor
            component={Link}
            href={`signIn?${authClientQuery(authClient.id as AuthClientId)}${redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : ""}`}
            size="sm"
            className={classes.purpleLink}
          >
            Sign in
          </Anchor>
        </Text>
        <Paper
          withBorder
          shadow="md"
          p={30}
          mt={30}
          radius="md"
          sx={() => ({
            borderColor: "rgba(var(--ls-accent-rgb), 0.24)",
            boxShadow:
              "0 18px 50px rgba(15, 23, 42, 0.10), 0 0 32px rgba(var(--ls-accent-rgb), 0.10)",
          })}
        >
          <form
            onSubmit={form.onSubmit((values) =>
              signUp(
                values.email,
                values.username,
                values.password,
                values.inviteCode,
              )
            )}
          >
            <TextInput
              label="Email"
              placeholder="you@example.com"
              {...form.getInputProps("email")}
            />
            <TextInput
              label="Username"
              placeholder="Choose a username"
              mt="md"
              {...form.getInputProps("username")}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              mt="md"
              {...form.getInputProps("password")}
            />

            <TextInput
              label="Invite Code (Optional)"
              placeholder="e.g., WELCOME10"
              mt="md"
              value={form.values.inviteCode}
              onChange={(e) => {
                const nextCode = e.currentTarget.value.toUpperCase();
                form.setFieldValue("inviteCode", nextCode);
              }}
              error={form.errors.inviteCode}
              styles={{
                input: {
                  textTransform: "uppercase",
                  letterSpacing: 1,
                },
              }}
            />

            <Button fullWidth mt="xl" type="submit" className={classes.authGradientButton}>
              Create Account
            </Button>
          </form>

          {inviteControlsInviteGate && (
            <Alert mt="lg" color="blue" variant="light" icon={<TbInfoCircle size={18} />}>
              Invite codes are optional for account creation, but you’ll need one before creating shares. You can enter it now or redeem one later from Upload or Profile.
            </Alert>
          )}

          {oauthProviders.length > 0 && (
            <Stack mt="xl">
              <Group align="center" className={classes.or}>
                <Text>{t("signIn.oauth.or")}</Text>
              </Group>
              <Group position="center">
                {oauthProviders.map((provider) => (
                  <Button
                    key={provider}
                    title={t(`signIn.oauth.${provider}`)}
                    onClick={() => handleOAuthSignUp(provider)}
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

      <PasskeySetupModal
        opened={showPasskeyPrompt}
        onClose={handlePasskeySetupSkip}
        onSuccess={handlePasskeySetupComplete}
      />
    </>
  );
};

export default SignUpForm;
