import {
  Button,
  LoadingOverlay,
  Text,
  Box,
  createStyles,
  Badge,
  useMantineColorScheme,
  Group,
  Stack,
  TextInput,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { cleanNotifications } from "@mantine/notifications";
import moment from "moment";
import pLimit from "p-limit";
import { useEffect, useState, useMemo, useRef } from "react";
import { FormattedMessage } from "react-intl";
import {
  TbAlertTriangle,
  TbArrowUp,
  TbEye,
  TbTicket,
  TbUpload,
} from "react-icons/tb";
import Meta from "../../components/Meta";
import Dropzone from "../../components/upload/Dropzone";
import FileList from "../../components/upload/FileList";
import PreviewLayoutEditor from "../../components/upload/PreviewLayoutEditor";
import showCompletedUploadModal from "../../components/upload/modals/showCompletedUploadModal";
import showCreateUploadModal from "../../components/upload/modals/showCreateUploadModal";
import useConfig from "../../hooks/config.hook";
import useConfirmLeave from "../../hooks/confirm-leave.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import shareService from "../../services/share.service";
import userService from "../../services/user.service";
import { FileUpload } from "../../types/File.type";
import { CreateShare, Share } from "../../types/share.type";
import toast from "../../utils/toast.util";
import { useRouter } from "next/router";
import useSiteTheme from "../../theme/useSiteTheme";
import { getUserGroupMemberships } from "../../utils/group-memberships.util";
import { getBulkUploadMode } from "../../utils/bulk-upload-mode.util";
import {
  resolveChunkSize,
  uploadFileInChunks,
} from "../../utils/chunkedUpload.util";
import {
  BulkShareOptions,
  BulkUploadContext,
  downloadManifest,
  normalizeBulkOptions,
  uploadSingleFileAsShare,
} from "../../components/upload/bulk/bulkUpload.util";

const DEFAULT_MULTIPART_THRESHOLD = 50 * 1024 * 1024;
const DEFAULT_MULTIPART_PART_SIZE = 10 * 1024 * 1024;
const LARGE_FILE_MULTIPART_THRESHOLD = 2 * 1024 * 1024 * 1024;
const LARGE_FILE_MULTIPART_PART_SIZE = 128 * 1024 * 1024;
const MAX_CONCURRENT_PARTS = 8;
const SHARE_INVITE_REQUIRED_MESSAGE =
  "This account needs an invite code before it can create shares.";

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getErrorMessage = (error: unknown): string => {
  const maybeError = error as {
    response?: { data?: { message?: string | string[]; error?: string } };
    message?: string;
  };
  const message =
    maybeError?.response?.data?.message ??
    maybeError?.response?.data?.error ??
    maybeError?.message ??
    "";

  return Array.isArray(message) ? message.join(" ") : String(message);
};

const isShareInviteRequiredError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return (
    message.includes("invite code before it can create shares") ||
    message.includes(SHARE_INVITE_REQUIRED_MESSAGE)
  );
};

const formatTimespan = (timespan: { value: number; unit: string }): string => {
  if (!timespan || timespan.value === 0) return "unlimited";
  return moment
    .duration(
      timespan.value,
      timespan.unit as moment.unitOfTime.DurationConstructor,
    )
    .humanize();
};

let errorToastShown = false;
let createdShare: Share;

let globalUploadStart = 0;
let globalLastUpdate = { bytes: 0, time: 0 };

