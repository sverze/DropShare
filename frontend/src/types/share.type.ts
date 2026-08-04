import User from "./user.type";

export type ShareGroup = {
  id: string;
  name: string;
};

export type ShareVirusScanStatus =
  | "not_scanned"
  | "scanning"
  | "clean"
  | "infected"
  | "too_large"
  | "failed";

export type ShareVirusScan = {
  id: string;
  virusScanStatus: ShareVirusScanStatus;
  virusScanStartedAt?: string | null;
  virusScanCompletedAt?: string | null;
  virusScanThreats?: string[];
  virusScanError?: string | null;
  fileCount?: number;
};

export type Share = {
  id: string;
  name?: string;
  files: any;
  creator?: User;
  groupId?: string | null;
  group?: ShareGroup | null;
  description?: string;
  expiration: Date;
  size: number;
  hasPassword: boolean;
  views?: number;
  downloads?: number;
  accentColor?: string;
  previewStyle?: "full" | "consolidated";
  uploadLocked?: boolean;
  virusScanStatus?: ShareVirusScanStatus;
  virusScanStartedAt?: string | null;
  virusScanCompletedAt?: string | null;
  virusScanThreats?: string | null;
  virusScanError?: string | null;
  editablePermissions?: ShareEditablePermissions;
};

export type ShareEditablePermissions = {
  canAccessEditor: boolean;
  canEditShareThemeColor: boolean;
  canEditShareName: boolean;
  canEditShareDescription: boolean;
  canEditShareFileOrder: boolean;
  canAddFiles: boolean;
  canRemoveFiles: boolean;
};

export type CompletedShare = Share & {
  notifyReverseShareCreator: boolean | undefined;
};

export type CreateShare = {
  id: string;
  name?: string;
  description?: string;
  recipients: string[];
  expiration: string;
  security: ShareSecurity;
  accentColor?: string;
  previewStyle?: "full" | "consolidated";
  shareWithGroup?: boolean;
  groupId?: string | null;
};

export type ShareMetaData = {
  id: string;
  isZipReady: boolean;
  virusScanStatus?: ShareVirusScanStatus;
};

export type MyShare = Omit<Share, "hasPassword"> & {
  views: number;
  downloads: number;
  createdAt: Date;
  editedAt?: Date;
  security: MyShareSecurity;
  accentColor?: string;
  canEdit?: boolean;
};

export type MyShareStats = {
  totalShares: number;
  totalFiles: number;
  totalViews: number;
  totalDownloads: number;
  totalSize: number;
  uniqueVisitors30d: number;
};

export type MySharesDashboard = {
  shares: MyShare[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: MyShareStats;
};

export type MyReverseShare = {
  id: string;
  name: string | null;
  maxShareSize: string;
  shareExpiration: Date;
  remainingUses: number;
  maxUseCount: number | null;
  token: string;
  shares: MyShare[];
};

export type ShareSecurity = {
  maxViews?: number;
  password?: string;
};

export type MyShareSecurity = {
  passwordProtected: boolean;
  maxViews: number;
};
