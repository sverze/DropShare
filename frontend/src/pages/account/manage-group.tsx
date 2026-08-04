import {
  ActionIcon,
  Badge,
  Box,
  Center,
  createStyles,
  Divider,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useEffect, useMemo, useState } from "react";
import { TbTrash, TbUsers } from "react-icons/tb";
import Meta from "../../components/Meta";
import useUser from "../../hooks/user.hook";
import userService from "../../services/user.service";
import {
  UpdateManagedGroupMemberPermissions,
  UserGroup,
  UserGroupMember,
} from "../../types/user.type";
import { getLeaderGroupMemberships } from "../../utils/group-memberships.util";
import toast from "../../utils/toast.util";

const useStyles = createStyles((theme) => ({
  pageWrapper: {
    position: "relative",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },

  statCard: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.72 : 0.88})`,
    backdropFilter: "blur(12px)",
    borderRadius: 18,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.12 : 0.14})`,
    padding: theme.spacing.lg,
  },

  statLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: theme.colorScheme === "dark" ? theme.colors.gray[5] : theme.colors.gray[6],
  },

  statValue: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.1,
  },

  panel: {
    background:
      `rgba(var(--ls-panel-bg-rgb), ${theme.colorScheme === "dark" ? 0.6 : 0.85})`,
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid rgba(var(--ls-panel-border-rgb), ${theme.colorScheme === "dark" ? 0.1 : 0.15})`,
    padding: theme.spacing.lg,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 24px rgba(0, 0, 0, 0.3)"
        : "0 4px 24px rgba(0, 0, 0, 0.06)",
  },

  memberCard: {
    borderRadius: 14,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.08)"
    }`,
    background:
      theme.colorScheme === "dark"
        ? "rgba(255,255,255,0.025)"
        : "rgba(0,0,0,0.02)",
    padding: theme.spacing.md,
  },

  permissionGrid: {
    gap: theme.spacing.sm,
  },
}));

const PERMISSION_FIELDS: Array<{
  key: keyof UpdateManagedGroupMemberPermissions;
  label: string;
}> = [
  { key: "canEditShareThemeColor", label: "Edit share theme color" },
  { key: "canEditShareName", label: "Edit share name" },
  { key: "canEditShareDescription", label: "Edit share description" },
  { key: "canEditShareFileOrder", label: "Edit share file order" },
  { key: "canAddFiles", label: "Add files" },
  { key: "canRemoveFiles", label: "Remove files" },
];

const StatsCard = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => {
  const { classes } = useStyles();

  return (
    <Box className={classes.statCard}>
      <Text className={classes.statLabel}>{label}</Text>
      <Text className={classes.statValue}>{value}</Text>
    </Box>
  );
};

