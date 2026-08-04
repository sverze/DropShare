import { 
  ActionIcon, 
  Badge, 
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Skeleton,
  Stack,
  Table, 
  Text, 
  Tooltip,
  createStyles,
  Avatar,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { TbAuth2Fa, TbBan, TbCheck, TbCloudUpload, TbEdit, TbFingerprint, TbLockOpen, TbLogout, TbTrash, TbUser, TbShieldCheck, TbShieldLock, TbX } from "react-icons/tb";
import User from "../../../types/user.type";
import showUpdateUserModal from "./showUpdateUserModal";
import showBanUserModal from "./showBanUserModal";
import userService from "../../../services/user.service";
import useUser from "../../../hooks/user.hook";
import { hasCapability } from "../../../utils/capabilities.util";
import toast from "../../../utils/toast.util";

const useStyles = createStyles((theme) => ({
  tableWrapper: {
    display: "block",
    overflowX: "auto",
  },

  table: {
    "& thead tr th": {
      background: theme.colorScheme === "dark"
        ? "rgba(0, 0, 0, 0.2)"
        : "rgba(0, 0, 0, 0.03)",
      borderBottom: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(0, 0, 0, 0.08)"
      }`,
      color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[7],
      fontWeight: 600,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      padding: "14px 16px",
    },

    "& tbody tr": {
      transition: "all 0.15s ease",

      "&:hover": {
        background: theme.colorScheme === "dark"
          ? "rgba(var(--ls-accent-rgb), 0.04)"
          : "rgba(var(--ls-accent-rgb), 0.02)",
      },
    },

    "& tbody tr td": {
      borderBottom: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.05)"
      }`,
      padding: "16px",
    },
  },

  userCell: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  avatar: {
    border: `2px solid ${
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-accent-rgb), 0.3)"
        : "rgba(var(--ls-accent-rgb), 0.4)"
    }`,
  },

  userInfo: {
    display: "flex",
    flexDirection: "column",
  },

  username: {
    fontWeight: 600,
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
  },

  email: {
    fontSize: 13,
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
  },

  ldapBadge: {
    background: theme.colorScheme === "dark"
      ? "rgba(59, 130, 246, 0.15)"
      : "rgba(59, 130, 246, 0.1)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    color: "#3b82f6",
    fontWeight: 500,
    fontSize: 11,
  },

  adminBadge: {
    background: theme.colorScheme === "dark"
      ? "rgba(139, 92, 246, 0.15)"
      : "rgba(139, 92, 246, 0.1)",
    border: "1px solid rgba(139, 92, 246, 0.3)",
    color: "#a78bfa",
    fontWeight: 500,
  },

  enabledBadge: {
    background: theme.colorScheme === "dark"
      ? "rgba(var(--ls-accent-rgb), 0.1)"
      : "rgba(var(--ls-accent-rgb), 0.08)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.25)",
    color: "var(--ls-accent)",
    fontWeight: 500,
    fontSize: 11,
  },

  disabledBadge: {
    background: "transparent",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.15)"
        : "rgba(0, 0, 0, 0.15)"
    }`,
    color: theme.colorScheme === "dark" ? theme.colors.gray[6] : theme.colors.gray[5],
    fontWeight: 500,
    fontSize: 11,
  },

  requestBadge: {
    background: theme.colorScheme === "dark"
      ? "rgba(251, 191, 36, 0.15)"
      : "rgba(251, 191, 36, 0.1)",
    border: "1px solid rgba(251, 191, 36, 0.3)",
    color: "#fbbf24",
    fontWeight: 500,
    fontSize: 11,
  },

  limitText: {
    fontSize: 13,
    fontFamily: "monospace",
  },

  limitDefault: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[6] : theme.colors.gray[5],
    fontStyle: "italic",
  },

  limitCustom: {
    color: "var(--ls-accent)",
    fontWeight: 500,
  },

  // Keep the actions column to its minimum width so the user column takes the
  // slack, rather than the reverse (which squeezed the buttons into a single
  // vertical stack and made every row four buttons tall).
  actionsCell: {
    width: 1,
  },

  // Pin the group to exactly two buttons wide so it always wraps 2 x 2,
  // regardless of how much room the table happens to give this column.
  // 28px ActionIcon ("md") x 2 + the 8px gap = 64.
  actionGroup: {
    width: 64,
    marginLeft: "auto",
    flexWrap: "wrap",
    rowGap: 8,
  },

  actionButton: {
    transition: "all 0.2s ease",

    "&:hover": {
      transform: "scale(1.1)",
    },
  },

  editButton: {
    background: theme.colorScheme === "dark"
      ? "rgba(var(--ls-accent-rgb), 0.1)"
      : "rgba(var(--ls-accent-rgb), 0.08)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.2)",
    color: "var(--ls-accent)",

    "&:hover": {
      background: "rgba(var(--ls-accent-rgb), 0.2)",
      borderColor: "rgba(var(--ls-accent-rgb), 0.4)",
    },
  },

  requestButton: {
    background: theme.colorScheme === "dark"
      ? "rgba(251, 191, 36, 0.1)"
      : "rgba(251, 191, 36, 0.08)",
    border: "1px solid rgba(251, 191, 36, 0.2)",
    color: "#fbbf24",

    "&:hover": {
      background: "rgba(251, 191, 36, 0.2)",
      borderColor: "rgba(251, 191, 36, 0.4)",
    },
  },

  resetButton: {
    background: theme.colorScheme === "dark"
      ? "rgba(251, 146, 60, 0.1)"
      : "rgba(251, 146, 60, 0.08)",
    border: "1px solid rgba(251, 146, 60, 0.2)",
    color: "#fb923c",

    "&:hover": {
      background: "rgba(251, 146, 60, 0.2)",
      borderColor: "rgba(251, 146, 60, 0.4)",
    },
  },

  deleteButton: {
    background: theme.colorScheme === "dark"
      ? "rgba(239, 68, 68, 0.1)"
      : "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    color: "#ef4444",

    "&:hover": {
      background: "rgba(239, 68, 68, 0.2)",
      borderColor: "rgba(239, 68, 68, 0.4)",
    },
  },

  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
  },

  emptyText: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
  },

  checkIcon: {
    color: "var(--ls-accent)",
    filter: "drop-shadow(0 0 4px rgba(var(--ls-accent-rgb), 0.4))",
  },
}));

const formatBytes = (bytes: string | null | undefined): string => {
  if (!bytes) return "Default";
  const num = Number(bytes);
  if (num >= 1024 * 1024 * 1024 * 1024) {
    const tb = num / (1024 * 1024 * 1024 * 1024);
    return tb % 1 === 0 ? `${Math.round(tb)} TB` : `${tb.toFixed(1)} TB`;
  }
  if (num >= 1024 * 1024 * 1024) {
    const gb = num / (1024 * 1024 * 1024);
    return gb % 1 === 0 ? `${Math.round(gb)} GB` : `${gb.toFixed(1)} GB`;
  }
  if (num >= 1024 * 1024) {
    const mb = num / (1024 * 1024);
    return mb % 1 === 0 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
  }
  return `${num} B`;
};

const getInitials = (username: string): string => {
  return username.slice(0, 2).toUpperCase();
};

const getAvatarColor = (username: string): string => {
  const colors = [
    "#00ff5a", "#3b82f6", "#a855f7", "#f97316", "#ec4899", 
    "#14b8a6", "#eab308", "#ef4444", "#6366f1", "#22c55e"
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

interface UploadLimitRequest {
  requestedLimit: number;
  reason: string;
  createdAt: string;
}

interface UserWithRequest extends User {
  uploadLimitRequest?: UploadLimitRequest;
}

const ManageUserTable = ({
  users,
  getUsers,
  deleteUser,
  isLoading,
  onApproveRequest,
  onDeclineRequest,
}: {
  users: UserWithRequest[];
  getUsers: () => void;
  deleteUser: (_user: User) => void;
  isLoading: boolean;
  onApproveRequest?: (_userId: string) => void;
  onDeclineRequest?: (_userId: string) => void;
}) => {
  const { classes } = useStyles();
  const modals = useModals();
  const { user: currentUser } = useUser();

  const canEdit = hasCapability(currentUser, "users.edit");
  const canDelete = hasCapability(currentUser, "users.delete");
  const canResetTotp = hasCapability(currentUser, "users.totpReset");
  const canBan = hasCapability(currentUser, "users.ban");

  const canActOn = (user: User) =>
    canBan &&
    user.id !== currentUser?.id &&
    !user.isAdmin &&
    (user.role ?? "user") === "user";

  // A protected (owner-tier) account can only be edited or deleted by another
  // protected admin. Regular admins can still see the row, but the mutating
  // controls are locked. This mirrors the backend guard.
  const isProtectedLocked = (user: User) =>
    !!user.protected && currentUser?.protected !== true;

  const isBanned = (user: User) =>
    !!user.bannedAt && (!user.bannedUntil || new Date(user.bannedUntil) > new Date());

  const handleUnban = (user: User) => {
    modals.openConfirmModal({
      title: "Lift suspension",
      children: (
        <Text size="sm">
          Restore access for <strong>{user.username}</strong>? Any IP blocks
          added by this ban will also be removed.
        </Text>
      ),
      labels: { confirm: "Unban", cancel: "Cancel" },
      confirmProps: { color: "green" },
      onConfirm: async () => {
        try {
          const { liftedIpCount } = await userService.unbanUser(user.id);
          toast.success(
            `${user.username} can sign in again` +
              (liftedIpCount
                ? ` (${liftedIpCount} IP block${liftedIpCount === 1 ? "" : "s"} lifted).`
                : "."),
          );
          getUsers();
        } catch (error) {
          toast.axiosError(error);
        }
      },
    });
  };

  const handleForceLogout = (user: User) => {
    modals.openConfirmModal({
      title: "Force logout",
      children: (
        <Text size="sm">
          Sign <strong>{user.username}</strong> out of every device now? They can
          sign back in unless you also ban the account.
        </Text>
      ),
      labels: { confirm: "Force logout", cancel: "Cancel" },
      confirmProps: { color: "orange" },
      onConfirm: async () => {
        try {
          const { revokedSessions } = await userService.forceLogoutUser(user.id);
          toast.success(
            `Signed ${user.username} out (${revokedSessions} session${
              revokedSessions === 1 ? "" : "s"
            } revoked).`,
          );
          getUsers();
        } catch (error) {
          toast.axiosError(error);
        }
      },
    });
  };

  const showRequestModal = (user: UserWithRequest) => {
    if (!user.uploadLimitRequest) return;

    const request = user.uploadLimitRequest;
    const currentLimitGB = user.maxFileSizeOverride 
      ? Math.round(Number(user.maxFileSizeOverride) / (1024 * 1024 * 1024))
      : 0;

    modals.openModal({
      title: "Upload Limit Request",
      children: (
        <Stack spacing="md">
          <Group position="apart">
            <Text size="sm" weight={500}>User:</Text>
            <Text size="sm">{user.username}</Text>
          </Group>
          
          <Group position="apart">
            <Text size="sm" weight={500}>Email:</Text>
            <Text size="sm">{user.email}</Text>
          </Group>
          
          <Divider />
          
          <Group position="apart">
            <Text size="sm" weight={500}>Current Limit:</Text>
            <Badge color="gray">{currentLimitGB} GB</Badge>
          </Group>
          
          <Group position="apart">
            <Text size="sm" weight={500}>Requested Limit:</Text>
            <Badge color="green" size="lg">{request.requestedLimit} GB</Badge>
          </Group>
          
          <Divider />
          
          <Box>
            <Text size="sm" weight={500} mb="xs">Reason:</Text>
            <Paper withBorder p="sm" style={{ background: "rgba(0, 0, 0, 0.05)" }}>
              <Text size="sm" color="dimmed">
                {request.reason}
              </Text>
            </Paper>
          </Box>
          
          <Group position="right" mt="md">
            <Button
              variant="outline"
              color="red"
              leftIcon={<TbX size={16} />}
              onClick={() => {
                modals.closeAll();
                modals.openConfirmModal({
                  title: "Decline Request",
                  children: <Text size="sm">Are you sure you want to decline this request?</Text>,
                  labels: { confirm: "Decline", cancel: "Cancel" },
                  confirmProps: { color: "red" },
                  onConfirm: () => {
                    if (onDeclineRequest) {
                      onDeclineRequest(user.id);
                    }
                  },
                });
              }}
            >
              Decline
            </Button>
            <Button
              leftIcon={<TbCheck size={16} />}
              onClick={() => {
                modals.closeAll();
                modals.openConfirmModal({
                  title: "Approve Request",
                  children: (
                    <Text size="sm">
                      Approve upload limit increase to {request.requestedLimit} GB for {user.username}?
                    </Text>
                  ),
                  labels: { confirm: "Approve", cancel: "Cancel" },
                  confirmProps: { color: "green" },
                  onConfirm: () => {
                    if (onApproveRequest) {
                      onApproveRequest(user.id);
                    }
                  },
                });
              }}
            >
              Approve
            </Button>
          </Group>
        </Stack>
      ),
    });
  };

  const handleReset2FA = (user: User) => {
    modals.openConfirmModal({
      title: "Reset 2FA",
      children: (
        <Text size="sm">
          Are you sure you want to reset 2FA for <strong>{user.username}</strong>? 
          They will need to set up two-factor authentication again on their next login.
        </Text>
      ),
      labels: {
        confirm: "Reset 2FA",
        cancel: "Cancel",
      },
      confirmProps: { color: "orange" },
      onConfirm: async () => {
        try {
          await userService.adminReset2FA(user.id);
          toast.success(`2FA has been reset for ${user.username}`);
          getUsers();
        } catch (error) {
          toast.axiosError(error);
        }
      },
    });
  };

  if (!isLoading && users.length === 0) {
    return (
      <Box className={classes.emptyState}>
        <TbUser size={48} style={{ color: "var(--mantine-color-gray-5)", marginBottom: 16 }} />
        <Text className={classes.emptyText}>No users found</Text>
      </Box>
    );
  }

  return (
    <Box className={classes.tableWrapper}>
      <Table verticalSpacing="sm" className={classes.table}>
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>2FA</th>
            <th>Passkey</th>
            <th>Share Limit</th>
            <th className={classes.actionsCell} style={{ textAlign: "right" }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? skeletonRows
            : users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={classes.userCell}>
                      <Avatar 
                        src={user.avatar}
                        size={40} 
                        radius="xl"
                        className={classes.avatar}
                        style={{ 
                          background: !user.avatar 
                            ? `linear-gradient(135deg, ${getAvatarColor(user.username)}40, ${getAvatarColor(user.username)}20)`
                            : undefined,
                          color: getAvatarColor(user.username),
                        }}
                      >
                        {getInitials(user.username)}
                      </Avatar>
                      <div className={classes.userInfo}>
                        <Group spacing={8}>
                          <Text className={classes.username}>{user.username}</Text>
                          {user.isLdap && (
                            <Badge size="xs" className={classes.ldapBadge}>
                              LDAP
                            </Badge>
                          )}
                        </Group>
                        <Text className={classes.email}>{user.email}</Text>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Group spacing={8}>
                      {(user.role ?? (user.isAdmin ? "admin" : "user")) ===
                        "admin" && (
                        <Badge
                          size="sm"
                          className={classes.adminBadge}
                          leftSection={<TbShieldCheck size={12} />}
                        >
                          Admin
                        </Badge>
                      )}
                      {user.protected && (
                        <Tooltip
                          withArrow
                          label="Protected owner account - only another protected admin can change or remove it."
                        >
                          <Badge
                            size="sm"
                            color="yellow"
                            variant="light"
                            leftSection={<TbShieldLock size={12} />}
                          >
                            Protected
                          </Badge>
                        </Tooltip>
                      )}
                      {user.role === "manager" && (
                        <Badge size="sm" color="grape" variant="light">
                          Manager
                        </Badge>
                      )}
                      {(user.role ?? (user.isAdmin ? "admin" : "user")) ===
                        "user" && (
                        <Text size="sm" color="dimmed">
                          User
                        </Text>
                      )}
                      {isBanned(user) && (
                        <Tooltip
                          withArrow
                          label={
                            (user.bannedUntil
                              ? `Suspended until ${new Date(
                                  user.bannedUntil,
                                ).toLocaleString()}`
                              : "Suspended permanently") +
                            (user.banReason ? ` - ${user.banReason}` : "")
                          }
                        >
                          <Badge
                            size="sm"
                            color="red"
                            variant="filled"
                            leftSection={<TbBan size={12} />}
                          >
                            Suspended
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </td>
                  <td>
                    {user.totpVerified ? (
                      <Badge size="sm" className={classes.enabledBadge}>
                        Enabled
                      </Badge>
                    ) : (
                      <Badge size="sm" className={classes.disabledBadge}>
                        Disabled
                      </Badge>
                    )}
                  </td>
                  <td>
                    {user.hasPasskeys ? (
                      <Badge
                        size="sm"
                        className={classes.enabledBadge}
                        leftSection={<TbFingerprint size={12} />}
                      >
                        Enabled
                      </Badge>
                    ) : (
                      <Badge size="sm" className={classes.disabledBadge}>
                        Disabled
                      </Badge>
                    )}
                  </td>
                  <td>
                    <Stack spacing={4}>
                      <Text 
                        className={`${classes.limitText} ${
                          user.maxFileSizeOverride ? classes.limitCustom : classes.limitDefault
                        }`}
                      >
                        {formatBytes(user.maxFileSizeOverride)}
                      </Text>
                      {user.uploadLimitRequest && (
                        <Badge size="xs" className={classes.requestBadge}>
                          Request Pending
                        </Badge>
                      )}
                    </Stack>
                  </td>
                  <td className={classes.actionsCell}>
                    <Group
                      position="right"
                      spacing={8}
                      className={classes.actionGroup}
                    >
                      {user.uploadLimitRequest && (
                        <Tooltip label="View upload limit request" withArrow>
                          <ActionIcon
                            variant="light"
                            size="md"
                            className={`${classes.actionButton} ${classes.requestButton}`}
                            onClick={() => showRequestModal(user)}
                          >
                            <TbCloudUpload size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {user.totpVerified && canResetTotp && (
                        <Tooltip label="Reset 2FA" withArrow>
                          <ActionIcon
                            variant="light"
                            size="md"
                            className={`${classes.actionButton} ${classes.resetButton}`}
                            onClick={() => handleReset2FA(user)}
                          >
                            <TbAuth2Fa size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {canActOn(user) &&
                        (isBanned(user) ? (
                          <Tooltip label="Lift suspension" withArrow>
                            <ActionIcon
                              variant="light"
                              size="md"
                              className={classes.actionButton}
                              onClick={() => handleUnban(user)}
                            >
                              <TbLockOpen size={16} />
                            </ActionIcon>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Ban user" withArrow>
                            <ActionIcon
                              variant="light"
                              size="md"
                              color="red"
                              className={classes.actionButton}
                              onClick={() =>
                                showBanUserModal(modals, user, getUsers)
                              }
                            >
                              <TbBan size={16} />
                            </ActionIcon>
                          </Tooltip>
                        ))}
                      {canActOn(user) && (
                        <Tooltip label="Force logout" withArrow>
                          <ActionIcon
                            variant="light"
                            size="md"
                            color="orange"
                            className={classes.actionButton}
                            onClick={() => handleForceLogout(user)}
                          >
                            <TbLogout size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {!user.isLdap && canEdit && !isProtectedLocked(user) && (
                        <Tooltip label="Edit user" withArrow>
                          <ActionIcon
                            variant="light"
                            size="md"
                            className={`${classes.actionButton} ${classes.editButton}`}
                            onClick={() => showUpdateUserModal(modals, user, getUsers)}
                          >
                            <TbEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {canDelete && !isProtectedLocked(user) && (
                        <Tooltip label="Delete user" withArrow>
                          <ActionIcon
                            variant="light"
                            size="md"
                            className={`${classes.actionButton} ${classes.deleteButton}`}
                            onClick={() => deleteUser(user)}
                          >
                            <TbTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </td>
                </tr>
              ))}
        </tbody>
      </Table>
    </Box>
  );
};

const skeletonRows = [...Array(8)].map((v, i) => (
  <tr key={i}>
    <td>
      <Group spacing={12}>
        <Skeleton height={40} width={40} radius="xl" />
        <div>
          <Skeleton height={16} width={120} mb={6} />
          <Skeleton height={12} width={180} />
        </div>
      </Group>
    </td>
    <td>
      <Skeleton height={22} width={80} radius="sm" />
    </td>
    <td>
      <Skeleton height={22} width={70} radius="sm" />
    </td>
    <td>
      <Skeleton height={22} width={82} radius="sm" />
    </td>
    <td>
      <Skeleton height={16} width={80} />
    </td>
    <td style={{ width: 1 }}>
      <Group
        position="right"
        spacing={8}
        sx={{ width: 64, marginLeft: "auto", flexWrap: "wrap", rowGap: 8 }}
      >
        <Skeleton height={28} width={28} radius="sm" />
        <Skeleton height={28} width={28} radius="sm" />
      </Group>
    </td>
  </tr>
));

export default ManageUserTable;
