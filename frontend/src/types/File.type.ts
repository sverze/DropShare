export type LyricsAttachment = {
  text: string;
  source: "manual" | "text-file" | "genius-link" | "genius-search";
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  syncEnabled?: boolean;
  syncedAt?: string | null;
  syncStatus?: string | null;
  syncError?: string | null;
};

export type FileUpload = File & {
  uploadingProgress: number;
  uploadedBytes?: number;
  uploadError?: string;
  editableName?: string;
  relativePathOverride?: string;
  lyrics?: LyricsAttachment | null;
  order?: number;
  previewGroup?: boolean;
  previewHeader?: string | null;
};

export type FileUploadResponse = { id: string; name: string };

export type FileMetaData = {
  id: string;
  name: string;
  size: string;
  order?: number;
  previewGroup?: boolean;
  previewHeader?: string | null;
  relativePath?: string | null;
  editableName?: string;
  relativePathOverride?: string | null;
  lyricsText?: string | null;
  lyricsSource?: string | null;
  lyricsSourceUrl?: string | null;
  lyricsSyncEnabled?: boolean;
  lyricsSyncedAt?: string | null;
  lyricsSyncStatus?: string | null;
  lyricsSyncError?: string | null;
  virusScanStatus?:
    | "not_scanned"
    | "scanning"
    | "clean"
    | "infected"
    | "too_large"
    | "failed";
  virusScanStartedAt?: string | null;
  virusScanCompletedAt?: string | null;
  virusScanThreats?: string | null;
  virusScanError?: string | null;
};

export type FileListItem = FileUpload | (FileMetaData & { deleted?: boolean });
