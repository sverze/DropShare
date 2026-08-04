import {
  ActionIcon,
  Badge,
  Box,
  Button,
  createStyles,
  Group,
  Menu,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useEffect, useState } from "react";
import {
  TbDeviceMobile,
  TbDevices,
  TbDots,
  TbEdit,
  TbFingerprint,
  TbPlus,
  TbTrash,
} from "react-icons/tb";
import passkeyService from "../../services/passkey.service";
import toast from "../../utils/toast.util";
import PasskeySetupModal from "./PasskeySetupModal";

const useStyles = createStyles((theme) => ({
  container: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    padding: 24,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 18,
    fontWeight: 600,
    color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[8],
  },

  description: {
    fontSize: 13,
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
    marginTop: 4,
  },

  addButton: {
    background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
    border: "none",
    color: "#000",
    fontWeight: 600,
    "&:hover": {
      background: "linear-gradient(135deg, var(--ls-accent-hover) 0%, var(--ls-accent-hover-deep) 100%)",
    },
  },

  passkeyItem: {
    background: theme.colorScheme === "dark"
      ? "rgba(0, 0, 0, 0.2)"
      : "rgba(0, 0, 0, 0.02)",
    borderRadius: 12,
    padding: 16,
    border: `1px solid ${theme.colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.05)"
      : "rgba(0, 0, 0, 0.05)"}`,
    transition: "all 0.2s ease",
    "&:hover": {
      background: `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.05 : 0.03})`,
    },
  },

  passkeyIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(var(--ls-panel-border-rgb), 0.1)",
  },

  passkeyName: {
    fontWeight: 600,
    fontSize: 15,
    color: theme.colorScheme === "dark" ? "#fff" : theme.colors.dark[8],
  },

  passkeyMeta: {
    fontSize: 12,
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
  },

  emptyState: {
    textAlign: "center" as const,
    padding: "40px 20px",
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.08})`,
    margin: "0 auto 16px",
  },
}));

interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: string;
  deviceType: string;
  backedUp: boolean;
}

const PasskeyManagement = () => {
  const { classes } = useStyles();
  const modals = useModals();
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);

  const loadPasskeys = async () => {
    const data = await passkeyService.listPasskeys();
    setPasskeys(data);
  };

  useEffect(() => {
    passkeyService.isPlatformAuthenticatorAvailable().then(setPasskeySupported);
    loadPasskeys();
  }, []);

  const handleDelete = (passkey: PasskeyInfo) => {
    modals.openConfirmModal({
      title: "Delete Passkey",
      children: (
        <Text size="sm">
          Are you sure you want to delete "{passkey.name}"? You won't be able to use it to sign in anymore.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const success = await passkeyService.deletePasskey(passkey.id);
        if (success) {
          toast.success("Passkey deleted");
          loadPasskeys();
        } else {
          toast.error("Failed to delete passkey");
        }
      },
    });
  };

  const handleRename = (passkey: PasskeyInfo) => {
    let newName = passkey.name;
    modals.openModal({
      title: "Rename Passkey",
      children: (
        <Stack>
          <TextInput
            label="Name"
            defaultValue={passkey.name}
            onChange={(e) => (newName = e.target.value)}
          />
          <Group position="right" mt="md">
            <Button variant="subtle" onClick={() => modals.closeAll()}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (newName.trim()) {
                  const success = await passkeyService.renamePasskey(passkey.id, newName.trim());
                  if (success) {
                    toast.success("Passkey renamed");
                    loadPasskeys();
                  } else {
                    toast.error("Failed to rename passkey");
                  }
                }
                modals.closeAll();
              }}
            >
              Save
            </Button>
          </Group>
        </Stack>
      ),
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!passkeySupported) {
    return null;
  }

  return (
    <>
      <Box className={classes.container}>
        <Box className={classes.header}>
          <Box>
            <Text className={classes.title}>Passkeys</Text>
            <Text className={classes.description}>
              Sign in faster and more securely with Face ID, Touch ID, or Windows Hello
            </Text>
          </Box>
          <Button
            leftIcon={<TbPlus size={18} />}
            className={classes.addButton}
            onClick={() => setShowSetupModal(true)}
            size="sm"
          >
            Add Passkey
          </Button>
        </Box>

        {passkeys.length === 0 ? (
          <Box className={classes.emptyState}>
            <Box className={classes.emptyIcon}>
              <TbFingerprint size={32} color="var(--ls-accent)" />
            </Box>
            <Text weight={500} mb={4}>No passkeys yet</Text>
            <Text size="sm" color="dimmed">
              Add a passkey to sign in without a password
            </Text>
          </Box>
        ) : (
          <Stack spacing="sm">
            {passkeys.map((passkey) => (
              <Box key={passkey.id} className={classes.passkeyItem}>
                <Group position="apart">
                  <Group spacing="md">
                    <Box className={classes.passkeyIcon}>
                      {passkey.deviceType === "multiDevice" ? (
                        <TbDevices size={22} color="var(--ls-accent)" />
                      ) : (
                        <TbDeviceMobile size={22} color="var(--ls-accent)" />
                      )}
                    </Box>
                    <Box>
                      <Group spacing="xs">
                        <Text className={classes.passkeyName}>{passkey.name}</Text>
                        {passkey.backedUp && (
                          <Badge size="xs" color="green" variant="light">
                            Synced
                          </Badge>
                        )}
                      </Group>
                      <Text className={classes.passkeyMeta}>
                        Added {formatDate(passkey.createdAt)}
                      </Text>
                    </Box>
                  </Group>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon>
                        <TbDots size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        icon={<TbEdit size={16} />}
                        onClick={() => handleRename(passkey)}
                      >
                        Rename
                      </Menu.Item>
                      <Menu.Item
                        icon={<TbTrash size={16} />}
                        color="red"
                        onClick={() => handleDelete(passkey)}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <PasskeySetupModal
        opened={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSuccess={loadPasskeys}
      />
    </>
  );
};

export default PasskeyManagement;
