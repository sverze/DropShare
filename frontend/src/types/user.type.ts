export type AccessLevel = "admin" | "manager" | "user";

export default interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  protected?: boolean;
  role?: AccessLevel;
  capabilities?: string[];
  canCreateShares: boolean;
  avatar: string | null;
  theme: string;
  isLdap: boolean;
  totpVerified: boolean;
  hasPasskeys?: boolean;
  hasPassword?: boolean;
  maxFileSizeOverride?: string;
  bannedAt?: string | null;
  bannedUntil?: string | null;
  banReason?: string | null;
  groupMembership?: UserGroupMembership | null;
  groupMemberships?: UserGroupMembership[];
}

export type UserGroupMember = {
  id: string;
  role: "member" | "leader";
  userId: string;
  username: string;
  email: string;
  allowEditShares: boolean;
  canEditShareThemeColor: boolean;
  canEditShareName: boolean;
  canEditShareDescription: boolean;
  canEditShareFileOrder: boolean;
  canAddFiles: boolean;
  canRemoveFiles: boolean;
};

export type UserGroup = {
  id: string;
  name: string;
  shareSizeLimit: string | null;
  members: UserGroupMember[];
};

export type UserGroupMembership = {
  id: string;
  role: "member" | "leader";
  allowEditShares: boolean;
  canEditShareThemeColor: boolean;
  canEditShareName: boolean;
  canEditShareDescription: boolean;
  canEditShareFileOrder: boolean;
  canAddFiles: boolean;
  canRemoveFiles: boolean;
  group: UserGroup;
};

export type UpdateManagedGroupMemberPermissions = {
  allowEditShares?: boolean;
  canEditShareThemeColor?: boolean;
  canEditShareName?: boolean;
  canEditShareDescription?: boolean;
  canEditShareFileOrder?: boolean;
  canAddFiles?: boolean;
  canRemoveFiles?: boolean;
};

export type InviteCode = {
  id: string;
  code: string;
  description: string | null;
  isActive: boolean;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    username: string;
    email: string;
  } | null;
  group?: UserGroup | null;
};

export type BlockedIp = {
  id: string;
  ipAddress: string;
  note?: string | null;
  createdAt: string;
};

export type UserActivityIp = {
  ipAddress: string;
  requests: number;
  lastSeen: string;
};

export type UserActivitySummaryUser = {
  userId: string;
  username: string;
  email: string;
  requests: number;
  lastSeen: string;
  ips: UserActivityIp[];
};

export type UserActivitySummary = {
  users: UserActivitySummaryUser[];
};

export type UserShareThemeColor = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  protected?: boolean;
  role?: AccessLevel;
  capabilities?: string[];
  canCreateShares: boolean;
  avatar: string | null;
  theme: string;
  totpVerified: boolean;
  hasPasskeys?: boolean;
  hasPassword: boolean;
  isLdap: boolean;
  maxFileSizeOverride: string | null;
  shareThemeColors: UserShareThemeColor[];
  groupMembership?: UserGroupMembership | null;
  groupMemberships?: UserGroupMembership[];
};

export type CreateUser = {
  username: string;
  email: string;
  password?: string;
  isAdmin?: boolean;
  role?: AccessLevel;
  maxFileSizeOverride?: string | null;
};

export type CreateInviteCode = {
  code?: string;
  description?: string;
  maxUses?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
  groupId?: string | null;
};

export type UpdateInviteCode = {
  description?: string | null;
  maxUses?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
  groupId?: string | null;
};

export type CreateUserGroup = {
  name: string;
  shareSizeLimit?: string | null;
};

export type UpdateUserGroup = {
  name?: string;
  shareSizeLimit?: string | null;
};

export type UpdateUser = {
  username?: string;
  email?: string;
  password?: string;
  isAdmin?: boolean;
  protected?: boolean;
  theme?: string;
  maxFileSizeOverride?: string | null;
};

export type UpdateCurrentUser = {
  username?: string;
  email?: string;
  theme?: string;
};

export type UserHook = {
  user: CurrentUser | null;
  refreshUser: () => Promise<CurrentUser | null>;
};
