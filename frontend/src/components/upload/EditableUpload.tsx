import {
  Button,
  Group,
  Select,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { cleanNotifications } from "@mantine/notifications";
import { AxiosError } from "axios";
import { useRouter } from "next/router";
import pLimit from "p-limit";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import { TbEye } from "react-icons/tb";
import ThemeColorPicker from "../share/ThemeColorPicker";
import Dropzone from "../../components/upload/Dropzone";
import FileList from "../../components/upload/FileList";
import PreviewLayoutEditor from "../../components/upload/PreviewLayoutEditor";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import shareService from "../../services/share.service";
import userService from "../../services/user.service";
import {
  FileListItem,
  FileMetaData,
  FileUpload,
  LyricsAttachment,
} from "../../types/File.type";
import { Share as ShareType } from "../../types/share.type";
import User from "../../types/user.type";
import toast from "../../utils/toast.util";
import {
  resolveChunkSize,
  uploadFileInChunks,
} from "../../utils/chunkedUpload.util";

const promiseLimit = pLimit(3);
let errorToastShown = false;
const DEFAULT_MULTIPART_THRESHOLD = 50 * 1024 * 1024;
const DEFAULT_MULTIPART_PART_SIZE = 10 * 1024 * 1024;
const LARGE_FILE_MULTIPART_THRESHOLD = 2 * 1024 * 1024 * 1024;
const LARGE_FILE_MULTIPART_PART_SIZE = 128 * 1024 * 1024;
const MAX_CONCURRENT_PARTS = 8;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getDirectUploadTimeoutMs = (fileSize: number): number => {
  const minimum = 90_000;
  const perMb = Math.ceil(fileSize / (1024 * 1024)) * 2_500;
  return Math.max(minimum, minimum + perMb);
};

const getDirectUploadStallTimeoutMs = (fileSize: number): number => {
  const minimum = 30_000;
  const perMb = Math.ceil(fileSize / (1024 * 1024)) * 750;
  return Math.max(minimum, minimum + perMb);
};

const shouldUseMultipart = (fileSize: number, threshold: number): boolean =>
  fileSize > threshold;

const getEffectiveMultipartPartSize = (
  fileSize: number,
  configuredPartSize: number,
): number => {
  if (fileSize >= LARGE_FILE_MULTIPART_THRESHOLD) {
    return Math.max(configuredPartSize, LARGE_FILE_MULTIPART_PART_SIZE);
  }

  return configuredPartSize;
};

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
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
};

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

        fail(new Error(`Failed to upload multipart part: ${xhr.status}`));
      };
      xhr.onerror = () =>
        fail(new Error("Network error while uploading multipart part"));
      xhr.onabort = () => fail(new Error("Multipart upload cancelled"));
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
      const error = await initResponse.json().catch(() => ({}));
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
      throw new Error("Failed to get multipart part URLs");
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
          completedParts.push({ PartNumber: partNumber, ETag: etag });
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

type LyricsFileFields = {
  lyrics?: LyricsAttachment | null;
  lyricsText?: string | null;
  lyricsSource?: string | null;
  lyricsSourceUrl?: string | null;
  lyricsSyncEnabled?: boolean;
  lyricsSyncedAt?: string | null;
  lyricsSyncStatus?: string | null;
  lyricsSyncError?: string | null;
};

const getLyricsAttachment = (
  file: LyricsFileFields,
): LyricsAttachment | null => {
  if (file.lyrics) return file.lyrics;
  if (!file.lyricsText) return null;

  return {
    text: file.lyricsText,
    source:
      file.lyricsSource === "text-file" ||
      file.lyricsSource === "genius-link" ||
      file.lyricsSource === "genius-search"
        ? file.lyricsSource
        : "manual",
    sourceUrl: file.lyricsSourceUrl || null,
    sourceLabel: file.lyricsSource || null,
    syncEnabled: file.lyricsSyncEnabled ?? false,
    syncedAt: file.lyricsSyncedAt || null,
    syncStatus: file.lyricsSyncStatus || null,
    syncError: file.lyricsSyncError || null,
  };
};

