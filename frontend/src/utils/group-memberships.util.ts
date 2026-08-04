import { UserGroupMembership } from "../types/user.type";

type UserWithGroupMemberships = {
  groupMembership?: UserGroupMembership | null;
  groupMemberships?: UserGroupMembership[];
};

export const getUserGroupMemberships = (
  user?: UserWithGroupMemberships | null,
): UserGroupMembership[] => {
  const memberships = user?.groupMemberships?.length
    ? user.groupMemberships
    : user?.groupMembership
    ? [user.groupMembership]
    : [];

  const seenGroupIds = new Set<string>();

  return memberships.filter((membership) => {
    const groupId = membership.group?.id;
    if (!groupId || seenGroupIds.has(groupId)) {
      return false;
    }

    seenGroupIds.add(groupId);
    return true;
  });
};

export const getLeaderGroupMemberships = (
  user?: UserWithGroupMemberships | null,
): UserGroupMembership[] =>
  getUserGroupMemberships(user).filter((membership) => membership.role === "leader");