const ManageGroup = () => {
  const { classes } = useStyles();
  const { user, refreshUser } = useUser();
  const modals = useModals();

  const [group, setGroup] = useState<UserGroup | null>(null);
  const [managedGroups, setManagedGroups] = useState<UserGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const isLeader = getLeaderGroupMemberships(user).length > 0;

  const loadGroup = async () => {
    if (!isLeader) {
      setGroup(null);
      setManagedGroups([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      await refreshUser();
      const groups = await userService.listOwnManagedGroups();
      setManagedGroups(groups);
      const nextSelectedGroupId =
        selectedGroupId && groups.some((candidate) => candidate.id === selectedGroupId)
          ? selectedGroupId
          : groups[0]?.id || null;
      setSelectedGroupId(nextSelectedGroupId);
      setGroup(groups.find((candidate) => candidate.id === nextSelectedGroupId) || null);
    } catch {
      toast.error("Failed to load group management");
      setGroup(null);
      setManagedGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadGroup();
  }, [isLeader, selectedGroupId]);

  const setCurrentManagedGroup = (groupId: string | null) => {
    setSelectedGroupId(groupId);
    setGroup(managedGroups.find((candidate) => candidate.id === groupId) || null);
  };

  const members = useMemo(() => group?.members || [], [group]);
  const leaders = members.filter((member) => member.role === "leader");
  const standardUsers = members.filter((member) => member.role !== "leader");

  const updateMemberPermissions = async (
    member: UserGroupMember,
    nextValues: UpdateManagedGroupMemberPermissions,
  ) => {
    if (!group) return;

    setUpdatingMemberId(member.userId);
    try {
      const nextGroup = await userService.updateOwnManagedGroupMemberPermissions(
        group.id,
        member.userId,
        nextValues,
      );
      setGroup(nextGroup);
      setManagedGroups((current) =>
        current.map((candidate) => (candidate.id === nextGroup.id ? nextGroup : candidate)),
      );
      await refreshUser();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to update group member permissions",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const removeMember = (member: UserGroupMember) => {
    if (!group) return;

    modals.openConfirmModal({
      title: "Remove group member",
      children: (
        <Text size="sm">
          Remove {member.username} from {group?.name}? They will lose access to group shares.
        </Text>
      ),
      labels: { confirm: "Remove user", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        setRemovingMemberId(member.userId);
        try {
          const nextGroup = await userService.removeOwnManagedGroupMember(group.id, member.userId);
          setGroup(nextGroup);
          setManagedGroups((current) =>
            current.map((candidate) => (candidate.id === nextGroup.id ? nextGroup : candidate)),
          );
          await refreshUser();
          toast.success("User removed from group");
        } catch (error: any) {
          toast.error(
            error?.response?.data?.message || "Failed to remove group member",
          );
        } finally {
          setRemovingMemberId(null);
        }
      },
    });
  };

  if (isLoading) {
    return (
      <>
        <Meta title="Manage Group" />
        <Center py={80}>
          <Loader />
        </Center>
      </>
    );
  }

  if (!isLeader || !group) {
    return (
      <>
        <Meta title="Manage Group" />
        <Box className={classes.pageWrapper}>
          <Paper className={classes.panel}>
            <Title order={2} mb="sm">
              Manage Group
            </Title>
            <Text color="dimmed">
              Only group leaders can manage group members and share edit permissions.
            </Text>
          </Paper>
        </Box>
      </>
    );
  }

  return (
    <>
      <Meta title="Manage Group" />
      <Box className={classes.pageWrapper}>
        <Box className={classes.header}>
          <Box>
            <Title order={2}>Manage Group</Title>
            <Text color="dimmed">
              Manage members and share editing permissions for {group.name}.
            </Text>
          </Box>
          {managedGroups.length > 1 ? (
            <Select
              label="Group"
              data={managedGroups.map((managedGroup) => ({
                value: managedGroup.id,
                label: managedGroup.name,
              }))}
              value={selectedGroupId}
              onChange={setCurrentManagedGroup}
              withinPortal
              sx={{ width: 240 }}
            />
          ) : null}
        </Box>

        <SimpleGrid cols={3} breakpoints={[{ maxWidth: "sm", cols: 1 }]} mb="lg">
          <StatsCard label="Group Name" value={group.name} />
          <StatsCard label="Total Members" value={members.length} />
          <StatsCard label="Standard Users" value={standardUsers.length} />
        </SimpleGrid>

        <Paper className={classes.panel}>
          <Group position="apart" mb="md">
            <Group spacing="xs">
              <TbUsers size={20} />
              <Title order={4}>Members</Title>
            </Group>
            <Badge variant="light" color="green">
              {leaders.length} leader{leaders.length === 1 ? "" : "s"}
            </Badge>
          </Group>

          <Stack spacing="md">
            {members.map((member) => {
              const isMemberLeader = member.role === "leader";
              const isCurrentUser = member.userId === user?.id;
              const canManageMember = !isMemberLeader && !isCurrentUser;
              const isUpdating = updatingMemberId === member.userId;
              const isRemoving = removingMemberId === member.userId;

              return (
                <Paper key={member.id} className={classes.memberCard}>
                  <Group position="apart" align="flex-start" mb="sm">
                    <Box>
                      <Group spacing="xs" mb={4}>
                        <Text weight={600}>{member.username}</Text>
                        <Badge color={isMemberLeader ? "yellow" : "blue"} variant="light">
                          {isMemberLeader ? "Group leader" : "Standard user"}
                        </Badge>
                      </Group>
                      <Text size="sm" color="dimmed">
                        {member.email}
                      </Text>
                    </Box>

                    {canManageMember ? (
                      <ActionIcon
                        color="red"
                        variant="light"
                        disabled={isRemoving}
                        onClick={() => removeMember(member)}
                      >
                        <TbTrash size={16} />
                      </ActionIcon>
                    ) : null}
                  </Group>

                  <Divider my="sm" />

                  <Switch
                    label="Allow edit shares"
                    checked={member.allowEditShares}
                    disabled={!canManageMember || isUpdating}
                    onChange={(event) =>
                      updateMemberPermissions(member, {
                        allowEditShares: event.currentTarget.checked,
                        ...(event.currentTarget.checked
                          ? {
                              canEditShareThemeColor: member.canEditShareThemeColor,
                              canEditShareName: member.canEditShareName,
                              canEditShareDescription: member.canEditShareDescription,
                              canEditShareFileOrder: member.canEditShareFileOrder,
                              canAddFiles: member.canAddFiles,
                              canRemoveFiles: member.canRemoveFiles,
                            }
                          : {
                              canEditShareThemeColor: false,
                              canEditShareName: false,
                              canEditShareDescription: false,
                              canEditShareFileOrder: false,
                              canAddFiles: false,
                              canRemoveFiles: false,
                            }),
                      })
                    }
                  />

                  {member.allowEditShares ? (
                    <SimpleGrid
                      cols={2}
                      breakpoints={[{ maxWidth: "sm", cols: 1 }]}
                      mt="md"
                      className={classes.permissionGrid}
                    >
                      {PERMISSION_FIELDS.map((permission) => (
                        <Switch
                          key={permission.key}
                          label={permission.label}
                          checked={Boolean(member[permission.key])}
                          disabled={!canManageMember || isUpdating}
                          onChange={(event) =>
                            updateMemberPermissions(member, {
                              allowEditShares: true,
                              [permission.key]: event.currentTarget.checked,
                            })
                          }
                        />
                      ))}
                    </SimpleGrid>
                  ) : null}
                </Paper>
              );
            })}
          </Stack>

          <Text size="sm" color="dimmed" mt="md">
            Group leaders can remove users and manage their share edit permissions here. Adding users still happens in the admin user groups section.
          </Text>
        </Paper>
      </Box>
    </>
  );
};

export default ManageGroup;
