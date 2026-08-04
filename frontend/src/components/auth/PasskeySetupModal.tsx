import {
  Box,
  Button,
  createStyles,
  Modal,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { useState } from "react";
import { TbCheck, TbFingerprint } from "react-icons/tb";
import passkeyService from "../../services/passkey.service";
import toast from "../../utils/toast.util";

const useStyles = createStyles((theme) => ({
  modal: {
    ".mantine-Modal-content": {
      background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.95 : 0.98})`,
      backdropFilter: "blur(12px)",
      border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    },
  },

  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: theme.colorScheme === "dark"
      ? "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.2) 0%, rgba(var(--ls-accent-deep-rgb), 0.1) 100%)"
      : "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.15) 0%, rgba(var(--ls-accent-deep-rgb), 0.08) 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    border: `2px solid rgba(var(--ls-panel-border-rgb), 0.3)`,
  },

  title: {
    fontSize: 22,
    fontWeight: 700,
    textAlign: "center" as const,
    color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[8],
  },

  description: {
    textAlign: "center" as const,
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6],
    fontSize: 14,
    lineHeight: 1.6,
    maxWidth: 320,
    margin: "0 auto",
  },

  benefits: {
    background: "rgba(var(--ls-panel-border-rgb), 0.05)",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },

  benefitItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    fontSize: 13,
    color: theme.colorScheme === "dark" ? theme.colors.gray[3] : theme.colors.gray[7],
  },

  setupButton: {
    background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
    border: "none",
    color: "#000",
    fontWeight: 600,
    height: 44,
    "&:hover": {
      background: "linear-gradient(135deg, var(--ls-accent-hover) 0%, var(--ls-accent-hover-deep) 100%)",
      transform: "translateY(-1px)",
    },
  },

  skipButton: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
    "&:hover": {
      background: theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.03)",
    },
  },
}));

interface PasskeySetupModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PasskeySetupModal = ({ opened, onClose, onSuccess }: PasskeySetupModalProps) => {
  const { classes } = useStyles();
  const [isLoading, setIsLoading] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const [step, setStep] = useState<"prompt" | "name" | "success">("prompt");

  const handleSetupPasskey = async () => {
    setIsLoading(true);
    try {
      const name = passkeyName.trim() || `Passkey ${new Date().toLocaleDateString()}`;
      const result = await passkeyService.registerPasskey(name);

      if (result.success) {
        setStep("success");
        toast.success("Passkey registered successfully!");
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else if (result.error && result.error !== "Registration was cancelled") {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Failed to set up passkey");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep("prompt");
    setPasskeyName("");
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      size="sm"
      withCloseButton={false}
      className={classes.modal}
      padding="xl"
    >
      {step === "prompt" && (
        <Stack spacing="md">
          <Box className={classes.iconWrapper}>
            <TbFingerprint size={40} color="var(--ls-accent)" />
          </Box>

          <Text className={classes.title}>
            Set Up Passkey Login
          </Text>

          <Text className={classes.description}>
            Make your account more secure with passwordless login using Face ID, Touch ID, or your device's security.
          </Text>

          <Box className={classes.benefits}>
            <Box className={classes.benefitItem}>
              <ThemeIcon size={20} radius="xl" color="green" variant="light">
                <TbCheck size={12} />
              </ThemeIcon>
              <span>Faster login - no password needed</span>
            </Box>
            <Box className={classes.benefitItem}>
              <ThemeIcon size={20} radius="xl" color="green" variant="light">
                <TbCheck size={12} />
              </ThemeIcon>
              <span>More secure than passwords</span>
            </Box>
            <Box className={classes.benefitItem}>
              <ThemeIcon size={20} radius="xl" color="green" variant="light">
                <TbCheck size={12} />
              </ThemeIcon>
              <span>Works with Face ID, Touch ID & more</span>
            </Box>
          </Box>

          <Stack spacing="xs" mt="md">
            <Button
              fullWidth
              className={classes.setupButton}
              leftIcon={<TbFingerprint size={20} />}
              onClick={() => setStep("name")}
            >
              Set Up Passkey
            </Button>
            <Button
              fullWidth
              variant="subtle"
              className={classes.skipButton}
              onClick={handleClose}
            >
              Maybe Later
            </Button>
          </Stack>
        </Stack>
      )}

      {step === "name" && (
        <Stack spacing="md">
          <Box className={classes.iconWrapper}>
            <TbFingerprint size={40} color="var(--ls-accent)" />
          </Box>

          <Text className={classes.title}>
            Name Your Passkey
          </Text>

          <Text className={classes.description}>
            Give this passkey a name so you can identify it later (e.g., "MacBook Pro", "iPhone").
          </Text>

          <TextInput
            placeholder="My Device"
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value)}
            size="md"
            mt="sm"
          />

          <Stack spacing="xs" mt="md">
            <Button
              fullWidth
              className={classes.setupButton}
              leftIcon={<TbFingerprint size={20} />}
              onClick={handleSetupPasskey}
              loading={isLoading}
            >
              Continue
            </Button>
            <Button
              fullWidth
              variant="subtle"
              className={classes.skipButton}
              onClick={() => setStep("prompt")}
              disabled={isLoading}
            >
              Back
            </Button>
          </Stack>
        </Stack>
      )}

      {step === "success" && (
        <Stack spacing="md" align="center">
          <ThemeIcon size={80} radius="xl" color="green" variant="light">
            <TbCheck size={40} />
          </ThemeIcon>
          
          <Text className={classes.title}>
            Passkey Added!
          </Text>
          
          <Text className={classes.description}>
            You can now sign in with your passkey. You can manage your passkeys in Account Settings.
          </Text>
        </Stack>
      )}
    </Modal>
  );
};

export default PasskeySetupModal;