const useStyles = createStyles((theme) => ({
  shareButton: {
    minWidth: 98,
    height: 34,
    paddingLeft: 18,
    paddingRight: 18,
    borderRadius: 10,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-accent-rgb), 0.26)"
        : "rgba(22, 163, 74, 0.2)"
    }`,
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(135deg, rgba(var(--ls-accent-rgb), 0.18) 0%, rgba(var(--ls-accent-rgb), 0.32) 100%)"
        : "linear-gradient(135deg, rgba(34, 197, 94, 0.94) 0%, rgba(21, 128, 61, 0.96) 100%)",
    color: theme.colorScheme === "dark" ? "var(--ls-on-accent)" : "#f7fff9",
    fontWeight: 700,
    fontSize: 16,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 0 24px rgba(var(--ls-accent-rgb), 0.18), 0 10px 24px rgba(0, 0, 0, 0.32)"
        : "0 10px 24px rgba(34, 197, 94, 0.16)",
    transition: "all 0.2s ease",

    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow:
        theme.colorScheme === "dark"
          ? "0 0 32px rgba(var(--ls-accent-rgb), 0.28), 0 14px 28px rgba(0, 0, 0, 0.38)"
          : "0 14px 28px rgba(34, 197, 94, 0.22)",
    },
  },
  redeemCard: {
    marginBottom: 20,
    padding: "18px 20px",
    borderRadius: 16,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-accent-rgb), 0.22)"
        : "rgba(22, 163, 74, 0.2)"
    }`,
    background:
      theme.colorScheme === "dark"
        ? "linear-gradient(135deg, rgba(var(--ls-panel-bg-rgb), 0.96) 0%, rgba(var(--ls-panel-bg-rgb), 0.94) 100%)"
        : "linear-gradient(135deg, rgba(240, 253, 244, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)",
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 18px 44px rgba(0, 0, 0, 0.36), 0 0 34px rgba(var(--ls-accent-rgb), 0.08)"
        : "0 18px 44px rgba(15, 23, 42, 0.08)",
  },
  redeemTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800,
    fontSize: 17,
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[8],
  },
  redeemButton: {
    borderRadius: 12,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-accent-rgb), 0.28)"
        : "rgba(22, 163, 74, 0.26)"
    }`,
    background:
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-accent-rgb), 0.12)"
        : "rgba(34, 197, 94, 0.12)",
    color: theme.colorScheme === "dark" ? "var(--ls-accent)" : theme.colors.green[8],
    fontWeight: 800,

    "&:hover": {
      background:
        theme.colorScheme === "dark"
          ? "rgba(var(--ls-accent-rgb), 0.18)"
          : "rgba(34, 197, 94, 0.18)",
    },
  },
  redeemInput: {
    height: 44,
    borderRadius: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    backgroundColor:
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(255, 255, 255, 0.9)",
    borderColor:
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.14)"
        : theme.colors.gray[3],
  },
  overallProgressWrapper: {
    position: "sticky",
    top: 70,
    zIndex: 100,
    marginBottom: 20,
    padding: "16px 20px",
    background:
      "rgba(var(--ls-panel-bg-rgb), 0.95)",
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: `1px solid ${
      theme.colorScheme === "dark"
        ? "rgba(var(--ls-accent-rgb), 0.2)"
        : "rgba(var(--ls-accent-rgb), 0.3)"
    }`,
    boxShadow:
      theme.colorScheme === "dark"
        ? "0 4px 20px rgba(0, 0, 0, 0.4), 0 0 40px rgba(var(--ls-accent-rgb), 0.05)"
        : "0 4px 20px rgba(0, 0, 0, 0.1), 0 0 40px rgba(var(--ls-accent-rgb), 0.03)",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600,
    fontSize: 14,
    color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[7],
  },
  progressStats: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color:
      theme.colorScheme === "dark"
        ? theme.colors.gray[4]
        : theme.colors.gray[6],
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor:
      theme.colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    background: "linear-gradient(90deg, var(--ls-accent) 0%, var(--ls-accent-deep) 100%)",
    boxShadow: "0 0 10px rgba(var(--ls-accent-rgb), 0.5)",
    transition: "width 0.3s ease",
  },
}));

async function uploadMultipart(
  file: File,
  shareId: string,
  fileId: string,
  relativePath: string | undefined,
  fileName: string,
  order: number,
  previewGroup: boolean,
  previewHeader: string | null | undefined,
  partSize: number,
  onProgress: (
    _percent: number,
    _currentPart?: number,
    _totalParts?: number,
  ) => void,
): Promise<void> {
  const totalParts = Math.ceil(file.size / partSize);
  let uploadId: string | undefined;
  let key: string | undefined;
  const multipartRequestTimeoutMs = Math.max(
    30_000,
    Math.ceil(file.size / (1024 * 1024)) * 1_500,
  );
  const multipartStallTimeoutMs = Math.max(
    20_000,
    Math.ceil(file.size / (1024 * 1024)) * 750,
  );

  const uploadChunkWithProgress = (
    url: string,
    chunk: Blob,
    contentType: string,
    onChunkProgress: (_loadedBytes: number) => void,
  ) =>
    new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let settled = false;
      let stallTimer: ReturnType<typeof setTimeout> | null = null;
      let totalTimer: ReturnType<typeof setTimeout> | null = null;

      const clearStallTimer = () => {
        if (stallTimer) {
          clearTimeout(stallTimer);
          stallTimer = null;
        }
      };

      const clearTotalTimer = () => {
        if (totalTimer) {
          clearTimeout(totalTimer);
          totalTimer = null;
        }
      };

      const armStallTimer = () => {
        clearStallTimer();
        stallTimer = setTimeout(() => {
          fail(
            new Error(
              `Multipart part stalled for more than ${Math.round(multipartStallTimeoutMs / 1000)} seconds`,
            ),
          );
        }, multipartStallTimeoutMs);
      };

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearStallTimer();
        clearTotalTimer();
        try {
          if (xhr.readyState !== XMLHttpRequest.DONE) {
            xhr.abort();
          }
        } catch {
        }
        reject(error);
      };

      const succeed = (etag: string) => {
        if (settled) return;
        settled = true;
        clearStallTimer();
        clearTotalTimer();
        resolve(etag);
      };

      xhr.open("PUT", url, true);
      xhr.setRequestHeader("Content-Type", contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onChunkProgress(event.loaded);
        }
        armStallTimer();
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onChunkProgress(chunk.size);
          const etag = xhr.getResponseHeader("ETag");
          if (!etag) {
            fail(new Error("No ETag returned for uploaded part"));
            return;
          }
          succeed(etag.replace(/"/g, ""));
          return;
        }

        fail(new Error(`Failed to upload part: ${xhr.status}`));
      };

      xhr.onerror = () => fail(new Error("Network error while uploading part"));
      xhr.onabort = () => fail(new Error("Upload cancelled"));
      totalTimer = setTimeout(() => {
        fail(
          new Error(
            `Multipart part exceeded ${Math.round(multipartRequestTimeoutMs / 1000)} seconds`,
          ),
        );
      }, multipartRequestTimeoutMs);
      armStallTimer();
      xhr.send(chunk);
    });

  try {
    const initResponse = await withTimeout(
      fetch("/api/storage/multipart/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId,
          fileId,
          fileName,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
          relativePath,
          order,
          previewGroup,
          previewHeader,
        }),
      }),
      30_000,
      `Initializing multipart upload for ${fileName}`,
    );

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.message || "Failed to initialize multipart upload");
    }

    const initData = await initResponse.json();
    uploadId = initData.uploadId;
    key = initData.key;

    const completedParts: Array<{ PartNumber: number; ETag: string }> = [];
    let committedBytes = 0;
    const inFlightPartBytes = new Map<number, number>();

    const emitMultipartProgress = (
      currentPartNumber?: number,
      displayCompletedPart?: number,
    ) => {
      const activeUploadedBytes = Array.from(inFlightPartBytes.values()).reduce(
        (sum, value) => sum + value,
        0,
      );
      const uploadedBytes = Math.min(
        committedBytes + activeUploadedBytes,
        file.size,
      );
      const percent = Math.min((uploadedBytes / file.size) * 90, 90);
      onProgress(
        percent,
        displayCompletedPart ?? currentPartNumber,
        totalParts,
      );
    };

    const partNumbers = Array.from(
      { length: totalParts },
      (_, index) => index + 1,
    );
    const urlsResponse = await withTimeout(
      fetch("/api/storage/multipart/part-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, uploadId, partNumbers }),
      }),
      30_000,
      `Fetching multipart URLs for ${fileName}`,
    );

    if (!urlsResponse.ok) {
      throw new Error("Failed to get part URLs");
    }

    const { urls } = await urlsResponse.json();
    const uploadPartLimit = pLimit(MAX_CONCURRENT_PARTS);

    await Promise.all(
      urls.map(({ partNumber, url }: { partNumber: number; url: string }) =>
        uploadPartLimit(async () => {
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const chunk = file.slice(start, end);

          inFlightPartBytes.set(partNumber, 0);
          emitMultipartProgress(partNumber);

          const etag = await uploadChunkWithProgress(
            url,
            chunk,
            file.type || "application/octet-stream",
            (loadedBytes) => {
              inFlightPartBytes.set(partNumber, loadedBytes);
              emitMultipartProgress(partNumber);
            },
          );

          committedBytes += chunk.size;
          inFlightPartBytes.delete(partNumber);
          completedParts.push({
            PartNumber: partNumber,
            ETag: etag,
          });
          emitMultipartProgress(partNumber, partNumber);
        }),
      ),
    );

    const completeResponse = await withTimeout(
      fetch("/api/storage/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          uploadId,
          parts: [...completedParts].sort(
            (a, b) => a.PartNumber - b.PartNumber,
          ),
        }),
      }),
      30_000,
      `Completing multipart upload for ${fileName}`,
    );

    if (!completeResponse.ok) {
      throw new Error("Failed to complete multipart upload");
    }

    onProgress(100);
  } catch (error) {
    if (uploadId && key) {
      try {
        await fetch("/api/storage/multipart/abort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, uploadId }),
        });
      } catch {
      }
    }
    throw error;
  }
}

const persistLyricsIfNeeded = async (
  shareId: string,
  fileId: string,
  file: FileUpload,
) => {
  if (!file.lyrics?.text?.trim()) {
    return;
  }

  await shareService.updateFile(shareId, fileId, {
    lyricsText: file.lyrics.text,
    lyricsSource: file.lyrics.source,
    lyricsSourceUrl: file.lyrics.sourceUrl || undefined,
    lyricsSyncEnabled: file.lyrics.syncEnabled ?? false,
    lyricsSyncedAt: file.lyrics.syncedAt || undefined,
  });
};

function shouldUseMultipart(fileSize: number, threshold: number): boolean {
  return fileSize > threshold;
}

function getEffectiveMultipartPartSize(
  fileSize: number,
  configuredPartSize: number,
): number {
  if (fileSize >= LARGE_FILE_MULTIPART_THRESHOLD) {
    return Math.max(configuredPartSize, LARGE_FILE_MULTIPART_PART_SIZE);
  }

  return configuredPartSize;
}

function getDirectUploadTimeoutMs(fileSize: number): number {
  const minimum = 90_000;
  const perMb = Math.ceil(fileSize / (1024 * 1024)) * 2_500;
  return Math.max(minimum, minimum + perMb);
}

function getDirectUploadStallTimeoutMs(fileSize: number): number {
  const minimum = 30_000;
  const perMb = Math.ceil(fileSize / (1024 * 1024)) * 750;
  return Math.max(minimum, minimum + perMb);
}

function getAdaptiveMultipartThreshold(
  configuredThreshold: number,
  totalFileCount: number,
): number {
  if (totalFileCount >= 250) {
    return Math.min(configuredThreshold, 5 * 1024 * 1024);
  }

  if (totalFileCount >= 100) {
    return Math.min(configuredThreshold, 8 * 1024 * 1024);
  }

  if (totalFileCount >= 40) {
    return Math.min(configuredThreshold, 12 * 1024 * 1024);
  }

  return configuredThreshold;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

const Upload = ({
  maxShareSize: propMaxShareSize,
  isReverseShare = false,
  simplified,
}: {
  maxShareSize?: number;
  isReverseShare: boolean;
  simplified: boolean;
}) => {
  const modals = useModals();
  const router = useRouter();
  const t = useTranslate();
  const { colorScheme } = useMantineColorScheme();
  const { classes } = useStyles();

  const { user, refreshUser } = useUser();
  const config = useConfig();
  const allowUnauthenticatedShares = !!config.get(
    "share.allowUnauthenticatedShares",
  );
  const allowUninvitedRegisteredShares = !!config.get(
    "share.allowUninvitedRegisteredShares",
  );
  const isLimitedRegisteredUser = !!user && user.canCreateShares === false;
  const canCurrentUserCreateShares =
    !isLimitedRegisteredUser || allowUninvitedRegisteredShares;
  const registeredMaxShareSize = parseInt(config.get("share.maxSize"));
  const uninvitedRegisteredMaxShareSize = parseInt(
    config.get("share.maxUninvitedRegisteredSize"),
  );
  const effectiveRegisteredMaxShareSize =
    isLimitedRegisteredUser && allowUninvitedRegisteredShares
      ? uninvitedRegisteredMaxShareSize
      : registeredMaxShareSize;
  const effectiveMaxExpiration =
    isLimitedRegisteredUser && allowUninvitedRegisteredShares
      ? config.get("share.maxUninvitedRegisteredExpiration")
      : !user
        ? config.get("share.maxAnonymousExpiration")
        : config.get("share.maxExpiration");
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isUploading, setisUploading] = useState(false);
  const [maxShareSize, setMaxShareSize] = useState<number | null>(
    propMaxShareSize ?? null,
  );
  const [isLoadingLimit, setIsLoadingLimit] = useState(!propMaxShareSize);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [uploadETA, setUploadETA] = useState<number>(0);
  const [multipartThreshold, setMultipartThreshold] = useState(
    DEFAULT_MULTIPART_THRESHOLD,
  );
  const [multipartPartSize, setMultipartPartSize] = useState(
    DEFAULT_MULTIPART_PART_SIZE,
  );
  // Multipart is an object-storage feature. Assume it is unavailable until the
  // server says otherwise: the chunked fallback works in either configuration,
  // so guessing wrong here costs speed, while the reverse would break uploads.
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [showRedeemShareCode, setShowRedeemShareCode] = useState(false);
  const [shareInviteCode, setShareInviteCode] = useState("");
  const [isRedeemingShareCode, setIsRedeemingShareCode] = useState(false);
  const [previewLayoutOpen, setPreviewLayoutOpen] = useState(false);
  const createShareInFlightRef = useRef(false);
  const uploadModeRef = useRef<"standard" | "bulk">("standard");

  const defaultAccentColor = useSiteTheme().presets[0]?.color ?? "#00ff5a";
  const bulkEnabled =
    getBulkUploadMode(config.get) === "modal" && !isReverseShare && !simplified;

  const overallProgress = useMemo(() => {
    if (files.length === 0)
      return {
        percent: 0,
        completed: 0,
        total: 0,
        totalBytes: 0,
        uploadedBytes: 0,
      };

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    let uploadedBytes = 0;
    let completedFiles = 0;

    files.forEach((file) => {
      const progress = file.uploadingProgress || 0;
      if (progress >= 100) {
        uploadedBytes += file.size;
        completedFiles++;
      } else if (progress > 0) {
        uploadedBytes += (file.size * progress) / 100;
      }
    });

    const percent = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;

    const now = Date.now();
    if (globalUploadStart > 0 && globalLastUpdate.time > 0) {
      const timeDiff = (now - globalLastUpdate.time) / 1000;
      const bytesDiff = uploadedBytes - globalLastUpdate.bytes;

      if (timeDiff > 0.5) {
        const bytesPerSecond = bytesDiff / timeDiff;
        const speedMbps = (bytesPerSecond * 8) / 1_000_000;
        const remainingBytes = totalBytes - uploadedBytes;
        const eta = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : 0;

        setUploadSpeed(speedMbps);
        setUploadETA(eta);
        globalLastUpdate = { bytes: uploadedBytes, time: now };
      }
    } else if (uploadedBytes > 0) {
      globalLastUpdate = { bytes: uploadedBytes, time: now };
    }

    return {
      percent: Math.min(percent, 100),
      completed: completedFiles,
      total: files.length,
      totalBytes,
      uploadedBytes,
    };
  }, [files]);

  const failedFiles = useMemo(
    () => files.filter((file) => file.uploadingProgress === -1),
    [files],
  );

  useConfirmLeave({
    message: t("upload.notify.confirm-leave"),
    enabled: isUploading,
  });

  useEffect(() => {
    if (propMaxShareSize) {
      setMaxShareSize(propMaxShareSize);
      setIsLoadingLimit(false);
      return;
    }

    fetch("/api/shares/limit")
      .then((res) => res.json())
      .then((data) => {
        setMaxShareSize(data.maxShareSize);
        setIsLoadingLimit(false);
      })
      .catch(() => {
        setMaxShareSize(
          user
            ? effectiveRegisteredMaxShareSize
            : parseInt(config.get("share.maxAnonymousSize")),
        );
        setIsLoadingLimit(false);
      });
  }, [propMaxShareSize, user, effectiveRegisteredMaxShareSize, config]);

  useEffect(() => {
    fetch("/api/storage/multipart/config", { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load multipart config");
        return res.json();
      })
      .then((data) => {
        setStorageEnabled(data?.enabled === true);
        if (Number.isFinite(data?.threshold) && data.threshold > 0) {
          setMultipartThreshold(data.threshold);
        }
        if (Number.isFinite(data?.partSize) && data.partSize > 0) {
          setMultipartPartSize(data.partSize);
        }
      })
      .catch(() => {
        setStorageEnabled(false);
        setMultipartThreshold(DEFAULT_MULTIPART_THRESHOLD);
        setMultipartPartSize(DEFAULT_MULTIPART_PART_SIZE);
      });
  }, []);

  const autoOpenCreateUploadModal = config.get("share.autoOpenShareModal");

  const redeemShareCode = async () => {
    const code = shareInviteCode.trim().toUpperCase();

    if (!code) {
      toast.error("Enter an invite code.");
      return;
    }

    setIsRedeemingShareCode(true);
    try {
      await userService.redeemInviteCode(code);
      setShareInviteCode("");
      setShowRedeemShareCode(false);
      await refreshUser();
      toast.success("Invite accepted. Uploads are now enabled.");
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setIsRedeemingShareCode(false);
    }
  };

  const setOrderedFiles = (nextFiles: FileUpload[]) => {
    setFiles(
      nextFiles.map((file, index) => {
        file.order = index;
        file.previewGroup = file.previewGroup ?? true;
        return file;
      }),
    );
  };

  const uploadFiles = async (share: CreateShare, files: FileUpload[]) => {
    if (createShareInFlightRef.current || isUploading) {
      return;
    }

    uploadModeRef.current = "standard";
    createShareInFlightRef.current = true;
    setisUploading(true);
    globalUploadStart = Date.now();
    globalLastUpdate = { bytes: 0, time: globalUploadStart };

    const effectiveMultipartThreshold = getAdaptiveMultipartThreshold(
      multipartThreshold,
      files.length,
    );
    // Multipart talks to the bucket directly, so it is only an option when
    // object storage is on. Without it every file takes the chunked path.
    const isMultipartCandidate = (size: number) =>
      storageEnabled && shouldUseMultipart(size, effectiveMultipartThreshold);
    const chunkSize = resolveChunkSize(config.get("share.chunkSize"));
    const largeFileCount = files.filter((f) =>
      isMultipartCandidate(f.size),
    ).length;

    try {
      const isReverseShare = router.pathname != "/upload";
      createdShare = await shareService.create(share, isReverseShare);
    } catch (e) {
      if (isShareInviteRequiredError(e)) {
        setShowRedeemShareCode(true);
        toast.error("Redeem an invite code to create uploads.");
      } else {
        toast.axiosError(e);
      }
      setisUploading(false);
      createShareInFlightRef.current = false;
      return;
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const largeFiles = files.filter((f) => f.size > 500 * 1024 * 1024);

    if (largeFiles.length > 0 || totalSize > 1024 * 1024 * 1024) {
      const totalGB = totalSize / (1024 * 1024 * 1024);
      const estimatedMinutes = Math.ceil(totalGB * 2);

      let message = `Uploading ${formatBytes(totalSize)} (${files.length} file${files.length !== 1 ? "s" : ""}). `;
      if (largeFileCount > 0) {
        message += `${largeFileCount} file${largeFileCount !== 1 ? "s" : ""} using chunked upload. `;
      }
      message += `This may take approximately ${estimatedMinutes} minute${estimatedMinutes !== 1 ? "s" : ""}. Please keep this page open.`;

      toast.success(message);
    }

    const uploadLimiter = pLimit(3);
    const fileUploadPromises = files.map(async (file, fileIndex) =>
      uploadLimiter(async () => {
        const fileId = crypto.randomUUID();

        const setFileProgress = (
          progress: number,
          currentPart?: number,
          totalParts?: number,
        ) => {
          setFiles((files) =>
            files.map((file, callbackIndex) => {
              if (fileIndex == callbackIndex) {
                file.uploadingProgress = progress;
                if (progress >= 0) {
                  file.uploadError = undefined;
                }
                (file as any).currentPart = currentPart;
                (file as any).totalParts = totalParts;
              }
              return file;
            }),
          );
        };

        const setFileFailure = (error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Upload failed";
          setFiles((files) =>
            files.map((file, callbackIndex) => {
              if (fileIndex == callbackIndex) {
                file.uploadingProgress = -1;
                file.uploadError = message;
              }
              return file;
            }),
          );
        };

        setFileProgress(1);

        const fileWithPath = file as FileUpload & {
          webkitRelativePath?: string;
          path?: string;
          relativePathOverride?: string;
        };
        const relativePath =
          fileWithPath.relativePathOverride ||
          fileWithPath.webkitRelativePath ||
          fileWithPath.path ||
          undefined;
        const uploadName = file.editableName || file.name;

        const maxFileAttempts = 5;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxFileAttempts; attempt++) {
          try {
            setFileProgress(attempt === 1 ? 1 : 2);

            if (isMultipartCandidate(file.size)) {
              const effectivePartSize = getEffectiveMultipartPartSize(
                file.size,
                multipartPartSize,
              );

              await uploadMultipart(
                file,
                createdShare.id,
                fileId,
                relativePath,
                uploadName,
                file.order ?? fileIndex,
                file.previewGroup ?? true,
                file.previewHeader,
                effectivePartSize,
                (percent, currentPart, totalParts) =>
                  setFileProgress(percent, currentPart, totalParts),
              );
              await persistLyricsIfNeeded(createdShare.id, fileId, file);
            } else {
              const directUploadTimeoutMs = getDirectUploadTimeoutMs(file.size);
              const directUploadStallTimeoutMs = getDirectUploadStallTimeoutMs(
                file.size,
              );

              const uploadUrlResponse = await withTimeout(
                shareService.getUploadUrl(
                  createdShare.id,
                  fileId,
                  uploadName,
                  file.size,
                  relativePath,
                  file.order ?? fileIndex,
                  file.previewGroup ?? true,
                  file.previewHeader,
                ),
                30_000,
                `Preparing upload for ${uploadName}`,
              );

              if (
                uploadUrlResponse.useChunkedUpload ||
                !uploadUrlResponse.uploadUrl
              ) {
                // No presigned URL, so send the file through the backend. The
                // server records it once the last chunk lands, which is why
                // there is no confirmUpload call on this branch.
                await uploadFileInChunks(
                  createdShare.id,
                  file,
                  {
                    id: fileId,
                    name: uploadName,
                    relativePath,
                    order: file.order ?? fileIndex,
                    previewGroup: file.previewGroup ?? true,
                    previewHeader: file.previewHeader,
                  },
                  chunkSize,
                  (percent) => setFileProgress(percent),
                );
              } else {
                await withTimeout(
                  shareService.uploadFileDirectToR2(
                    uploadUrlResponse.uploadUrl,
                    file,
                    {
                      totalTimeoutMs: directUploadTimeoutMs,
                      stallTimeoutMs: directUploadStallTimeoutMs,
                    },
                    (progress) => setFileProgress(progress * 0.95),
                  ),
                  directUploadTimeoutMs,
                  `Uploading ${uploadName}`,
                );

                await withTimeout(
                  shareService.confirmUpload(
                    createdShare.id,
                    fileId,
                    uploadName,
                    file.size,
                    relativePath,
                    file.order ?? fileIndex,
                    file.previewGroup ?? true,
                    file.previewHeader,
                  ),
                  30_000,
                  `Finalizing ${uploadName}`,
                );
              }

              await persistLyricsIfNeeded(createdShare.id, fileId, file);

              setFileProgress(100);
            }

            return;
          } catch (e) {
            lastError = e;
            console.error(
              `Failed to upload ${uploadName} on attempt ${attempt}/${maxFileAttempts}:`,
              e,
            );

            if (attempt < maxFileAttempts) {
              await sleep(Math.min(15_000, attempt * 2_000));
              continue;
            }

            setFileFailure(e);
            throw e;
          }
        }

        throw lastError;
      }),
    );

    void Promise.allSettled(fileUploadPromises).then((results) => {
      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedCount > 0) {
        setisUploading(false);
        createShareInFlightRef.current = false;
        globalUploadStart = 0;
        setUploadSpeed(0);
        setUploadETA(0);
      }
    });
  };

  const runBulkUpload = async (bulkOptions: BulkShareOptions) => {
    if (createShareInFlightRef.current || isUploading || files.length === 0) {
      return;
    }

    uploadModeRef.current = "bulk";
    createShareInFlightRef.current = true;
    setisUploading(true);
    globalUploadStart = Date.now();
    globalLastUpdate = { bytes: 0, time: globalUploadStart };

    const bulkContext: BulkUploadContext = {
      shareIdLength: config.get("share.shareIdLength"),
      multipartThreshold,
      multipartPartSize,
      defaultAccentColor,
      storageEnabled,
      chunkSize: resolveChunkSize(config.get("share.chunkSize")),
    };
    const normalizedOptions = normalizeBulkOptions(
      bulkOptions,
      defaultAccentColor,
    );

    const setBulkFileProgress = (
      fileIndex: number,
      progress: number,
      uploadedBytes?: number,
    ) => {
      setFiles((current) =>
        current.map((file, index) => {
          if (index === fileIndex) {
            file.uploadingProgress = progress;
            if (progress >= 0) file.uploadError = undefined;
            if (typeof uploadedBytes === "number") {
              file.uploadedBytes = Math.min(file.size, uploadedBytes);
            }
          }
          return file;
        }),
      );
    };

    const uploadLimiter = pLimit(2);
    const results = await Promise.allSettled(
      files.map((file, fileIndex) =>
        uploadLimiter(() =>
          uploadSingleFileAsShare(
            file,
            fileIndex,
            normalizedOptions,
            bulkContext,
            setBulkFileProgress,
          ),
        ),
      ),
    );

    const successfulEntries = results
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          fileName: string;
          link: string;
        }> => result.status === "fulfilled",
      )
      .map((result) => result.value);
    const failedCount = results.length - successfulEntries.length;

    setisUploading(false);
    createShareInFlightRef.current = false;
    globalUploadStart = 0;
    setUploadSpeed(0);
    setUploadETA(0);

    if (successfulEntries.length > 0) {
      downloadManifest(successfulEntries);
      if (failedCount === 0) {
        setFiles([]);
        toast.success(
          `Created ${successfulEntries.length} share links and downloaded the manifest.`,
        );
      } else {
        setFiles((current) =>
          current.filter((_, index) => results[index]?.status !== "fulfilled"),
        );
        toast.error(
          `${failedCount} file${failedCount === 1 ? "" : "s"} failed. The manifest only includes successful uploads.`,
          { autoClose: false },
        );
      }
    } else {
      toast.error("Bulk upload failed before any share links were created.", {
        autoClose: false,
      });
    }
  };

  const buildBulkModeProps = () => {
    const groupMemberships = getUserGroupMemberships(user);
    const groupOptions = groupMemberships.map((membership) => ({
      value: membership.group.id,
      label: membership.group.name,
    }));

    return {
      defaultOptions: {
        expiration:
          effectiveMaxExpiration.value === 0
            ? "7-days"
            : `${Math.max(1, effectiveMaxExpiration.value)}-${effectiveMaxExpiration.unit}`,
        recipients: [] as string[],
        description: undefined,
        accentColor: defaultAccentColor,
        shareWithGroup: groupOptions.length > 0,
        groupId: groupOptions[0]?.value || null,
        removeExtensionFromShareName: false,
        shareNamePrefix: "",
        security: {},
      } as BulkShareOptions,
      groupName: groupOptions[0]?.label,
      groupOptions,
      onSubmit: runBulkUpload,
    };
  };

  const showCreateUploadModalCallback = (files: FileUpload[]) => {
    showCreateUploadModal(
      modals,
      {
        isUserSignedIn: user ? true : false,
        isReverseShare,
        allowUnauthenticatedShares: config.get(
          "share.allowUnauthenticatedShares",
        ),
        enableEmailRecepients: config.get("email.enableShareEmailRecipients"),
        maxExpiration: effectiveMaxExpiration,
        shareIdLength: config.get("share.shareIdLength"),
        simplified,
        isDark: colorScheme === "dark",
        isLimitedRegisteredUser:
          isLimitedRegisteredUser && allowUninvitedRegisteredShares,
      },
      files,
      uploadFiles,
      bulkEnabled ? buildBulkModeProps() : undefined,
    );
  };

  const handleDropzoneFilesChanged = (files: FileUpload[]) => {
    if (autoOpenCreateUploadModal) {
      setOrderedFiles(files);
      showCreateUploadModalCallback(files);
    } else {
      setFiles((oldArr) =>
        [...oldArr, ...files].map((file, index) => {
          file.order = index;
          file.previewGroup = file.previewGroup ?? true;
          return file;
        }),
      );
    }
  };

  useEffect(() => {
    const fileErrorCount = files.filter(
      (file) => file.uploadingProgress == -1,
    ).length;

    if (fileErrorCount > 0) {
      if (!errorToastShown) {
        toast.error(
          t("upload.notify.count-failed", { count: fileErrorCount }),
          {
            withCloseButton: false,
            autoClose: false,
          },
        );
      }
      errorToastShown = true;
    } else {
      cleanNotifications();
      errorToastShown = false;
    }

    if (
      uploadModeRef.current === "standard" &&
      files.length > 0 &&
      files.every((file) => file.uploadingProgress >= 100) &&
      fileErrorCount == 0
    ) {
      shareService
        .completeShare(createdShare.id)
        .then((share) => {
          setisUploading(false);
          createShareInFlightRef.current = false;
          globalUploadStart = 0;
          setUploadSpeed(0);
          setUploadETA(0);
          showCompletedUploadModal(modals, share);
          setFiles([]);
        })
        .catch(() => {
          createShareInFlightRef.current = false;
          toast.error(t("upload.notify.generic-error"));
        });
    }
  }, [files]);

  const formatSpeed = (mbps: number): string => {
    if (mbps < 1) {
      return `${(mbps * 1000).toFixed(0)} Kbps`;
    }
    return `${mbps.toFixed(1)} Mbps`;
  };

  const formatETA = (seconds: number): string => {
    if (seconds < 1) return "Almost done";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoadingLimit || maxShareSize === null) {
    return <LoadingOverlay visible />;
  }

  return (
    <>
      <Meta title={t("upload.title")} />

      {user && !user.canCreateShares && !allowUninvitedRegisteredShares && (
        <Box className={classes.redeemCard}>
          <Group position="apart" align="flex-start" spacing="md">
            <Box>
              <Text className={classes.redeemTitle}>
                <TbTicket size={22} />
                Invite required
              </Text>
              <Text color="dimmed" size="sm" mt={6}>
                Redeem a share code to unlock uploads.
              </Text>
            </Box>
            <Button
              className={classes.redeemButton}
              onClick={() => setShowRedeemShareCode((value) => !value)}
              variant="subtle"
            >
              Redeem Share Code
            </Button>
          </Group>

          {showRedeemShareCode && (
            <Stack spacing="sm" mt="md">
              <TextInput
                classNames={{ input: classes.redeemInput }}
                placeholder="Enter share invite code"
                value={shareInviteCode}
                onChange={(event) =>
                  setShareInviteCode(event.currentTarget.value.toUpperCase())
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void redeemShareCode();
                  }
                }}
              />
              <Group position="right">
                <Button
                  className={classes.shareButton}
                  loading={isRedeemingShareCode}
                  onClick={() => void redeemShareCode()}
                >
                  Unlock Uploads
                </Button>
              </Group>
            </Stack>
          )}
        </Box>
      )}
      {user && !user.canCreateShares && allowUninvitedRegisteredShares && (
        <Box className={classes.redeemCard}>
          <Group position="apart" align="flex-start" spacing="md">
            <Box>
              <Text className={classes.redeemTitle}>
                <TbTicket size={22} />
                Limited access
              </Text>
              <Text color="dimmed" size="sm" mt={6}>
                You can create shares up to{" "}
                {formatBytes(effectiveRegisteredMaxShareSize)} for{" "}
                {formatTimespan(effectiveMaxExpiration)}. Redeem a share code to
                unlock full limits.
              </Text>
            </Box>
            <Button
              className={classes.redeemButton}
              onClick={() => setShowRedeemShareCode((value) => !value)}
              variant="subtle"
            >
              Redeem Share Code
            </Button>
          </Group>

          {showRedeemShareCode && (
            <Stack spacing="sm" mt="md">
              <TextInput
                classNames={{ input: classes.redeemInput }}
                placeholder="Enter share invite code"
                value={shareInviteCode}
                onChange={(event) =>
                  setShareInviteCode(event.currentTarget.value.toUpperCase())
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void redeemShareCode();
                  }
                }}
              />
              <Group position="right">
                <Button
                  className={classes.shareButton}
                  loading={isRedeemingShareCode}
                  onClick={() => void redeemShareCode()}
                >
                  Unlock Full Limits
                </Button>
              </Group>
            </Stack>
          )}
        </Box>
      )}

      {(isUploading || failedFiles.length > 0) && (
        <Box className={classes.overallProgressWrapper}>
          <div className={classes.progressHeader}>
            <div className={classes.progressLabel}>
              {failedFiles.length > 0 && !isUploading ? (
                <TbAlertTriangle size={18} style={{ color: "#fa5252" }} />
              ) : (
                <TbUpload size={18} style={{ color: "var(--ls-accent)" }} />
              )}
              <span>
                {failedFiles.length > 0 && !isUploading
                  ? `${failedFiles.length} file${failedFiles.length !== 1 ? "s" : ""} failed`
                  : `Uploading ${overallProgress.total} file${overallProgress.total !== 1 ? "s" : ""}`}
              </span>
            </div>
            <div className={classes.progressStats}>
              <span>
                {overallProgress.completed} / {overallProgress.total} complete ·{" "}
                {formatBytes(overallProgress.uploadedBytes)} /{" "}
                {formatBytes(overallProgress.totalBytes)}
              </span>
              {uploadSpeed > 0 && (
                <>
                  <Badge
                    variant="light"
                    color="green"
                    leftSection={<TbArrowUp size={12} />}
                  >
                    {formatSpeed(uploadSpeed)}
                  </Badge>
                  {uploadETA > 0 && (
                    <Badge variant="light" color="gray">
                      {formatETA(uploadETA)}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
          <div className={classes.progressBar}>
            <div
              className={classes.progressFill}
              style={{ width: `${overallProgress.percent}%` }}
            />
          </div>
          <Text size="xs" color="dimmed" mt={6} align="center">
            {overallProgress.percent.toFixed(1)}% complete
          </Text>
          {failedFiles.length > 0 && (
            <Box mt="sm">
              {failedFiles.slice(0, 5).map((file) => (
                <Text
                  key={`${file.name}-${file.size}`}
                  size="xs"
                  color="red"
                  align="center"
                >
                  {file.editableName || file.name}
                  {file.uploadError ? `: ${file.uploadError}` : ""}
                </Text>
              ))}
              {failedFiles.length > 5 && (
                <Text size="xs" color="red" align="center">
                  +{failedFiles.length - 5} more failed file
                  {failedFiles.length - 5 === 1 ? "" : "s"}
                </Text>
              )}
            </Box>
          )}
        </Box>
      )}

      <Dropzone
        title={
          !autoOpenCreateUploadModal && files.length > 0
            ? t("share.edit.append-upload")
            : undefined
        }
        maxShareSize={maxShareSize}
        isUserSignedIn={!!user}
        onFilesChanged={handleDropzoneFilesChanged}
        isUploading={isUploading}
        rightAction={
          <Button
            className={classes.shareButton}
            loading={isUploading}
            disabled={
              files.length <= 0 ||
              (!user && !allowUnauthenticatedShares) ||
              (!!user && !canCurrentUserCreateShares)
            }
            onClick={() => showCreateUploadModalCallback(files)}
          >
            <FormattedMessage id="common.button.share" />
          </Button>
        }
        limitedRegisteredMaxShareSize={uninvitedRegisteredMaxShareSize}
        invitedRegisteredMaxShareSize={registeredMaxShareSize}
        guestUploadsDisabled={!user && !allowUnauthenticatedShares}
      />
      {files.length > 0 && (
        <>
          <Group position="right" mt="md" mb="xs">
            <Button
              leftIcon={<TbEye size={16} />}
              variant="light"
              onClick={() => setPreviewLayoutOpen(true)}
              disabled={isUploading}
            >
              Preview Share
            </Button>
          </Group>
          <FileList<FileUpload>
            files={files}
            setFiles={setOrderedFiles}
            showPreviewGroupingControls
          />
          <PreviewLayoutEditor<FileUpload>
            opened={previewLayoutOpen}
            files={files}
            setFiles={setOrderedFiles}
            onClose={() => setPreviewLayoutOpen(false)}
          />
        </>
      )}
    </>
  );
};

export { Upload };

export default Upload;
