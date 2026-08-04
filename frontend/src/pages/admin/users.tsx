import { 
  Badge,
  Button, 
  Group, 
  NumberInput,
  Paper,
  Select,
  Space, 
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Title,
  Box,
  createStyles,
  TextInput,
  ActionIcon,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useEffect, useRef, useState } from "react";
import {
  TbActivity,
  TbCopy,
  TbLock,
  TbPlus,
  TbSearch,
  TbShield,
  TbTicket,
  TbTrash,
  TbUsers,
  TbX,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import ManageUserTable from "../../components/admin/users/ManageUserTable";
import showCreateUserModal from "../../components/admin/users/showCreateUserModal";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import { hasCapability } from "../../utils/capabilities.util";
import configService from "../../services/config.service";
import userService from "../../services/user.service";
import User, {
  BlockedIp,
  CreateUserGroup,
  InviteCode,
  UserGroup,
  UserActivitySummaryUser,
} from "../../types/user.type";
import { getUserGroupMemberships } from "../../utils/group-memberships.util";
import toast from "../../utils/toast.util";

const useStyles = createStyles((theme) => ({
  wrapper: {
    minHeight: "calc(100vh - 180px)",
  },

  headerCard: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.2 : 0.3})`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(var(--ls-accent-rgb), 0.05)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  headerContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: theme.spacing.md,

    [theme.fn.smallerThan("sm")]: {
      flexDirection: "column",
    },
  },

  titleSection: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  title: {
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
    fontWeight: 700,
    fontSize: 28,
  },

  titleIcon: {
    color: "var(--ls-accent)",
    filter: "drop-shadow(0 0 8px rgba(var(--ls-accent-rgb), 0.4))",
  },

  subtitle: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6],
    marginTop: 4,
  },

  statsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  statsBadge: {
    background: theme.colorScheme === "dark"
      ? "rgba(var(--ls-accent-rgb), 0.1)"
      : "rgba(var(--ls-accent-rgb), 0.08)",
    border: "1px solid rgba(var(--ls-accent-rgb), 0.2)",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    color: "var(--ls-accent)",
    fontWeight: 500,
  },

  // Matches the grape used for the Manager badge in ManageUserTable.
  managerBadge: {
    background: theme.colorScheme === "dark"
      ? "rgba(190, 75, 219, 0.1)"
      : "rgba(190, 75, 219, 0.08)",
    border: "1px solid rgba(190, 75, 219, 0.2)",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    color: "#d67ae8",
    fontWeight: 500,
  },

  adminBadge: {
    background: theme.colorScheme === "dark"
      ? "rgba(139, 92, 246, 0.1)"
      : "rgba(139, 92, 246, 0.08)",
    border: "1px solid rgba(139, 92, 246, 0.2)",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    color: "#a78bfa",
    fontWeight: 500,
  },

  controls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",

    [theme.fn.smallerThan("sm")]: {
      width: "100%",
    },
  },

  searchInput: {
    minWidth: 220,

    "& input": {
      background: theme.colorScheme === "dark"
        ? "rgba(0, 0, 0, 0.2)"
        : "rgba(255, 255, 255, 0.6)",
      border: `1px solid ${
        theme.colorScheme === "dark"
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.1)"
      }`,
      borderRadius: 10,
      transition: "all 0.25s ease",

      "&:focus": {
        borderColor: "rgba(var(--ls-accent-rgb), 0.5)",
        boxShadow: "0 0 20px rgba(var(--ls-accent-rgb), 0.1)",
      },
    },
  },

  createButton: {
    background: "linear-gradient(135deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
    border: "none",
    borderRadius: 10,
    fontWeight: 600,
    boxShadow: "0 4px 15px rgba(var(--ls-accent-rgb), 0.3)",
    transition: "all 0.25s ease",

    "&:hover": {
      background: "linear-gradient(135deg, var(--ls-accent-hover) 0%, var(--ls-accent-hover-deep) 100%)",
      boxShadow: "0 6px 20px rgba(var(--ls-accent-rgb), 0.4)",
      transform: "translateY(-1px)",
    },
  },

  tableCard: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.15 : 0.2})`,
    padding: theme.spacing.xl,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(var(--ls-accent-rgb), 0.05)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
    overflow: "hidden",
  },

  inviteCard: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 200, 0, 0.16)"
        : "rgba(180, 83, 9, 0.2)"
    }`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 32px rgba(255, 200, 0, 0.04)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  inviteControls: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.1fr) minmax(140px, 0.75fr) minmax(220px, 1fr) 180px",
    gap: theme.spacing.md,
    alignItems: "end",
    marginTop: theme.spacing.lg,
    width: "100%",

    [theme.fn.smallerThan("md")]: {
      gridTemplateColumns: "1fr",
    },
  },

  inviteField: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    minWidth: 0,

    "& .mantine-InputWrapper-label": {
      display: "block",
      marginBottom: 8,
      minHeight: 22,
      lineHeight: 1.2,
    },

    "& .mantine-Input-wrapper, & .mantine-NumberInput-wrapper": {
      minHeight: 54,
    },

    "& .mantine-Input-input, & .mantine-NumberInput-input": {
      minHeight: 54,
      height: 54,
    },
  },

  inviteButtonWrap: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    minWidth: 0,

    [theme.fn.smallerThan("md")]: {
      width: "100%",
    },
  },

  inviteGenerateButton: {
    minHeight: 54,
    height: 54,
    minWidth: 0,
    width: "100%",

    [theme.fn.smallerThan("md")]: {
      width: "100%",
    },
  },

  inviteTable: {
    marginTop: theme.spacing.lg,

    "& thead tr th": {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: "0.4px",
      color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
    },
  },

  inviteCodeText: {
    fontFamily: "monospace",
    fontWeight: 700,
    letterSpacing: 1,
  },

  inviteMuted: {
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
  },

  activityCard: {
    background: `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.8})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(80, 220, 255, 0.18)"
        : "rgba(80, 180, 255, 0.2)"
    }`,
    padding: theme.spacing.xl,
    marginTop: theme.spacing.xl,
    boxShadow: theme.colorScheme === "dark"
      ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 32px rgba(80, 220, 255, 0.04)"
      : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  sectionCard: {
    background: theme.colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.03)"
      : "rgba(0, 0, 0, 0.02)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.05)"
    }`,
    borderRadius: 14,
    padding: theme.spacing.lg,
    height: "100%",
  },

  ipRow: {
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: 12,
    background: theme.colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.025)"
      : "rgba(0, 0, 0, 0.02)",
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.04)"
    }`,
  },
}));

const Users = () => {
  const { classes } = useStyles();
  const { user: currentUser, refreshUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("username");
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const loadedTabsRef = useRef<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteRequired, setInviteRequired] = useState(false);
  const [savingInviteSetting, setSavingInviteSetting] = useState(false);
  const [creatingInviteCode, setCreatingInviteCode] = useState(false);
  const [inviteCodeValue, setInviteCodeValue] = useState("");
  const [inviteDescription, setInviteDescription] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState<number | "">("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("");
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupShareLimitGb, setGroupShareLimitGb] = useState<number | "">("");
  const [groupRoleDrafts, setGroupRoleDrafts] = useState<Record<string, "member" | "leader">>({});
  const [groupUserDrafts, setGroupUserDrafts] = useState<Record<string, string | null>>({});
  const [groupNameDrafts, setGroupNameDrafts] = useState<Record<string, string>>({});
  const [groupLimitDrafts, setGroupLimitDrafts] = useState<Record<string, number | "">>({});
  const [savingGroupIds, setSavingGroupIds] = useState<Record<string, boolean>>({});
  const [updatingMemberIds, setUpdatingMemberIds] = useState<Record<string, boolean>>({});
  const [activityUsers, setActivityUsers] = useState<UserActivitySummaryUser[]>([]);
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [banIp, setBanIp] = useState("");
  const [banNote, setBanNote] = useState("");
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);

  const config = useConfig();
  const modals = useModals();
  const t = useTranslate();

  const getUsers = () => {
    setIsLoading(true);
    Promise.all([
      userService.list(),
      userService.getUploadLimitRequests().catch(() => ({ data: [] }))
    ]).then(([usersData, requestsData]) => {
      const usersWithRequests = usersData.map((user: any) => {
        const request = requestsData.data.find((r: any) => r.userId === user.id);
        return { 
          ...user, 
          uploadLimitRequest: request ? {
            requestedLimit: request.requestedLimit,
            reason: request.reason,
            createdAt: request.createdAt
          } : undefined
        };
      });
      setUsers(usersWithRequests);
      setIsLoading(false);
    }).catch(() => {
      userService.list().then((users) => {
        setUsers(users);
        setIsLoading(false);
      });
    });
  };

  const getInviteCodes = async () => {
    setInviteLoading(true);
    try {
      const inviteData = await userService.listInviteCodes();
      setInviteCodes(inviteData);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setInviteLoading(false);
    }
  };

  const getGroups = async () => {
    setGroupsLoading(true);
    try {
      const data = await userService.listGroups();
      setGroups(data);
      setGroupNameDrafts(
        Object.fromEntries(data.map((group) => [group.id, group.name])),
      );
      setGroupLimitDrafts(
        Object.fromEntries(
          data.map((group) => [
            group.id,
            group.shareSizeLimit
              ? Math.round(Number(group.shareSizeLimit) / 1024 / 1024 / 1024)
              : "",
          ]),
        ),
      );
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setGroupsLoading(false);
    }
  };

  const getActivitySummary = async () => {
    setActivityLoading(true);
    try {
      const activityData = await userService.getUserActivitySummary();
      setActivityUsers(activityData.users);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setActivityLoading(false);
    }
    if (hasCapability(currentUser, "security.manage")) {
      try {
        setBlockedIps(await userService.listBlockedIps());
      } catch {
      }
    }
  };

  const syncInviteRequirement = () => {
    try {
      setInviteRequired(config.get("share.requireInviteCodeForRegistration"));
    } catch {
      setInviteRequired(false);
    }
  };

  const handleInviteRequirementToggle = async (checked: boolean) => {
    setSavingInviteSetting(true);
    try {
      await configService.updateMany([
        {
          key: "share.requireInviteCodeForRegistration",
          value: checked,
        },
      ]);
      await config.refresh();
      setInviteRequired(checked);
      toast.success(
        checked
          ? "Invite-only registration enabled"
          : "Invite-only registration disabled",
      );
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSavingInviteSetting(false);
    }
  };

  const handleCreateInviteCode = async () => {
    setCreatingInviteCode(true);
    try {
      const created = await userService.createInviteCode({
        code: inviteCodeValue.trim() || undefined,
        description: inviteDescription.trim() || undefined,
        maxUses: inviteMaxUses === "" ? null : Number(inviteMaxUses),
        expiresAt: inviteExpiresAt || null,
        groupId: inviteGroupId || null,
      });
      setInviteCodes((current) => [created, ...current]);
      setInviteCodeValue("");
      setInviteDescription("");
      setInviteMaxUses("");
      setInviteExpiresAt("");
      setInviteGroupId(null);
      toast.success(`Invite code ${created.code} created`);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setCreatingInviteCode(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Enter a group name");
      return;
    }

    setCreatingGroup(true);
    try {
      const payload: CreateUserGroup = {
        name: groupName.trim(),
        shareSizeLimit:
          groupShareLimitGb === ""
            ? null
            : String(Math.round(Number(groupShareLimitGb) * 1024 * 1024 * 1024)),
      };
      const created = await userService.createGroup(payload);
      setGroups((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setGroupNameDrafts((current) => ({ ...current, [created.id]: created.name }));
      setGroupLimitDrafts((current) => ({
        ...current,
        [created.id]: created.shareSizeLimit
          ? Math.round(Number(created.shareSizeLimit) / 1024 / 1024 / 1024)
          : "",
      }));
      setGroupName("");
      setGroupShareLimitGb("");
      toast.success(`Group ${created.name} created`);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAssignGroupMember = async (group: UserGroup) => {
    const userId = groupUserDrafts[group.id];
    const role = groupRoleDrafts[group.id] || "member";

    if (!userId) {
      toast.error("Select a user to add");
      return;
    }

    try {
      const updated = await userService.upsertGroupMembership(group.id, {
        userId,
        role,
      });
      setGroups((current) => current.map((entry) => (entry.id === group.id ? updated : entry)));
      await getUsers();
      if (currentUser?.id === userId) {
        await refreshUser();
      }
      setGroupUserDrafts((current) => ({ ...current, [group.id]: null }));
      toast.success("Group membership updated");
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const handleUpdateGroup = async (group: UserGroup) => {
    const nextName = (groupNameDrafts[group.id] || "").trim();
    const nextLimitDraft = groupLimitDrafts[group.id];

    if (!nextName) {
      toast.error("Enter a group name");
      return;
    }

    const currentLimitGb = group.shareSizeLimit
      ? Math.round(Number(group.shareSizeLimit) / 1024 / 1024 / 1024)
      : "";
    const limitChanged = nextLimitDraft !== currentLimitGb;
    const nextLimitValue =
      nextLimitDraft === "" ? null : String(Math.round(Number(nextLimitDraft) * 1024 * 1024 * 1024));

    if (nextName === group.name && !limitChanged) {
      toast.error("No group changes to save");
      return;
    }

    setSavingGroupIds((current) => ({ ...current, [group.id]: true }));
    try {
      const updated = await userService.updateGroup(group.id, {
        name: nextName,
        ...(limitChanged ? { shareSizeLimit: nextLimitValue } : {}),
      });
      setGroups((current) =>
        current.map((entry) => (entry.id === group.id ? updated : entry)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setGroupNameDrafts((current) => ({ ...current, [group.id]: updated.name }));
      setGroupLimitDrafts((current) => ({
        ...current,
        [group.id]: updated.shareSizeLimit
          ? Math.round(Number(updated.shareSizeLimit) / 1024 / 1024 / 1024)
          : "",
      }));
      toast.success(`Updated ${updated.name}`);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSavingGroupIds((current) => ({ ...current, [group.id]: false }));
    }
  };

  const handleUpdateGroupMemberRole = async (
    group: UserGroup,
    member: UserGroup["members"][number],
    role: "member" | "leader",
  ) => {
    const stateKey = `${group.id}:${member.userId}`;
    setUpdatingMemberIds((current) => ({ ...current, [stateKey]: true }));
    try {
      const updated = await userService.upsertGroupMembership(group.id, {
        userId: member.userId,
        role,
      });
      setGroups((current) => current.map((entry) => (entry.id === group.id ? updated : entry)));
      await getUsers();
      if (currentUser?.id === member.userId) {
        await refreshUser();
      }
      toast.success("Group role updated");
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setUpdatingMemberIds((current) => ({ ...current, [stateKey]: false }));
    }
  };

  const handleRemoveGroupMember = async (group: UserGroup, userId: string) => {
    try {
      await userService.removeGroupMembership(userId, group.id);
      setGroups((current) =>
        current.map((entry) =>
          entry.id === group.id
            ? { ...entry, members: entry.members.filter((member) => member.userId !== userId) }
            : entry,
        ),
      );
      await getUsers();
      if (currentUser?.id === userId) {
        await refreshUser();
      }
      toast.success("Removed user from group");
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const handleDeleteGroup = (group: UserGroup) => {
    modals.openConfirmModal({
      title: `Delete ${group.name}?`,
      children: (
        <Text size="sm">
          This removes the group assignment from all members and unlinks future invite code assignment.
        </Text>
      ),
      labels: {
        confirm: "Delete group",
        cancel: "Cancel",
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await userService.deleteGroup(group.id);
          setGroups((current) => current.filter((entry) => entry.id !== group.id));
          await getUsers();
          if (getUserGroupMemberships(currentUser).some((membership) => membership.group.id === group.id)) {
            await refreshUser();
          }
          toast.success(`Deleted ${group.name}`);
        } catch (error) {
          toast.axiosError(error);
        }
      },
    });
  };

  const handleToggleInviteCode = async (inviteCode: InviteCode) => {
    try {
      const updated = await userService.updateInviteCode(inviteCode.id, {
        isActive: !inviteCode.isActive,
      });
      setInviteCodes((current) =>
        current.map((entry) => (entry.id === inviteCode.id ? updated : entry)),
      );
      toast.success(
        updated.isActive
          ? `Invite code ${updated.code} re-enabled`
          : `Invite code ${updated.code} disabled`,
      );
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const handleDeleteInviteCode = (inviteCode: InviteCode) => {
    modals.openConfirmModal({
      title: `Delete invite code ${inviteCode.code}?`,
      children: (
        <Text size="sm">
          This removes the code permanently. Existing accounts created with it will stay intact.
        </Text>
      ),
      labels: {
        confirm: "Delete code",
        cancel: "Cancel",
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await userService.deleteInviteCode(inviteCode.id);
          setInviteCodes((current) =>
            current.filter((entry) => entry.id !== inviteCode.id),
          );
          toast.success(`Invite code ${inviteCode.code} deleted`);
        } catch (error) {
          toast.axiosError(error);
        }
      },
    });
  };

  const copyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}`);
    } catch {
      toast.error("Could not copy invite code");
    }
  };

  const handleCreateBlockedIp = async () => {
    if (!banIp.trim()) {
      toast.error("Enter an IP address to block");
      return;
    }

    setIsSubmittingBan(true);
    try {
      const created = await userService.createBlockedIp({
        ipAddress: banIp.trim(),
        note: banNote.trim() || undefined,
      });
      setBlockedIps((current) => [created, ...current]);
      setBanIp("");
      setBanNote("");
      toast.success(`Blocked ${created.ipAddress}`);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setIsSubmittingBan(false);
    }
  };

  const handleDeleteBlockedIp = async (blockedIp: BlockedIp) => {
    try {
      await userService.deleteBlockedIp(blockedIp.id);
      setBlockedIps((current) =>
        current.filter((entry) => entry.id !== blockedIp.id),
      );
      toast.success(`Removed block for ${blockedIp.ipAddress}`);
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const handleApproveRequest = async (userId: string) => {
    try {
      await userService.approveUploadLimitRequest(userId);
      toast.success("Upload limit request approved successfully");
      getUsers();
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const handleDeclineRequest = async (userId: string) => {
    try {
      await userService.declineUploadLimitRequest(userId);
      toast.success("Upload limit request declined");
      getUsers();
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const deleteUser = (user: User) => {
    modals.openConfirmModal({
      title: t("admin.users.edit.delete.title", {
        username: user.username,
      }),
      children: (
        <Text size="sm">
          <FormattedMessage id="admin.users.edit.delete.description" />
        </Text>
      ),
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        userService
          .remove(user.id)
          .then(() => {
            setUsers(users.filter((v) => v.id != user.id));
          })
          .catch(toast.axiosError);
      },
    });
  };

  const canViewAccounts = hasCapability(currentUser, "users.view");
  const canManageGroups = hasCapability(currentUser, "groups.manage");
  const canManageInvites = hasCapability(currentUser, "invites.manage");
  const canViewSecurity = hasCapability(currentUser, "security.view");

  const firstAvailableTab = canViewAccounts
    ? "accounts"
    : canManageGroups
      ? "groups"
      : canManageInvites
        ? "invites"
        : canViewSecurity
          ? "security"
          : "accounts";
  const currentTab = activeTab ?? firstAvailableTab;

  useEffect(() => {
    if (!currentUser) return;
    const tab = currentTab;
    if (loadedTabsRef.current.has(tab)) return;
    loadedTabsRef.current.add(tab);
    if (tab === "accounts" && canViewAccounts) getUsers();
    else if (tab === "groups" && canManageGroups) getGroups();
    else if (tab === "invites" && canManageInvites) getInviteCodes();
    else if (tab === "security" && canViewSecurity) getActivitySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentTab]);

  useEffect(() => {
    if (currentUser?.isAdmin) syncInviteRequirement();
  }, [currentUser?.isAdmin]);

  const adminCount = users.filter((u) => u.isAdmin).length;
  const managerCount = users.filter((u) => u.role === "manager").length;
  const activeInviteCodes = inviteCodes.filter((code) => code.isActive).length;
  const groupOptions = groups.map((group) => ({
    value: group.id,
    label: group.name,
  }));

  const isUserBanned = (u: User) =>
    !!u.bannedAt && (!u.bannedUntil || new Date(u.bannedUntil) > new Date());

  const displayedUsers = users
    .filter((u) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !u.username.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q)
        )
          return false;
      }
      if (
        roleFilter !== "all" &&
        (u.role ?? (u.isAdmin ? "admin" : "user")) !== roleFilter
      )
        return false;
      if (statusFilter === "banned" && !isUserBanned(u)) return false;
      if (statusFilter === "active" && isUserBanned(u)) return false;
      if (statusFilter === "noShares" && u.canCreateShares !== false)
        return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "email") return a.email.localeCompare(b.email);
      if (sortBy === "role") {
        const order: Record<string, number> = { admin: 0, manager: 1, user: 2 };
        const ra = order[a.role ?? (a.isAdmin ? "admin" : "user")] ?? 3;
        const rb = order[b.role ?? (b.isAdmin ? "admin" : "user")] ?? 3;
        return ra - rb || a.username.localeCompare(b.username);
      }
      return a.username.localeCompare(b.username);
    });

  return (
    <>
      <Meta title={t("admin.users.title")} />
      <Box className={classes.wrapper}>
        <Tabs
          value={currentTab}
          onTabChange={setActiveTab}
          keepMounted={false}
          variant="outline"
          radius="md"
        >
          <Tabs.List mb="lg">
            {canViewAccounts && (
              <Tabs.Tab value="accounts" icon={<TbUsers size={16} />}>
                Accounts
              </Tabs.Tab>
            )}
            {canManageGroups && (
              <Tabs.Tab value="groups" icon={<TbUsers size={16} />}>
                Groups
              </Tabs.Tab>
            )}
            {canManageInvites && (
              <Tabs.Tab value="invites" icon={<TbTicket size={16} />}>
                Invite Codes
              </Tabs.Tab>
            )}
            {canViewSecurity && (
              <Tabs.Tab value="security" icon={<TbActivity size={16} />}>
                Security &amp; IP Bans
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="accounts">
        <Box className={classes.headerCard}>
          <div className={classes.headerContent}>
            <div>
              <div className={classes.titleSection}>
                <TbUsers size={32} className={classes.titleIcon} />
                <Title order={3} className={classes.title}>
                  <FormattedMessage id="admin.users.title" />
                </Title>
              </div>
              <Text className={classes.subtitle}>
                Manage user accounts, permissions, and settings
              </Text>
              <Group mt="md" spacing="xs" className={classes.statsRow}>
                <span className={classes.statsBadge}>
                  {users.length} total user{users.length !== 1 ? "s" : ""}
                </span>
                <span className={classes.adminBadge}>
                  {adminCount} admin{adminCount !== 1 ? "s" : ""}
                </span>
                <span className={classes.managerBadge}>
                  {managerCount} manager{managerCount !== 1 ? "s" : ""}
                </span>
              </Group>
            </div>

            <div className={classes.controls}>
              <TextInput
                placeholder="Search users..."
                icon={<TbSearch size={18} />}
                value={searchQuery}
                onChange={(e) => handleSearch(e.currentTarget.value)}
                className={classes.searchInput}
                rightSection={
                  searchQuery && (
                    <ActionIcon
                      size="sm"
                      variant="transparent"
                      onClick={() => handleSearch("")}
                    >
                      <TbX size={14} />
                    </ActionIcon>
                  )
                }
              />
              <Button
                onClick={() =>
                  showCreateUserModal(modals, config.get("smtp.enabled"), getUsers)
                }
                leftIcon={<TbPlus size={20} />}
                className={classes.createButton}
              >
                <FormattedMessage id="common.button.create" />
              </Button>
            </div>
          </div>

          <Group mt="lg" spacing="sm" align="flex-end">
            <Select
              size="sm"
              label="Role"
              value={roleFilter}
              onChange={(v) => setRoleFilter(v || "all")}
              data={[
                { value: "all", label: "All roles" },
                { value: "admin", label: "Admins" },
                { value: "manager", label: "Managers" },
                { value: "user", label: "Basic users" },
              ]}
              sx={{ width: 150 }}
            />
            <Select
              size="sm"
              label="Status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || "all")}
              data={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "banned", label: "Suspended" },
                { value: "noShares", label: "Sharing disabled" },
              ]}
              sx={{ width: 180 }}
            />
            <Select
              size="sm"
              label="Sort by"
              value={sortBy}
              onChange={(v) => setSortBy(v || "username")}
              data={[
                { value: "username", label: "Username" },
                { value: "email", label: "Email" },
                { value: "role", label: "Role" },
              ]}
              sx={{ width: 150 }}
            />
            <Text size="xs" color="dimmed" pb={8}>
              {displayedUsers.length} of {users.length} shown
            </Text>
          </Group>
        </Box>

        <Box className={classes.tableCard}>
          <ManageUserTable
            users={displayedUsers}
            getUsers={getUsers}
            deleteUser={deleteUser}
            isLoading={isLoading}
            onApproveRequest={handleApproveRequest}
            onDeclineRequest={handleDeclineRequest}
          />
        </Box>
          </Tabs.Panel>

          <Tabs.Panel value="groups">
        <Box className={classes.inviteCard}>
          <Group position="apart" align="flex-start">
            <div>
              <Group spacing="sm">
                <TbUsers size={24} className={classes.titleIcon} />
                <Title order={4}>User Groups</Title>
              </Group>
              <Text className={classes.subtitle} mt={6}>
                Group users together, apply a group share-size limit, and allow leaders to manage shared uploads.
              </Text>
              <Group mt="md" spacing="xs" className={classes.statsRow}>
                <span className={classes.statsBadge}>
                  {groups.length} total group{groups.length !== 1 ? "s" : ""}
                </span>
                <span className={classes.adminBadge}>
                  {groups.reduce((sum, group) => sum + group.members.length, 0)} memberships
                </span>
              </Group>
            </div>
          </Group>

          <div className={classes.inviteControls}>
            <div className={classes.inviteField}>
              <TextInput
                label="Group name"
                placeholder="Artists"
                value={groupName}
                onChange={(event) => setGroupName(event.currentTarget.value)}
              />
            </div>
            <div className={classes.inviteField}>
              <NumberInput
                label="Group share limit (GB)"
                placeholder="Optional"
                min={1}
                value={groupShareLimitGb}
                onChange={(value) =>
                  setGroupShareLimitGb(typeof value === "number" ? value : "")
                }
              />
            </div>
            <div className={classes.inviteButtonWrap}>
              <Button
                leftIcon={<TbPlus size={18} />}
                className={`${classes.createButton} ${classes.inviteGenerateButton}`}
                loading={creatingGroup}
                onClick={handleCreateGroup}
                fullWidth
              >
                Create Group
              </Button>
            </div>
          </div>

          {groupsLoading ? (
            <Text mt="lg" className={classes.inviteMuted}>
              Loading groups...
            </Text>
          ) : groups.length === 0 ? (
            <Paper withBorder p="md" mt="lg">
              <Text className={classes.inviteMuted}>
                No groups yet. Create one here to organize shared uploads and leader access.
              </Text>
            </Paper>
          ) : (
            <Stack spacing="md" mt="lg">
              {groups.map((group) => (
                <Paper withBorder p="md" key={group.id}>
                  <Group position="apart" align="flex-start" mb="sm">
                    <Group grow align="end">
                      <TextInput
                        label="Group name"
                        value={groupNameDrafts[group.id] ?? group.name}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setGroupNameDrafts((current) => ({
                            ...current,
                            [group.id]: value,
                          }));
                        }}
                      />
                      <NumberInput
                        label="Group share limit (GB)"
                        placeholder="Optional"
                        min={1}
                        value={
                          groupLimitDrafts[group.id] ??
                          (group.shareSizeLimit
                            ? Math.round(Number(group.shareSizeLimit) / 1024 / 1024 / 1024)
                            : "")
                        }
                        onChange={(value) =>
                          setGroupLimitDrafts((current) => ({
                            ...current,
                            [group.id]: typeof value === "number" ? value : "",
                          }))
                        }
                      />
                      <Button
                        onClick={() => handleUpdateGroup(group)}
                        loading={!!savingGroupIds[group.id]}
                      >
                        Save
                      </Button>
                    </Group>
                    <ActionIcon color="red" onClick={() => handleDeleteGroup(group)} mt={28}>
                      <TbTrash size={16} />
                    </ActionIcon>
                  </Group>

                  {group.members.length === 0 ? (
                    <Text size="sm" className={classes.inviteMuted} mb="sm">
                      No members yet.
                    </Text>
                  ) : (
                    <Stack spacing={8} mb="sm">
                      {group.members.map((member) => (
                        <Group key={member.id} position="apart" align="center">
                          <div>
                            <Text size="sm" weight={600}>
                              {member.username}
                            </Text>
                            <Text size="xs" className={classes.inviteMuted}>
                              {member.email}
                            </Text>
                          </div>
                          <Group spacing={8}>
                            <Select
                              data={[
                                { value: "member", label: "Standard user" },
                                { value: "leader", label: "Group leader" },
                              ]}
                              value={member.role}
                              onChange={(value) => {
                                const nextRole = (value as "member" | "leader" | null) || member.role;
                                if (nextRole !== member.role) {
                                  void handleUpdateGroupMemberRole(group, member, nextRole);
                                }
                              }}
                              withinPortal
                              zIndex={450}
                              styles={{ input: { minWidth: 160 } }}
                              disabled={!!updatingMemberIds[`${group.id}:${member.userId}`]}
                            />
                            <ActionIcon
                              color="red"
                              onClick={() => handleRemoveGroupMember(group, member.userId)}
                            >
                              <TbX size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      ))}
                    </Stack>
                  )}

                  <Group grow align="end">
                    <Select
                      label="Add user"
                      placeholder={
                        users.length === 0 ? "No users available" : "Select a user"
                      }
                      data={users
                        .filter(
                          (user) =>
                            !getUserGroupMemberships(user).some(
                              (membership) => membership.group.id === group.id,
                            ),
                        )
                        .map((user) => ({
                          value: user.id,
                          label: `${user.username} (${user.email})${
                            getUserGroupMemberships(user).length > 0
                              ? ` • ${getUserGroupMemberships(user)
                                  .map((membership) => membership.group.name)
                                  .join(", ")}`
                              : ""
                          }`,
                        }))}
                      value={groupUserDrafts[group.id] || null}
                      onChange={(value) =>
                        setGroupUserDrafts((current) => ({ ...current, [group.id]: value }))
                      }
                      searchable
                      withinPortal
                      zIndex={400}
                      nothingFound="No available users"
                    />
                    <Select
                      label="Role"
                      data={[
                        { value: "member", label: "Standard user" },
                        { value: "leader", label: "Group leader" },
                      ]}
                      value={groupRoleDrafts[group.id] || "member"}
                      onChange={(value) =>
                        setGroupRoleDrafts((current) => ({
                          ...current,
                          [group.id]: (value as "member" | "leader") || "member",
                        }))
                      }
                      withinPortal
                      zIndex={400}
                    />
                    <Button onClick={() => handleAssignGroupMember(group)}>
                      Add to group
                    </Button>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
          </Tabs.Panel>

          <Tabs.Panel value="invites">
        <Box className={classes.inviteCard}>
          <Group position="apart" align="flex-start">
            <div>
              <Group spacing="sm">
                <TbTicket size={24} className={classes.titleIcon} />
                <Title order={4}>Invite Codes</Title>
              </Group>
              <Text className={classes.subtitle} mt={6}>
                Control who can create a new account before they can upload.
              </Text>
              <Group mt="md" spacing="xs" className={classes.statsRow}>
                <span className={classes.statsBadge}>
                  {inviteCodes.length} total code{inviteCodes.length !== 1 ? "s" : ""}
                </span>
                <span className={classes.adminBadge}>
                  {activeInviteCodes} active
                </span>
                <span className={classes.statsBadge}>
                  <TbLock size={14} />
                  {inviteRequired ? "Invite-only on" : "Invite-only off"}
                </span>
              </Group>
            </div>

            {currentUser?.isAdmin && (
              <Switch
                checked={inviteRequired}
                onChange={(event) =>
                  handleInviteRequirementToggle(event.currentTarget.checked)
                }
                disabled={savingInviteSetting}
                label="Require invite code for public registration"
              />
            )}
          </Group>

          <div className={classes.inviteControls}>
            <div className={classes.inviteField}>
              <TextInput
                label="Custom code"
                placeholder="Leave blank to auto-generate"
                value={inviteCodeValue}
                onChange={(event) =>
                  setInviteCodeValue(event.currentTarget.value.toUpperCase())
                }
              />
            </div>
            <div className={classes.inviteField}>
              <TextInput
                label="Description"
                placeholder="Optional note"
                value={inviteDescription}
                onChange={(event) => setInviteDescription(event.currentTarget.value)}
              />
            </div>
            <div className={classes.inviteField}>
              <NumberInput
                label="Max uses"
                placeholder="Unlimited"
                min={1}
                value={inviteMaxUses}
                onChange={(value) =>
                  setInviteMaxUses(typeof value === "number" ? value : "")
                }
              />
            </div>
            <div className={classes.inviteField}>
              <TextInput
                label="Expires at"
                type="datetime-local"
                value={inviteExpiresAt}
                onChange={(event) => setInviteExpiresAt(event.currentTarget.value)}
              />
            </div>
            <div className={classes.inviteField}>
              <Select
                label="Assigned group"
                placeholder="Optional"
                data={groupOptions}
                value={inviteGroupId}
                onChange={setInviteGroupId}
                clearable
                withinPortal
                zIndex={400}
              />
            </div>
            <div className={classes.inviteButtonWrap}>
              <Button
                leftIcon={<TbPlus size={18} />}
                className={`${classes.createButton} ${classes.inviteGenerateButton}`}
                loading={creatingInviteCode}
                onClick={handleCreateInviteCode}
                fullWidth
              >
                Generate
              </Button>
            </div>
          </div>

          {inviteLoading ? (
            <Text mt="lg" className={classes.inviteMuted}>
              Loading invite codes...
            </Text>
          ) : inviteCodes.length === 0 ? (
            <Paper withBorder p="md" mt="lg">
              <Text className={classes.inviteMuted}>
                No invite codes yet. Generate one here, then send the code to anyone who should be allowed to register.
              </Text>
            </Paper>
          ) : (
            <Table className={classes.inviteTable}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Usage</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Group</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inviteCodes.map((inviteCode) => (
                  <tr key={inviteCode.id}>
                    <td>
                      <Text className={classes.inviteCodeText}>{inviteCode.code}</Text>
                      <Text size="xs" className={classes.inviteMuted}>
                        Created {new Date(inviteCode.createdAt).toLocaleString()}
                      </Text>
                    </td>
                    <td>
                      <Badge variant="light">
                        {inviteCode.useCount}
                        {inviteCode.maxUses ? ` / ${inviteCode.maxUses}` : " / unlimited"}
                      </Badge>
                    </td>
                    <td>
                      <Text size="sm">
                        {inviteCode.expiresAt
                          ? new Date(inviteCode.expiresAt).toLocaleString()
                          : "Never"}
                      </Text>
                    </td>
                    <td>
                      <Badge color={inviteCode.isActive ? "green" : "gray"} variant="light">
                        {inviteCode.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td>
                      <Text size="sm" className={classes.inviteMuted}>
                        {inviteCode.group?.name || "None"}
                      </Text>
                    </td>
                    <td>
                      <Text size="sm" className={classes.inviteMuted}>
                        {inviteCode.description || "No description"}
                      </Text>
                    </td>
                    <td>
                      <Group position="right" spacing={8}>
                        <ActionIcon onClick={() => copyInviteCode(inviteCode.code)}>
                          <TbCopy size={16} />
                        </ActionIcon>
                        <ActionIcon onClick={() => handleToggleInviteCode(inviteCode)}>
                          {inviteCode.isActive ? <TbX size={16} /> : <TbPlus size={16} />}
                        </ActionIcon>
                        <ActionIcon color="red" onClick={() => handleDeleteInviteCode(inviteCode)}>
                          <TbTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Box>
          </Tabs.Panel>

          <Tabs.Panel value="security">
        <Box className={classes.activityCard}>
          <Group position="apart" align="flex-start" mb="lg">
            <div>
              <Group spacing="sm">
                <TbActivity size={24} className={classes.titleIcon} />
                <Title order={4}>User Activity & IP Bans</Title>
              </Group>
              <Text className={classes.subtitle} mt={6}>
                Recent user-linked IP activity and exact IP bans are managed here for admins only.
              </Text>
            </div>
          </Group>

          <Group align="stretch" grow spacing="lg">
            <Box className={classes.sectionCard}>
              <Group position="apart" mb="md">
                <Title order={5}>User IP Activity</Title>
                <Badge variant="light" color="cyan">
                  Last 30 days
                </Badge>
              </Group>

              {activityLoading ? (
                <Text className={classes.inviteMuted}>Loading activity…</Text>
              ) : activityUsers.length === 0 ? (
                <Text className={classes.inviteMuted}>
                  No authenticated user IP activity has been logged yet.
                </Text>
              ) : (
                <Stack spacing="sm">
                  {activityUsers.map((activityUser) => (
                    <Box key={activityUser.userId} className={classes.ipRow}>
                      <Group position="apart" align="flex-start" mb={8}>
                        <div>
                          <Text weight={600}>{activityUser.username}</Text>
                          <Text size="xs" className={classes.inviteMuted}>
                            {activityUser.email}
                          </Text>
                        </div>
                        <Badge variant="light" color="green">
                          {activityUser.requests} requests
                        </Badge>
                      </Group>
                      <Text size="xs" className={classes.inviteMuted} mb={8}>
                        Last seen {new Date(activityUser.lastSeen).toLocaleString()}
                      </Text>
                      <Group spacing={6}>
                        {activityUser.ips.map((ip) => (
                          <Badge key={`${activityUser.userId}-${ip.ipAddress}`} variant="outline" color="gray">
                            {ip.ipAddress} · {ip.requests}
                          </Badge>
                        ))}
                      </Group>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Box className={classes.sectionCard}>
              <Group position="apart" mb="md">
                <Title order={5}>IP Ban Manager</Title>
                <Badge variant="light" color="red">
                  {blockedIps.length} blocked
                </Badge>
              </Group>

              <Group grow align="end" mb="md">
                <TextInput
                  label="IP address"
                  placeholder="203.0.113.42"
                  value={banIp}
                  onChange={(event) => setBanIp(event.currentTarget.value)}
                />
                <TextInput
                  label="Note"
                  placeholder="Optional reason"
                  value={banNote}
                  onChange={(event) => setBanNote(event.currentTarget.value)}
                />
                <Button
                  leftIcon={<TbShield size={16} />}
                  className={classes.createButton}
                  loading={isSubmittingBan}
                  onClick={handleCreateBlockedIp}
                >
                  Add IP Ban
                </Button>
              </Group>

              {blockedIps.length === 0 ? (
                <Text className={classes.inviteMuted}>No blocked IPs right now.</Text>
              ) : (
                <Stack spacing="sm">
                  {blockedIps.map((blockedIp) => (
                    <Box key={blockedIp.id} className={classes.ipRow}>
                      <Group position="apart" align="flex-start">
                        <div>
                          <Text weight={600}>{blockedIp.ipAddress}</Text>
                          <Text size="xs" className={classes.inviteMuted}>
                            {blockedIp.note || "No note"} · added{" "}
                            {new Date(blockedIp.createdAt).toLocaleString()}
                          </Text>
                        </div>
                        <ActionIcon
                          color="red"
                          onClick={() => handleDeleteBlockedIp(blockedIp)}
                        >
                          <TbTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Group>
        </Box>
          </Tabs.Panel>
        </Tabs>
      </Box>
      <Space h="xl" />
    </>
  );
};

export default Users;
