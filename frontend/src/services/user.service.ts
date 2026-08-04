import User, {
  BlockedIp,
  CreateUserGroup,
  CreateInviteCode,
  CreateUser,
  CurrentUser,
  InviteCode,
  UpdateUserGroup,
  UserGroup,
  UserShareThemeColor,
  UserActivitySummary,
  UpdateCurrentUser,
  UpdateInviteCode,
  UpdateUser,
  UpdateManagedGroupMemberPermissions,
} from "../types/user.type";
import api from "./api.service";
import authService from "./auth.service";

const list = async () => {
  return (await api.get("/users")).data;
};

const create = async (user: CreateUser) => {
  return (await api.post("/users", user)).data;
};

const update = async (id: string, user: UpdateUser) => {
  return (await api.patch(`/users/${id}`, user)).data;
};

const updateUser = async (
  id: string,
  data: {
    maxFileSizeOverride?: number;
    isAdmin?: boolean;
    role?: string;
    username?: string;
    email?: string;
    password?: string;
  },
) => {
  return (await api.patch(`/users/${id}`, data)).data;
};

const remove = async (id: string) => {
  await api.delete(`/users/${id}`);
};

const banUser = async (
  id: string,
  payload: {
    duration: "7d" | "2w" | "permanent" | "custom";
    customDays?: number;
    reason?: string;
    banIps?: boolean;
  },
): Promise<{ user: User; bannedIpCount: number }> => {
  return (await api.post(`/users/${id}/ban`, payload)).data;
};

const unbanUser = async (
  id: string,
): Promise<{ user: User; liftedIpCount: number }> => {
  return (await api.post(`/users/${id}/unban`)).data;
};

const forceLogoutUser = async (
  id: string,
): Promise<{ success: boolean; revokedSessions: number }> => {
  return (await api.post(`/users/${id}/force-logout`)).data;
};

const updateCurrentUser = async (user: UpdateCurrentUser) => {
  return (await api.patch("/users/me", user)).data;
};

const redeemInviteCode = async (inviteCode: string): Promise<CurrentUser> => {
  return (await api.post("/users/me/redeem-invite", { inviteCode })).data;
};

const removeCurrentUser = async () => {
  await api.delete("/users/me");
};

const getCurrentUser = async (): Promise<CurrentUser | null> => {
  try {
    await authService.refreshAccessToken();
    return (await api.get("users/me")).data;
  } catch {
    return null;
  }
};