const cloneEditableFile = (file: FileMetaData, index = 0) => ({
  ...file,
  order: typeof file.order === "number" ? file.order : index,
  previewGroup: file.previewGroup ?? true,
  lyrics: getLyricsAttachment(file),
});

const getSavedFile = (savedFiles: FileMetaData[], fileId: string) =>
  savedFiles.find((savedFile) => savedFile.id === fileId);

const getSavedFileOrder = (savedFiles: FileMetaData[], fileId: string) => {
  const savedFile = getSavedFile(savedFiles, fileId);
  if (typeof savedFile?.order === "number") return savedFile.order;

  return [...savedFiles]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .findIndex((file) => file.id === fileId);
};

const EditableUpload = ({
  maxShareSize,
  shareId,
  files: savedFiles = [],
  share,
}: {
  maxShareSize?: number;
  isReverseShare?: boolean;
  shareId: string;
  files?: FileMetaData[];
  share?: ShareType;
}) => {
  const t = useTranslate();
  const router = useRouter();
  const config = useConfig();
  const { user } = useUser();
  const editablePermissions = share?.editablePermissions ?? {
    canAccessEditor: true,
    canEditShareThemeColor: true,
    canEditShareName: true,
    canEditShareDescription: true,
    canEditShareFileOrder: true,
    canAddFiles: true,
    canRemoveFiles: true,
  };

  const chunkSize = useRef(resolveChunkSize(config.get("share.chunkSize")));

  const [existingFiles, setExistingFiles] = useState<
    Array<
      FileMetaData & { deleted?: boolean; lyrics?: LyricsAttachment | null }
    >
  >(savedFiles.map(cloneEditableFile));
  const [uploadingFiles, setUploadingFiles] = useState<FileUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [shareName, setShareName] = useState(share?.name || "");
  const [shareDescription, setShareDescription] = useState(
    share?.description || "",
  );
  const [shareAccentColor, setShareAccentColor] = useState(
    share?.accentColor || "#00ff5a",
  );
  const [previewStyle, setPreviewStyle] = useState<"full" | "consolidated">(
    share?.previewStyle === "consolidated" ? "consolidated" : "full",
  );
  const [shareOwnerId, setShareOwnerId] = useState(share?.creator?.id || "");
  const [previewLayoutOpen, setPreviewLayoutOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [effectiveMaxShareSize, setEffectiveMaxShareSize] = useState<
    number | null
  >(maxShareSize ?? null);
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
  const initialExistingFileIds = useRef(savedFiles.map((file) => file.id));
  const isLimitedRegisteredUser = !!user && user.canCreateShares === false;
  const fallbackMaxShareSize = isLimitedRegisteredUser
    ? parseInt(config.get("share.maxUninvitedRegisteredSize"))
    : parseInt(config.get("share.maxSize"));

  useEffect(() => {
    setShareName(share?.name || "");
    setShareDescription(share?.description || "");
    setShareAccentColor(share?.accentColor || "#00ff5a");
    setShareOwnerId(share?.creator?.id || "");
    setExistingFiles(savedFiles.map(cloneEditableFile));
    initialExistingFileIds.current = [...savedFiles]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((file) => file.id);
  }, [
    savedFiles,
    share?.name,
    share?.description,
    share?.accentColor,
    share?.creator?.id,
  ]);

  useEffect(() => {
    if (maxShareSize) {
      setEffectiveMaxShareSize(maxShareSize);
      return;
    }

    fetch("/api/shares/limit")
      .then((res) => res.json())
      .then((data) => {
        const nextLimit = Number(data?.maxShareSize);
        setEffectiveMaxShareSize(
          Number.isFinite(nextLimit) && nextLimit > 0
            ? nextLimit
            : fallbackMaxShareSize,
        );
      })
      .catch(() => {
        setEffectiveMaxShareSize(fallbackMaxShareSize);
      });
  }, [config, fallbackMaxShareSize, maxShareSize, user?.id]);

  useEffect(() => {
    if (!user?.isAdmin) return;

    userService
      .list()
      .then((users) => setAvailableUsers(users))
      .catch(() => {
        toast.error("Failed to load users");
      });
  }, [user?.isAdmin]);

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

  const existingAndUploadedFiles: FileListItem[] = useMemo(
    () =>
      [...uploadingFiles, ...existingFiles].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      ),
    [existingFiles, uploadingFiles],
  );
  const dirty = useMemo(() => {
    const currentExistingFileIds = [...existingFiles]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((file) => file.id);
    const hasReorderedExistingFiles =
      currentExistingFileIds.length === initialExistingFileIds.current.length &&
      currentExistingFileIds.some(
        (fileId, index) => fileId !== initialExistingFileIds.current[index],
      );

    return (
      hasReorderedExistingFiles ||
      existingFiles.some(
        (file) =>
          (editablePermissions.canRemoveFiles && !!file.deleted) ||
          (editablePermissions.canEditShareFileOrder &&
            (file.editableName ?? file.name) !== file.name) ||
          (editablePermissions.canEditShareFileOrder &&
            (file.previewGroup ?? true) !==
              (getSavedFile(savedFiles, file.id)?.previewGroup ?? true)) ||
          (editablePermissions.canEditShareFileOrder &&
            (file.previewHeader || "") !==
              (getSavedFile(savedFiles, file.id)?.previewHeader || "")) ||
          JSON.stringify(getLyricsAttachment(file)) !==
            JSON.stringify(
              getLyricsAttachment(getSavedFile(savedFiles, file.id) || file),
            ),
      ) ||
      uploadingFiles.some(
        (file) =>
          editablePermissions.canEditShareFileOrder &&
          !!file.editableName &&
          file.editableName !== file.name,
      ) ||
      (editablePermissions.canAddFiles && !!uploadingFiles.length) ||
      (editablePermissions.canEditShareName &&
        (shareName || "") !== (share?.name || "")) ||
      (editablePermissions.canEditShareDescription &&
        (shareDescription || "") !== (share?.description || "")) ||
      (editablePermissions.canEditShareThemeColor &&
        (shareAccentColor || "#00ff5a") !==
          (share?.accentColor || "#00ff5a")) ||
      (previewStyle || "full") !== (share?.previewStyle || "full") ||
      (user?.isAdmin && (shareOwnerId || "") !== (share?.creator?.id || ""))
    );
  }, [
    editablePermissions.canAddFiles,
    editablePermissions.canEditShareDescription,
    editablePermissions.canEditShareFileOrder,
    editablePermissions.canEditShareName,
    editablePermissions.canEditShareThemeColor,
    editablePermissions.canRemoveFiles,
    existingFiles,
    uploadingFiles,
    shareName,
    shareDescription,
    shareAccentColor,
    previewStyle,
    shareOwnerId,
    share?.name,
    share?.description,
    share?.accentColor,
    share?.previewStyle,
    share?.creator?.id,
    savedFiles,
    user?.isAdmin,
  ]);

  const setFiles = (files: FileListItem[]) => {
    const orderedFiles = files.map((file, index) => {
      if ("uploadingProgress" in file) {
        file.order = index;
        file.previewGroup = file.previewGroup ?? true;
        return file;
      }

      return {
        ...file,
        order: index,
        previewGroup: file.previewGroup ?? true,
      };
    });

    const _uploadFiles = orderedFiles.filter(
      (file) => "uploadingProgress" in file,
    ) as FileUpload[];
    const _existingFiles = orderedFiles.filter(
      (file) => !("uploadingProgress" in file),
    ) as Array<
      FileMetaData & { deleted?: boolean; lyrics?: LyricsAttachment | null }
    >;

    setUploadingFiles(_uploadFiles);
    setExistingFiles(_existingFiles);
  };

  const uploadFiles = async (files: FileUpload[]) => {
    const fileUploadPromises = files.map(async (file, fileIndex) =>
      promiseLimit(async () => {
        const fileId = crypto.randomUUID();

        const setFileProgress = (progress: number, error?: string) => {
          setUploadingFiles((files) =>
            files.map((file, callbackIndex) => {
              if (fileIndex == callbackIndex) {
                file.uploadingProgress = progress;
                file.uploadError = error;
              }
              return file;
            }),
          );
        };

        setFileProgress(1);

        const fileWithPath = file as FileUpload & {
          webkitRelativePath?: string;
          path?: string;
        };
        const relativePath =
          file.relativePathOverride ||
          fileWithPath.webkitRelativePath ||
          fileWithPath.path ||
          undefined;
        const uploadName = file.editableName || file.name;

        const uploadWithChunks = () =>
          uploadFileInChunks(
            shareId,
            file,
            {
              id: fileId,
              name: uploadName,
              relativePath,
              order: file.order,
              previewGroup: file.previewGroup ?? true,
              previewHeader: file.previewHeader,
            },
            chunkSize.current,
            (percent) => setFileProgress(percent),
          );

        const maxFileAttempts = 5;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxFileAttempts; attempt++) {
          try {
            setFileProgress(attempt === 1 ? 1 : 2);

            if (
              storageEnabled &&
              shouldUseMultipart(file.size, multipartThreshold)
            ) {
              await uploadMultipart(
                file,
                shareId,
                fileId,
                relativePath,
                uploadName,
                file.order ?? fileIndex,
                file.previewGroup ?? true,
                file.previewHeader,
                getEffectiveMultipartPartSize(file.size, multipartPartSize),
                (progress) => setFileProgress(progress),
              );
            } else {
              const directUploadTimeoutMs = getDirectUploadTimeoutMs(file.size);
              const directUploadStallTimeoutMs = getDirectUploadStallTimeoutMs(
                file.size,
              );

              const uploadUrlResponse = await withTimeout(
                shareService.getUploadUrl(
                  shareId,
                  fileId,
                  uploadName,
                  file.size,
                  relativePath,
                  file.order,
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
                await uploadWithChunks();
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
                    shareId,
                    fileId,
                    uploadName,
                    file.size,
                    relativePath,
                    file.order,
                    file.previewGroup ?? true,
                    file.previewHeader,
                  ),
                  30_000,
                  `Finalizing ${uploadName}`,
                );
                setFileProgress(100);
              }
            }

            const lyrics = getLyricsAttachment(
              file as FileUpload & { lyrics?: LyricsAttachment | null },
            );
            if (lyrics?.text) {
              await shareService.updateFile(shareId, fileId, {
                lyricsText: lyrics.text,
                lyricsSource: lyrics.source || "manual",
                lyricsSourceUrl: lyrics.sourceUrl || "",
                lyricsSyncEnabled: lyrics.syncEnabled ?? false,
                lyricsSyncedAt: lyrics.syncedAt || undefined,
              });
            }

            return true;
          } catch (e) {
            lastError = e;

            if (attempt < maxFileAttempts) {
              await sleep(Math.min(15_000, attempt * 2_000));
              continue;
            }
          }
        }

        if (
          lastError instanceof AxiosError &&
          lastError.response?.data.error == "unexpected_chunk_index"
        ) {
          setFileProgress(
            -1,
            "Unexpected chunk index. Please try saving again.",
          );
        } else {
          const message =
            lastError instanceof Error ? lastError.message : "Upload failed";
          setFileProgress(-1, message);
        }

        return false;
      }),
    );

    const results = await Promise.all(fileUploadPromises);
    return results.every(Boolean);
  };

  const removeFiles = async () => {
    if (!editablePermissions.canRemoveFiles) return;
    const removedFiles = existingFiles.filter((file) => !!file.deleted);

    if (removedFiles.length > 0) {
      await Promise.all(
        removedFiles.map(async (file) => {
          await shareService.removeFile(shareId, file.id);
        }),
      );

      setExistingFiles(existingFiles.filter((file) => !file.deleted));
    }
  };

  const revertComplete = async () => {
    await shareService.revertComplete(shareId).then();
  };

  const relockAfterEditFailure = async () => {
    await shareService.relockAfterEditFailure(shareId);
  };

  const completeShare = async () => {
    return await shareService.completeShare(shareId);
  };

  const save = async () => {
    setIsUploading(true);
    let reopenedShare = false;
    let completedAfterReopen = false;
    const wasPublishedShare = !!share?.uploadLocked;
    const removedFiles = existingFiles.filter((file) => !!file.deleted);
    const hasFileMembershipChanges =
      (editablePermissions.canAddFiles && uploadingFiles.length > 0) ||
      (editablePermissions.canRemoveFiles && removedFiles.length > 0);

    try {
      if (hasFileMembershipChanges) {
        await revertComplete();
        reopenedShare = true;
      }

      const hasFailed = editablePermissions.canAddFiles
        ? !(await uploadFiles(uploadingFiles))
        : false;

      if (!hasFailed && editablePermissions.canRemoveFiles && removedFiles.length > 0) {
        await removeFiles();
      }

      if (editablePermissions.canEditShareFileOrder) {
        await Promise.all(
          existingFiles
            .filter(
              (file) =>
                !file.deleted &&
                ((file.editableName ?? file.name) !== file.name ||
                  JSON.stringify(getLyricsAttachment(file)) !==
                    JSON.stringify(
                      getLyricsAttachment(
                        getSavedFile(savedFiles, file.id) || file,
                      ),
                    ) ||
                  (file.previewGroup ?? true) !==
                    (getSavedFile(savedFiles, file.id)?.previewGroup ?? true) ||
                  (file.previewHeader || "") !==
                    (getSavedFile(savedFiles, file.id)?.previewHeader || "") ||
                  file.order !== getSavedFileOrder(savedFiles, file.id)),
            )
            .map((file) =>
              shareService.updateFile(shareId, file.id, {
                name: file.editableName || file.name,
                order: file.order,
                previewGroup: file.previewGroup ?? true,
                previewHeader: file.previewHeader || "",
                lyricsText: getLyricsAttachment(file)?.text || "",
                lyricsSource: getLyricsAttachment(file)?.source || "",
                lyricsSourceUrl: getLyricsAttachment(file)?.sourceUrl || "",
                lyricsSyncEnabled: getLyricsAttachment(file)?.syncEnabled ?? false,
                lyricsSyncedAt:
                  getLyricsAttachment(file)?.syncedAt || undefined,
              }),
            ),
        );
      }

      await shareService.update(shareId, {
        name: editablePermissions.canEditShareName ? shareName.trim() : undefined,
        description: editablePermissions.canEditShareDescription
          ? shareDescription.trim()
          : undefined,
        accentColor: editablePermissions.canEditShareThemeColor
          ? shareAccentColor
          : undefined,
        previewStyle,
        creatorId:
          user?.isAdmin && shareOwnerId && shareOwnerId !== share?.creator?.id
            ? shareOwnerId
            : undefined,
      });

      if (!hasFailed && (reopenedShare || !wasPublishedShare)) {
        await completeShare();
        if (reopenedShare) completedAfterReopen = true;
      }

      if (!hasFailed) {
        toast.success(t("share.edit.notify.save-success"));
        router.back();
      }
    } catch {
      toast.error(t("share.edit.notify.generic-error"));
      if (wasPublishedShare && reopenedShare) {
        try {
          await relockAfterEditFailure();
        } catch {
        }
      }
    } finally {
      if (wasPublishedShare && reopenedShare && !completedAfterReopen) {
        try {
          await relockAfterEditFailure();
        } catch {
        }
      }
      setIsUploading(false);
    }
  };

  const appendFiles = (appendingFiles: FileUpload[]) => {
    const currentMaxOrder = existingAndUploadedFiles.reduce(
      (max, file) => Math.max(max, file.order ?? -1),
      -1,
    );

    setFiles([
      ...existingAndUploadedFiles,
      ...appendingFiles.map((file, index) => {
        file.order = currentMaxOrder + index + 1;
        file.previewGroup = file.previewGroup ?? true;
        return file;
      }),
    ]);
  };

  useEffect(() => {
    const fileErrorCount = uploadingFiles.filter(
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
  }, [uploadingFiles]);

  return (
    <>
      <Stack spacing="sm" mb={20}>
        {editablePermissions.canEditShareThemeColor ? (
          <ThemeColorPicker
            value={shareAccentColor}
            onChange={(color) => setShareAccentColor(color || "#00ff5a")}
          />
        ) : null}
        {user?.isAdmin ? (
          <Select
            label="Share owner"
            placeholder="Select a site user"
            data={availableUsers.map((entry) => ({
              value: entry.id,
              label: `${entry.username} (${entry.email})`,
            }))}
            value={shareOwnerId || null}
            onChange={(value) => setShareOwnerId(value || "")}
            searchable
            nothingFound="No users found"
          />
        ) : null}
        <TextInput
          label="Share name"
          placeholder="Optional share name"
          value={shareName}
          onChange={(event) => setShareName(event.currentTarget.value)}
          disabled={!editablePermissions.canEditShareName}
        />
        <Textarea
          label="Description"
          placeholder="Optional description"
          minRows={3}
          autosize
          value={shareDescription}
          onChange={(event) => setShareDescription(event.currentTarget.value)}
          disabled={!editablePermissions.canEditShareDescription}
        />
        <Select
          label="Preview style"
          description="Full shows file info on each card. Consolidated keeps cards slimmer and moves details into the info button."
          data={[
            { value: "full", label: "Full preview" },
            { value: "consolidated", label: "Consolidated preview" },
          ]}
          value={previewStyle}
          onChange={(value) =>
            setPreviewStyle(value === "consolidated" ? "consolidated" : "full")
          }
          disabled={isUploading}
        />
      </Stack>
      <Group position="right" mb={20}>
        <Button loading={isUploading} disabled={!dirty} onClick={() => save()}>
          <FormattedMessage id="common.button.save" />
        </Button>
      </Group>
      {editablePermissions.canAddFiles ? (
        <Dropzone
          title={t("share.edit.append-upload")}
          maxShareSize={effectiveMaxShareSize ?? fallbackMaxShareSize}
          onFilesChanged={appendFiles}
          isUploading={isUploading}
        />
      ) : null}
      {existingAndUploadedFiles.length > 0 && (
        <>
          {editablePermissions.canEditShareFileOrder ? (
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
          ) : null}
          <FileList
            files={existingAndUploadedFiles}
            setFiles={setFiles}
            allowRename={editablePermissions.canEditShareFileOrder}
            allowReorder={editablePermissions.canEditShareFileOrder}
            allowRemove={editablePermissions.canRemoveFiles}
            showPreviewGroupingControls={
              editablePermissions.canEditShareFileOrder
            }
          />
          {editablePermissions.canEditShareFileOrder ? (
            <PreviewLayoutEditor
              opened={previewLayoutOpen}
              files={existingAndUploadedFiles}
              setFiles={setFiles}
              onClose={() => setPreviewLayoutOpen(false)}
              shareId={shareId}
              accentColor={shareAccentColor}
            />
          ) : null}
        </>
      )}
    </>
  );
};
export default EditableUpload;
