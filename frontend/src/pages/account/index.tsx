import {
  Alert,
  Avatar,
  Box,
  Button,
  Container,
  createStyles,
  FileButton,
  Group,
  Loader,
  NumberInput,
  PasswordInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { useModals } from "@mantine/modals";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  TbAuth2Fa,
  TbCamera,
  TbCloudUpload,
  TbFingerprint,
  TbLink,
  TbCheck,
  TbLock,
  TbPalette,
  TbSettings,
  TbShieldCheck,
  TbTicket,
  TbTrash,
  TbUser,
  TbWorld,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import * as yup from "yup";
import Meta from "../../components/Meta";
import LanguagePicker from "../../components/account/LanguagePicker";
import ThemeSwitcher from "../../components/account/ThemeSwitcher";
import showEnableTotpModal from "../../components/account/showEnableTotpModal";
import PasskeyManagement from "../../components/auth/PasskeyManagement";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import authService from "../../services/auth.service";
import userService from "../../services/user.service";
import { getOAuthIcon, getOAuthUrl, unlinkOAuth } from "../../utils/oauth.util";
import toast from "../../utils/toast.util";

const useStyles = createStyles((theme) => {
  const isDark = theme.colorScheme === "dark";
  const accent = "var(--ls-accent)";
  const accentRgb = "var(--ls-accent-rgb)";

  return {
    wrapper: {
      display: "flex",
      gap: 24,
      minHeight: "calc(100vh - 200px)",

      [theme.fn.smallerThan("md")]: {
        flexDirection: "column",
      },
    },

    sidebar: {
      width: 240,
      flexShrink: 0,

      [theme.fn.smallerThan("md")]: {
        width: "100%",
      },
    },

    sidebarCard: {
      background: isDark
        ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.9) 0%, rgba(var(--ls-panel-bg-rgb), 0.82) 100%)"
        : "rgba(255, 255, 255, 0.9)",
      backdropFilter: "blur(12px)",
      border: `1px solid rgba(${accentRgb}, 0.18)`,
      borderRadius: 16,
      padding: 8,
      position: "sticky",
      top: 100,
      boxShadow: isDark
        ? "0 18px 48px rgba(0, 0, 0, 0.24), 0 0 32px rgba(var(--ls-accent-rgb), 0.06)"
        : "0 10px 24px rgba(15, 23, 42, 0.06)",

      [theme.fn.smallerThan("md")]: {
        position: "static",
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
      },
    },

    navButton: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 16px",
      borderRadius: 10,
      transition: "all 0.2s ease",
      color: isDark ? "rgba(255,255,255,0.6)" : theme.colors.gray[6],
      fontSize: 14,
      fontWeight: 500,

      "&:hover": {
        background: `rgba(${accentRgb}, 0.08)`,
      },

      [theme.fn.smallerThan("md")]: {
        width: "auto",
        flex: "1 1 auto",
        justifyContent: "center",
        padding: "10px 14px",
      },
    },

    navButtonActive: {
      background: `rgba(${accentRgb}, 0.15)`,
      color: accent,
      fontWeight: 600,

      "&:hover": {
        background: `rgba(${accentRgb}, 0.2)`,
      },
    },

    navButtonDanger: {
      color: "#ef4444",
      marginTop: 8,
      borderTop: `1px solid rgba(${accentRgb}, 0.1)`,
      paddingTop: 16,

      "&:hover": {
        background: "rgba(239, 68, 68, 0.1)",
      },

      [theme.fn.smallerThan("md")]: {
        marginTop: 0,
        borderTop: "none",
        paddingTop: 10,
      },
    },

    content: {
      flex: 1,
      minWidth: 0,
    },

    card: {
      background: isDark
        ? "linear-gradient(180deg, rgba(var(--ls-panel-bg-rgb), 0.88) 0%, rgba(var(--ls-panel-bg-rgb), 0.8) 100%)"
        : "rgba(255, 255, 255, 0.9)",
      backdropFilter: "blur(12px)",
      border: `1px solid rgba(${accentRgb}, 0.18)`,
      borderRadius: 16,
      padding: 24,
      marginBottom: 20,
      boxShadow: isDark
        ? "0 18px 46px rgba(0, 0, 0, 0.24), 0 0 28px rgba(var(--ls-accent-rgb), 0.05)"
        : "0 10px 24px rgba(15, 23, 42, 0.05)",
    },

    cardTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: isDark ? "#fff" : theme.colors.dark[8],
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 10,
    },

    avatarWrapper: {
      position: "relative",
      width: 100,
      height: 100,
    },

    avatarOverlay: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0,
      transition: "opacity 0.2s ease",
      cursor: "pointer",

      "&:hover": {
        opacity: 1,
      },
    },

    profileHeader: {
      display: "flex",
      alignItems: "center",
      gap: 20,
      marginBottom: 24,
      paddingBottom: 24,
      borderBottom: `1px solid rgba(${accentRgb}, 0.1)`,
    },

    profileInfo: {
      flex: 1,
    },

    badge: {
      display: "inline-block",
      marginTop: 8,
      padding: "4px 10px",
      background: `rgba(${accentRgb}, 0.15)`,
      color: accent,
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
    },

    input: {
      "& input, & textarea": {
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
        border: `1px solid rgba(${accentRgb}, 0.15)`,
        borderRadius: 10,
        color: isDark ? "#fff" : theme.colors.dark[8],

        "&:focus": {
          borderColor: accent,
        },
      },
    },

    statusBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "6px 12px",
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 600,
    },

    statusEnabled: {
      background: "rgba(34, 197, 94, 0.15)",
      color: "#22c55e",
    },

    statusDisabled: {
      background: "rgba(239, 68, 68, 0.15)",
      color: "#ef4444",
    },

    securityItem: {
      padding: 16,
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
      borderRadius: 10,
      marginTop: 16,
    },

    oauthItem: {
      padding: 16,
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
      borderRadius: 10,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,

      "&:last-child": {
        marginBottom: 0,
      },
    },

    oauthIcon: {
      width: 44,
      height: 44,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 20,
    },

    themeOption: {
      flex: 1,
      padding: "16px 20px",
      background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
      border: `1px solid rgba(${accentRgb}, 0.15)`,
      borderRadius: 12,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
      transition: "all 0.2s ease",

      "&:hover": {
        borderColor: accent,
      },
    },

    themeOptionActive: {
      background: `rgba(${accentRgb}, 0.15)`,
      borderColor: accent,
      borderWidth: 2,
      color: accent,
    },

    primaryButton: {
      background: `linear-gradient(135deg, ${accent}, rgba(${accentRgb}, 0.8))`,
      border: "none",
      color: isDark ? "#000" : "#fff",
      fontWeight: 600,

      "&:hover": {
        transform: "translateY(-1px)",
        boxShadow: `0 4px 12px rgba(${accentRgb}, 0.3)`,
      },
    },

    secondaryButton: {
      background: "transparent",
      border: `1px solid rgba(${accentRgb}, 0.3)`,
      color: isDark ? "#fff" : theme.colors.dark[7],

      "&:hover": {
        background: `rgba(${accentRgb}, 0.1)`,
      },
    },

    dangerButton: {
      background: "rgba(239, 68, 68, 0.15)",
      border: "1px solid rgba(239, 68, 68, 0.3)",
      color: "#ef4444",

      "&:hover": {
        background: "rgba(239, 68, 68, 0.25)",
      },
    },

    passkeyItem: {
      padding: 16,
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
      borderRadius: 10,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },

    passkeyIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      background: `rgba(${accentRgb}, 0.15)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: accent,
    },
  };
});

type Section = "profile" | "security" | "connections" | "preferences";

type UploadLimitRequest = {
  requestedLimit: number;
  reason: string;
  status: string;
  createdAt: string;
};

const formatBytes = (bytes?: number | string | null): string => {
  if (!bytes) return "Default";

  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "Default";

  if (value >= 1024 * 1024 * 1024 * 1024) {
    const tb = value / (1024 * 1024 * 1024 * 1024);
    return tb % 1 === 0 ? `${Math.round(tb)} TB` : `${tb.toFixed(1)} TB`;
  }

  if (value >= 1024 * 1024 * 1024) {
    const gb = value / (1024 * 1024 * 1024);
    return gb % 1 === 0 ? `${Math.round(gb)} GB` : `${gb.toFixed(1)} GB`;
  }

  if (value >= 1024 * 1024) {
    const mb = value / (1024 * 1024);
    return mb % 1 === 0 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
  }

  return `${Math.round(value)} B`;
};

const Account = () => {
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [oauth, setOAuth] = useState<string[]>([]);
  const [oauthStatus, setOAuthStatus] = useState<Record<
    string,
    {
      provider: string;
      providerUsername: string;
    }
  > | null>(null);
  const [show2FABanner, setShow2FABanner] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [uploadLimitRequest, setUploadLimitRequest] =
    useState<UploadLimitRequest | null>(null);
  const [effectiveShareLimit, setEffectiveShareLimit] = useState<number | null>(
    null
  );
  const [isLimitRequestSubmitting, setIsLimitRequestSubmitting] =
    useState(false);
  const [isRedeemingInvite, setIsRedeemingInvite] = useState(false);

  const { classes, cx } = useStyles();
  const { user, refreshUser } = useUser();
  const modals = useModals();
  const t = useTranslate();
  const router = useRouter();

  useEffect(() => {
    if (router.query.setup2fa === "true" && !user?.totpVerified) {
      setShow2FABanner(true);
      setActiveSection("security");
      router.replace("/account", undefined, { shallow: true });
    }
  }, [router.query.setup2fa, user?.totpVerified]);

  const accountForm = useForm({
    initialValues: {
      username: user?.username || "",
      email: user?.email || "",
    },
    validate: yupResolver(
      yup.object().shape({
        email: yup.string().email(t("common.error.invalid-email")),
        username: yup
          .string()
          .min(3, t("common.error.too-short", { length: 3 })),
      })
    ),
  });

  const passwordForm = useForm({
    initialValues: {
      oldPassword: "",
      password: "",
    },
    validate: yupResolver(
      yup.object().shape({
        oldPassword: yup.string().when([], {
          is: () => !!user?.hasPassword,
          then: (schema) =>
            schema
              .min(8, t("common.error.too-short", { length: 8 }))
              .required(t("common.error.field-required")),
          otherwise: (schema) => schema.notRequired(),
        }),
        password: yup
          .string()
          .min(8, t("common.error.too-short", { length: 8 }))
          .required(t("common.error.field-required")),
      })
    ),
  });

  const enable2FAForm = useForm({
    initialValues: {
      password: "",
    },
    validate: yupResolver(
      yup.object().shape({
        password: yup
          .string()
          .min(8, t("common.error.too-short", { length: 8 }))
          .required(t("common.error.field-required")),
      })
    ),
  });

  const disable2FAForm = useForm({
    initialValues: {
      password: "",
      code: "",
    },
    validate: yupResolver(
      yup.object().shape({
        password: yup.string().min(8),
        code: yup
          .string()
          .min(6, t("common.error.exact-length", { length: 6 }))
          .max(6, t("common.error.exact-length", { length: 6 }))
          .matches(/^[0-9]+$/, { message: t("common.error.invalid-number") }),
      })
    ),
  });

  const uploadLimitForm = useForm({
    initialValues: {
      requestedLimit: 25,
      reason: "",
    },
    validate: {
      requestedLimit: (value) => {
        if (!Number.isInteger(value)) return "Enter a whole number of GB";
        if (value < 1) return "Requested limit must be at least 1 GB";
        if (value > 1000) return "Requested limit cannot exceed 1000 GB";
        return null;
      },
      reason: (value) => {
        const trimmed = value.trim();
        if (trimmed.length < 10) return "Please add at least 10 characters";
        if (trimmed.length > 500) return "Please keep the reason under 500 characters";
        return null;
      },
    },
  });

  const inviteRedeemForm = useForm({
    initialValues: {
      inviteCode: "",
    },
    validate: {
      inviteCode: (value) =>
        value.trim().length > 0 ? null : "Enter an invite code",
    },
  });

  const refreshOAuthStatus = () => {
    authService
      .getOAuthStatus()
      .then((data) => {
        setOAuthStatus(data.data);
      })
      .catch(toast.axiosError);
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      await userService.uploadAvatar(formData);
      await refreshUser();
      toast.success("Profile photo updated!");
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAccount = () => {
    modals.openConfirmModal({
      title: t("account.modal.delete.title"),
      children: (
        <Text size="sm">
          <FormattedMessage id="account.modal.delete.description" />
        </Text>
      ),
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await userService
          .removeCurrentUser()
          .then(() => window.location.reload())
          .catch(toast.axiosError);
      },
    });
  };

  const refreshUploadLimitRequest = async () => {
    try {
      const response = await userService.getUploadLimitRequest();
      setUploadLimitRequest(response.data);
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const refreshEffectiveShareLimit = async () => {
    try {
      const response = await fetch("/api/shares/limit");
      const data = await response.json();
      setEffectiveShareLimit(Number(data.maxShareSize));
    } catch {
      setEffectiveShareLimit(null);
    }
  };

  const submitUploadLimitRequest = async (values: {
    requestedLimit: number;
    reason: string;
  }) => {
    setIsLimitRequestSubmitting(true);
    try {
      await userService.createUploadLimitRequest({
        requestedLimit: values.requestedLimit,
        reason: values.reason.trim(),
      });
      toast.success("Upload limit request submitted");
      uploadLimitForm.reset();
      await refreshUploadLimitRequest();
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setIsLimitRequestSubmitting(false);
    }
  };

  const submitInviteCode = async (values: { inviteCode: string }) => {
    setIsRedeemingInvite(true);
    try {
      await userService.redeemInviteCode(values.inviteCode.trim().toUpperCase());
      inviteRedeemForm.reset();
      await refreshUser();
      toast.success("Invite accepted. Uploads are now enabled.");
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setIsRedeemingInvite(false);
    }
  };

  const cancelUploadLimitRequest = () => {
    modals.openConfirmModal({
      title: "Cancel upload limit request?",
      children: (
        <Text size="sm">
          This will remove your pending request. You can submit a new one later.
        </Text>
      ),
      labels: {
        confirm: "Cancel request",
        cancel: t("common.button.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await userService.cancelUploadLimitRequest();
          setUploadLimitRequest(null);
          toast.success("Upload limit request cancelled");
        } catch (error) {
          toast.axiosError(error);
        }
      },
    });
  };

  useEffect(() => {
    authService
      .getAvailableOAuth()
      .then((data) => {
        setOAuth(data.data);
      })
      .catch(toast.axiosError);
    refreshOAuthStatus();
  }, []);

  useEffect(() => {
    if (!user) return;

    refreshUploadLimitRequest();
    refreshEffectiveShareLimit();
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      accountForm.setValues({
        username: user.username || "",
        email: user.email || "",
      });
    }
  }, [user]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const sections = [
    { id: "profile" as Section, label: "Profile", icon: TbUser },
    { id: "security" as Section, label: "Security", icon: TbLock },
    { id: "connections" as Section, label: "Connections", icon: TbLink },
    { id: "preferences" as Section, label: "Preferences", icon: TbSettings },
  ];

  return (
    <>
      <Meta title={t("account.title")} />
      <Container size="lg" py="xl">
        <Title order={2} mb="xs">
          Account Settings
        </Title>
        <Text color="dimmed" mb="xl">
          Manage your profile, security, and preferences
        </Text>

        {show2FABanner && !user?.totpVerified && (
          <Alert
            icon={<TbShieldCheck size={20} />}
            title="Secure your account with 2FA"
            color="blue"
            mb="xl"
            withCloseButton
            onClose={() => setShow2FABanner(false)}
          >
            <Text size="sm">
              Two-factor authentication adds an extra layer of security. Set it
              up now to protect your shares and data.
            </Text>
          </Alert>
        )}

        <div className={classes.wrapper}>
          <div className={classes.sidebar}>
            <div className={classes.sidebarCard}>
              {sections.map((section) => (
                <UnstyledButton
                  key={section.id}
                  className={cx(
                    classes.navButton,
                    activeSection === section.id && classes.navButtonActive
                  )}
                  onClick={() => setActiveSection(section.id)}
                >
                  <section.icon size={20} />
                  <span>{section.label}</span>
                </UnstyledButton>
              ))}

              <UnstyledButton
                className={cx(classes.navButton, classes.navButtonDanger)}
                onClick={handleDeleteAccount}
              >
                <TbTrash size={20} />
                <span>Delete Account</span>
              </UnstyledButton>
            </div>
          </div>

          <div className={classes.content}>
            {activeSection === "profile" && (
              <>
                <Box className={classes.card}>
                  <div className={classes.profileHeader}>
                    <div className={classes.avatarWrapper}>
                      <Avatar
                        src={user?.avatar}
                        size={100}
                        radius={100}
                        color="brand"
                        styles={{
                          root: {
                            border: "3px solid rgba(var(--ls-accent-rgb), 0.3)",
                          },
                        }}
                      >
                        {user?.username ? getInitials(user.username) : "U"}
                      </Avatar>
                      <FileButton
                        onChange={handleAvatarUpload}
                        accept="image/*"
                      >
                        {(props) => (
                          <Box className={classes.avatarOverlay} {...props}>
                            {avatarUploading ? (
                              <Loader size="sm" color="white" />
                            ) : (
                              <TbCamera size={24} color="white" />
                            )}
                          </Box>
                        )}
                      </FileButton>
                    </div>
                    <div className={classes.profileInfo}>
                      <Title order={3}>{user?.username}</Title>
                      <Text color="dimmed" size="sm">
                        {user?.email}
                      </Text>
                      {user?.isAdmin && (
                        <span className={classes.badge}>Admin</span>
                      )}
                    </div>
                  </div>

                  <form
                    onSubmit={accountForm.onSubmit((values) =>
                      userService
                        .updateCurrentUser({
                          username: values.username,
                          email: values.email,
                        })
                        .then(() => {
                          toast.success(t("account.notify.info.success"));
                          refreshUser();
                        })
                        .catch(toast.axiosError)
                    )}
                  >
                    <Stack spacing="md">
                      <TextInput
                        label="Username"
                        placeholder="Your username"
                        disabled={user?.isLdap}
                        classNames={{ input: classes.input }}
                        {...accountForm.getInputProps("username")}
                      />
                      <TextInput
                        label="Email"
                        placeholder="your@email.com"
                        disabled={user?.isLdap}
                        classNames={{ input: classes.input }}
                        {...accountForm.getInputProps("email")}
                      />
                      {!user?.isLdap && (
                        <Group position="right">
                          <Button type="submit" className={classes.primaryButton}>
                            Save Changes
                          </Button>
                        </Group>
                      )}
                    </Stack>
                  </form>
                </Box>

                {!user?.isLdap && (
                  <Box className={classes.card}>
                    <Text className={classes.cardTitle}>
                      <TbLock size={20} />
                      Change Password
                    </Text>
                    <form
                      onSubmit={passwordForm.onSubmit((values) =>
                        authService
                          .updatePassword(values.oldPassword, values.password)
                          .then(async () => {
                            refreshUser();
                            toast.success(t("account.notify.password.success"));
                            passwordForm.reset();
                          })
                          .catch(toast.axiosError)
                      )}
                    >
                      <Stack spacing="md">
                        {user?.hasPassword ? (
                          <PasswordInput
                            label="Current Password"
                            placeholder="••••••••"
                            classNames={{ input: classes.input }}
                            {...passwordForm.getInputProps("oldPassword")}
                          />
                        ) : (
                          <Text size="sm" color="dimmed">
                            <FormattedMessage id="account.card.password.noPasswordSet" />
                          </Text>
                        )}
                        <PasswordInput
                          label="New Password"
                          placeholder="••••••••"
                          classNames={{ input: classes.input }}
                          {...passwordForm.getInputProps("password")}
                        />
                        <Group position="right">
                          <Button
                            type="submit"
                            className={classes.secondaryButton}
                          >
                            Update Password
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  </Box>
                )}

                {!user?.canCreateShares && (
                  <Box className={classes.card}>
                    <Group position="apart" align="flex-start" mb="md">
                      <div>
                        <Text className={classes.cardTitle} mb={4}>
                          <TbTicket size={22} />
                          Unlock uploads
                        </Text>
                        <Text color="dimmed" size="sm">
                          Enter an invite code to create shares here too.
                        </Text>
                      </div>
                    </Group>

                    <form onSubmit={inviteRedeemForm.onSubmit(submitInviteCode)}>
                      <Stack spacing="md">
                        <TextInput
                          label="Invite code"
                          placeholder="Enter your invite code"
                          classNames={{ input: classes.input }}
                          value={inviteRedeemForm.values.inviteCode}
                          onChange={(event) =>
                            inviteRedeemForm.setFieldValue(
                              "inviteCode",
                              event.currentTarget.value.toUpperCase(),
                            )
                          }
                          error={inviteRedeemForm.errors.inviteCode}
                        />
                        <Group position="right">
                          <Button
                            type="submit"
                            className={classes.primaryButton}
                            loading={isRedeemingInvite}
                          >
                            Redeem Invite
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  </Box>
                )}

                <Box className={classes.card}>
                  <Group position="apart" align="flex-start" mb="md">
                    <div>
                      <Text className={classes.cardTitle} mb={4}>
                        <TbCloudUpload size={22} />
                        Share Upload Limit
                      </Text>
                      <Text color="dimmed" size="sm">
                        Request a higher per-share upload limit if you need more room.
                      </Text>
                    </div>
                    <span className={classes.badge}>
                      {formatBytes(effectiveShareLimit)}
                    </span>
                  </Group>

                  {uploadLimitRequest ? (
                    <Alert color="green" mb="md">
                      <Stack spacing={8}>
                        <Text weight={600}>
                          Pending request for {uploadLimitRequest.requestedLimit} GB
                        </Text>
                        <Text size="sm" color="dimmed">
                          {uploadLimitRequest.reason}
                        </Text>
                        <Group position="right">
                          <Button
                            size="xs"
                            className={classes.dangerButton}
                            onClick={cancelUploadLimitRequest}
                          >
                            Cancel request
                          </Button>
                        </Group>
                      </Stack>
                    </Alert>
                  ) : (
                    <form
                      onSubmit={uploadLimitForm.onSubmit(
                        submitUploadLimitRequest
                      )}
                    >
                      <Stack spacing="md">
                        <NumberInput
                          label="Requested limit"
                          description="Enter the new per-share limit in GB."
                          min={1}
                          max={1000}
                          precision={0}
                          parser={(value) => value?.replace(/[^\d]/g, "") ?? ""}
                          formatter={(value) =>
                            value && !Number.isNaN(Number(value))
                              ? `${value} GB`
                              : ""
                          }
                          classNames={{ input: classes.input }}
                          {...uploadLimitForm.getInputProps("requestedLimit")}
                        />
                        <Textarea
                          label="Reason"
                          placeholder="Tell us what you need the higher limit for."
                          minRows={3}
                          maxLength={500}
                          classNames={{ input: classes.input }}
                          {...uploadLimitForm.getInputProps("reason")}
                        />
                        <Group position="right">
                          <Button
                            type="submit"
                            className={classes.primaryButton}
                            loading={isLimitRequestSubmitting}
                          >
                            Submit Request
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  )}
                </Box>
              </>
            )}

            {activeSection === "security" && (
              <>
                <Box className={classes.card}>
                  <Group position="apart" mb="md">
                    <div>
                      <Text className={classes.cardTitle} mb={4}>
                        <TbAuth2Fa size={24} />
                        Two-Factor Authentication
                      </Text>
                      <Text color="dimmed" size="sm">
                        Add an extra layer of security with an authenticator app
                      </Text>
                    </div>
                    <span
                      className={cx(
                        classes.statusBadge,
                        user?.totpVerified
                          ? classes.statusEnabled
                          : classes.statusDisabled
                      )}
                    >
                      {user?.totpVerified ? (
                          <>
                            <TbCheck size={14} />
                            Enabled
                          </>
                        ) : (
                          "Not Enabled"
                        )}
                    </span>
                  </Group>

                  {user?.totpVerified ? (
                    <Box className={classes.securityItem}>
                      <Text color="dimmed" size="sm" mb="md">
                        To disable 2FA, enter your password and current code:
                      </Text>
                      <form
                        onSubmit={disable2FAForm.onSubmit((values) => {
                          authService
                            .disableTOTP(values.code, values.password)
                            .then(() => {
                              toast.success("2FA has been disabled");
                              disable2FAForm.reset();
                              refreshUser();
                            })
                            .catch(toast.axiosError);
                        })}
                      >
                        <Group>
                          <PasswordInput
                            placeholder="Password"
                            style={{ flex: 1 }}
                            classNames={{ input: classes.input }}
                            {...disable2FAForm.getInputProps("password")}
                          />
                          <TextInput
                            placeholder="Code"
                            style={{ width: 100 }}
                            maxLength={6}
                            classNames={{ input: classes.input }}
                            styles={{ input: { textAlign: "center" } }}
                            {...disable2FAForm.getInputProps("code")}
                          />
                          <Button type="submit" className={classes.dangerButton}>
                            Disable
                          </Button>
                        </Group>
                      </form>
                    </Box>
                  ) : (
                    <form
                      onSubmit={enable2FAForm.onSubmit((values) => {
                        authService
                          .enableTOTP(values.password)
                          .then((result) => {
                            showEnableTotpModal(modals, refreshUser, {
                              qrCode: result.qrCode,
                              secret: result.totpSecret,
                              password: values.password,
                            });
                            enable2FAForm.reset();
                          })
                          .catch(toast.axiosError);
                      })}
                    >
                      <Stack spacing="md">
                        <PasswordInput
                          label="Enter your password to begin setup"
                          placeholder="••••••••"
                          classNames={{ input: classes.input }}
                          {...enable2FAForm.getInputProps("password")}
                        />
                        <Group position="right">
                          <Button
                            type="submit"
                            className={classes.primaryButton}
                          >
                            Enable 2FA
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  )}
                </Box>

                <Box className={classes.card}>
                  <Text className={classes.cardTitle}>
                    <TbFingerprint size={24} />
                    Passkeys
                  </Text>
                  <Text color="dimmed" size="sm" mb="lg">
                    Sign in with Face ID, Touch ID, or your device PIN
                  </Text>
                  <PasskeyManagement />
                </Box>
              </>
            )}

            {activeSection === "connections" && (
              <Box className={classes.card}>
                <Text className={classes.cardTitle}>
                  <TbLink size={20} />
                  Connected Accounts
                </Text>

                {oauth.length > 0 ? (
                  oauth.map((provider) => (
                    <Box key={provider} className={classes.oauthItem}>
                      <Group>
                        <Box
                          className={classes.oauthIcon}
                          sx={{
                            background:
                              provider === "discord" ? "#5865F2" : "#fff",
                            color: provider === "discord" ? "#fff" : "#000",
                          }}
                        >
                          {getOAuthIcon(provider)}
                        </Box>
                        <div>
                          <Text weight={500}>
                            {provider.charAt(0).toUpperCase() +
                              provider.slice(1)}
                          </Text>
                          <Text
                            size="sm"
                            color={
                              oauthStatus?.[provider] ? "green" : "dimmed"
                            }
                          >
                            {oauthStatus?.[provider]
                              ? oauthStatus[provider].providerUsername
                              : "Not connected"}
                          </Text>
                        </div>
                      </Group>
                      {oauthStatus?.[provider] ? (
                        <Button
                          className={classes.dangerButton}
                          size="sm"
                          onClick={() => {
                            modals.openConfirmModal({
                              title: t("account.modal.unlink.title"),
                              children: (
                                <Text>
                                  {t("account.modal.unlink.description")}
                                </Text>
                              ),
                              labels: {
                                confirm: t("account.card.oauth.unlink"),
                                cancel: t("common.button.cancel"),
                              },
                              confirmProps: { color: "red" },
                              onConfirm: () => {
                                unlinkOAuth(provider)
                                  .then(() => {
                                    toast.success(
                                      t("account.notify.oauth.unlinked.success")
                                    );
                                    refreshOAuthStatus();
                                  })
                                  .catch(toast.axiosError);
                              },
                            });
                          }}
                        >
                          Unlink
                        </Button>
                      ) : (
                        <Button
                          component="a"
                          href={getOAuthUrl(window.location.origin, provider)}
                          className={classes.primaryButton}
                          size="sm"
                        >
                          Connect
                        </Button>
                      )}
                    </Box>
                  ))
                ) : (
                  <Text color="dimmed" size="sm">
                    No OAuth providers configured
                  </Text>
                )}
              </Box>
            )}

            {activeSection === "preferences" && (
              <>
                <Box className={classes.card}>
                  <Text className={classes.cardTitle}>
                    <TbPalette size={20} />
                    Appearance
                  </Text>
                  <ThemeSwitcher />
                </Box>

                <Box className={classes.card}>
                  <Text className={classes.cardTitle}>
                    <TbWorld size={20} />
                    Language
                  </Text>
                  <LanguagePicker />
                </Box>
              </>
            )}
          </div>
        </div>
      </Container>
    </>
  );
};

export default Account;