const uploadAvatar = async (formData: FormData) => {
  return api.post("/users/me/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

const deleteAvatar = async () => {
  return api.delete("/users/me/avatar");
};

const adminReset2FA = async (userId: string) => {
  return (await api.post(`/auth/totp/admin-reset/${userId}`)).data;
};

const getUploadLimitRequest = async () => {
  return api.get(`/user/upload-limit-request`);
};

const createUploadLimitRequest = async (data: { 
  requestedLimit: number; 
  reason: string 
}) => {
  return api.post(`/user/upload-limit-request`, data);
};

const cancelUploadLimitRequest = async () => {
  return api.delete(`/user/upload-limit-request`);
};

const getUploadLimitRequests = async () => {
  return api.get(`/admin/users/upload-limit-requests`);
};

const approveUploadLimitRequest = async (userId: string) => {
  return api.post(`/admin/users/${userId}/upload-limit-request/approve`);
};

const declineUploadLimitRequest = async (userId: string) => {
  return api.post(`/admin/users/${userId}/upload-limit-request/decline`);
};

const listInviteCodes = async (): Promise<InviteCode[]> => {
  return (await api.get("/users/invite-codes/all")).data;
};

const listGroups = async (): Promise<UserGroup[]> => {
  return (await api.get("/users/groups")).data;
};

const createGroup = async (group: CreateUserGroup): Promise<UserGroup> => {
  return (await api.post("/users/groups", group)).data;
};

const updateGroup = async (
  id: string,
  group: UpdateUserGroup,
): Promise<UserGroup> => {
  return (await api.patch(`/users/groups/${id}`, group)).data;
};

const deleteGroup = async (id: string): Promise<UserGroup> => {
  return (await api.delete(`/users/groups/${id}`)).data;
};

const upsertGroupMembership = async (
  groupId: string,
  payload: { userId: string; role: "member" | "leader" },
): Promise<UserGroup> => {
  return (await api.put(`/users/groups/${groupId}/members`, payload)).data;
};

const removeGroupMembership = async (userId: string, groupId?: string) => {
  return (
    await api.delete(
      groupId ? `/users/groups/${groupId}/members/${userId}` : `/users/groups/members/${userId}`,
    )
  ).data;
};

const getOwnManagedGroup = async (): Promise<UserGroup> => {
  return (await api.get("/users/me/group/manage")).data;
};

const listOwnManagedGroups = async (): Promise<UserGroup[]> => {
  return (await api.get("/users/me/groups/manage")).data;
};

const updateOwnManagedGroupMemberPermissions = async (
  groupId: string,
  userId: string,
  payload: UpdateManagedGroupMemberPermissions,
): Promise<UserGroup> => {
  return (await api.patch(`/users/me/groups/${groupId}/members/${userId}`, payload)).data;
};

const removeOwnManagedGroupMember = async (
  groupId: string,
  userId: string,
): Promise<UserGroup> => {
  return (await api.delete(`/users/me/groups/${groupId}/members/${userId}`)).data;
};

const createInviteCode = async (inviteCode: CreateInviteCode): Promise<InviteCode> => {
  return (await api.post("/users/invite-codes", inviteCode)).data;
};

const updateInviteCode = async (
  id: string,
  inviteCode: UpdateInviteCode,
): Promise<InviteCode> => {
  return (await api.patch(`/users/invite-codes/${id}`, inviteCode)).data;
};

const deleteInviteCode = async (id: string) => {
  return (await api.delete(`/users/invite-codes/${id}`)).data;
};

const getUserActivitySummary = async (): Promise<UserActivitySummary> => {
  return (await api.get("/users/admin/activity-summary")).data;
};

const listBlockedIps = async (): Promise<BlockedIp[]> => {
  return (await api.get("/users/admin/ip-bans")).data;
};

const createBlockedIp = async (payload: {
  ipAddress: string;
  note?: string;
}): Promise<BlockedIp> => {
  return (await api.post("/users/admin/ip-bans", payload)).data;
};

const deleteBlockedIp = async (id: string) => {
  return (await api.delete(`/users/admin/ip-bans/${id}`)).data;
};

const listOwnShareThemeColors = async (): Promise<UserShareThemeColor[]> => {
  await authService.refreshAccessToken();
  return (await api.get("/users/me/share-theme-colors")).data;
};

const createOwnShareThemeColor = async (payload: {
  name: string;
  color: string;
}): Promise<UserShareThemeColor> => {
  await authService.refreshAccessToken();
  return (await api.post("/users/me/share-theme-colors", payload)).data;
};

const deleteOwnShareThemeColor = async (id: string): Promise<UserShareThemeColor> => {
  await authService.refreshAccessToken();
  return (await api.delete(`/users/me/share-theme-colors/${id}`)).data;
};

export default {
  list,
  create,
  update,
  updateUser,
  remove,
  banUser,
  unbanUser,
  forceLogoutUser,
  getCurrentUser,
  updateCurrentUser,
  redeemInviteCode,
  removeCurrentUser,
  uploadAvatar,
  deleteAvatar,
  adminReset2FA,
  getUploadLimitRequest,
  createUploadLimitRequest,
  cancelUploadLimitRequest,
  getUploadLimitRequests,
  approveUploadLimitRequest,
  declineUploadLimitRequest,
  listInviteCodes,
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  upsertGroupMembership,
  removeGroupMembership,
  getOwnManagedGroup,
  listOwnManagedGroups,
  updateOwnManagedGroupMemberPermissions,
  removeOwnManagedGroupMember,
  createInviteCode,
  updateInviteCode,
  deleteInviteCode,
  getUserActivitySummary,
  listBlockedIps,
  createBlockedIp,
  deleteBlockedIp,
  listOwnShareThemeColors,
  createOwnShareThemeColor,
  deleteOwnShareThemeColor,
};
