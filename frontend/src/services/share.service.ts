import { deleteCookie, setCookie } from "cookies-next";
import mime from "mime-types";
import { FileUploadResponse } from "../types/File.type";

import {
  CreateShare,
  MyReverseShare,
  MyShare,
  MySharesDashboard,
  Share,
  ShareMetaData,
  ShareVirusScan,
} from "../types/share.type";
import api from "./api.service";

const list = async (): Promise<MyShare[]> => {
  return (await api.get(`shares/all`)).data;
};

export type AdminSharesPage = {
  shares: MyShare[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const listAllShares = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  groupId?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<AdminSharesPage> => {
  return (await api.get("shares/all", { params })).data;
};

const bulkDeleteShares = async (body: {
  ids?: string[];
  all?: boolean;
  search?: string;
  userId?: string;
  groupId?: string;
}): Promise<{ deleted: number; failed: number }> => {
  return (await api.post("shares/admin/bulk-delete", body)).data;
};

const bulkAssignGroup = async (body: {
  ids?: string[];
  all?: boolean;
  search?: string;
  userId?: string;
  groupId?: string;
  targetGroupId?: string;
}): Promise<{ updated: number; failed: number }> => {
  return (await api.post("shares/admin/bulk-assign-group", body)).data;
};

const create = async (share: CreateShare, isReverseShare = false) => {
  if (!isReverseShare) {
    deleteCookie("reverse_share_token");
  }
  return (await api.post("shares", share)).data;
};

const completeShare = async (id: string) => {
  const response = (await api.post(`shares/${id}/complete`)).data;
  deleteCookie("reverse_share_token");
  return response;
};

const revertComplete = async (id: string) => {
  return (await api.delete(`shares/${id}/complete`)).data;
};

const relockAfterEditFailure = async (id: string) => {
  return (await api.post(`shares/${id}/relock`)).data;
};

const get = async (id: string): Promise<Share> => {
  return (await api.get(`shares/${id}`)).data;
};

const getFromOwner = async (id: string): Promise<Share> => {
  return (await api.get(`shares/${id}/from-owner`)).data;
};

const getMetaData = async (id: string): Promise<ShareMetaData> => {
  return (await api.get(`shares/${id}/metaData`)).data;
};

const getVirusScanStatus = async (id: string): Promise<ShareVirusScan> => {
  return (await api.get(`shares/${id}/virus-scan`)).data;
};

const startVirusScan = async (id: string): Promise<ShareVirusScan> => {
  return (await api.post(`shares/${id}/virus-scan`)).data;
};

const getFileVirusScanStatus = async (
  shareId: string,
  fileId: string,
): Promise<ShareVirusScan> => {
  return (await api.get(`shares/${shareId}/files/${fileId}/virus-scan`)).data;
};

const startFileVirusScan = async (
  shareId: string,
  fileId: string,
): Promise<ShareVirusScan> => {
  return (await api.post(`shares/${shareId}/files/${fileId}/virus-scan`)).data;
};

const remove = async (id: string) => {
  await api.delete(`shares/${id}`);
};

const update = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    accentColor?: string;
    previewStyle?: "full" | "consolidated";
    creatorId?: string;
    shareWithGroup?: boolean;
    groupId?: string | null;
  },
): Promise<Share> => {
  return (await api.patch(`shares/${id}`, data)).data;
};

const getMyShares = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<MySharesDashboard> => {
  return (await api.get("shares", { params })).data;
};

const getGroupShares = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  groupId?: string;
}): Promise<MySharesDashboard> => {
  return (await api.get("shares/group/all", { params })).data;
};

const getShareToken = async (id: string, password?: string) => {
  await api.post(`/shares/${id}/token`, { password });
};

const isShareIdAvailable = async (id: string): Promise<boolean> => {
  return (
    await api.get(`/shares/isShareIdAvailable/${id}`, {
      params: { _ts: Date.now() },
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    })
  ).data.isAvailable;
};

const doesFileSupportPreview = (fileName: string) => {
  const mimeType = (mime.contentType(fileName) || "").split(";")[0];

  if (!mimeType) return false;

  const supportedMimeTypes = [
    mimeType.startsWith("video/"),
    mimeType.startsWith("image/"),
    mimeType.startsWith("audio/"),
    mimeType.startsWith("text/"),
    mimeType == "application/pdf",
  ];

  return supportedMimeTypes.some((isSupported) => isSupported);
};

const downloadFile = async (shareId: string, fileId: string) => {
  window.location.href = `${window.location.origin}/api/shares/${shareId}/files/${fileId}`;
};

const downloadSelectedArchiveEntries = async (
  shareId: string,
  fileId: string,
  paths: string[],
  downloadName?: string,
) => {
  const response = await api.post(
    `shares/${shareId}/files/${fileId}/archive-download`,
    { paths },
    { responseType: "blob" },
  );

  const blob = new Blob([response.data], { type: "application/zip" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName || "selected-files.zip";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const removeFile = async (shareId: string, fileId: string) => {
  await api.delete(`shares/${shareId}/files/${fileId}`);
};

const updateFile = async (
  shareId: string,
  fileId: string,
  data: {
    name?: string;
    order?: number;
    previewGroup?: boolean;
    previewHeader?: string | null;
    lyricsText?: string;
    lyricsSource?: string;
    lyricsSourceUrl?: string;
    lyricsSyncEnabled?: boolean;
    lyricsSyncedAt?: string;
  },
) => {
  return (await api.patch(`shares/${shareId}/files/${fileId}`, data)).data;
};

const uploadFile = async (
  shareId: string,
  chunk: Blob,
  file: {
    id?: string;
    name: string;
    relativePath?: string;
    order?: number;
    previewGroup?: boolean;
    previewHeader?: string | null;
  },
  chunkIndex: number,
  totalChunks: number,
): Promise<FileUploadResponse> => {
  const params: Record<string, string | number | undefined> = {
    id: file.id,
    name: file.name,
    chunkIndex,
    totalChunks,
  };

  if (file.relativePath && file.relativePath !== file.name) {
    params.relativePath = file.relativePath;
  }
  if (typeof file.order === "number" && Number.isFinite(file.order)) {
    params.order = Math.max(0, Math.trunc(file.order));
  }
  if (typeof file.previewGroup === "boolean") {
    params.previewGroup = String(file.previewGroup);
  }
  if (file.previewHeader) {
    params.previewHeader = file.previewHeader;
  }

  return (
    await api.post(`shares/${shareId}/files`, chunk, {
      headers: { "Content-Type": "application/octet-stream" },
      params,
    })
  ).data;
};

const createReverseShare = async (
  shareExpiration: string,
  maxShareSize: number,
  maxUseCount: number,
  sendEmailNotification: boolean,
  simplified: boolean,
  publicAccess: boolean,
  name?: string,
) => {
  return (
    await api.post("reverseShares", {
      shareExpiration,
      maxShareSize: maxShareSize.toString(),
      maxUseCount,
      sendEmailNotification,
      simplified,
      publicAccess,
      name: name?.trim() || undefined,
    })
  ).data;
};

const getMyReverseShares = async (): Promise<MyReverseShare[]> => {
  return (await api.get("reverseShares")).data;
};

const setReverseShare = async (reverseShareToken: string) => {
  const { data } = await api.get(`/reverseShares/${reverseShareToken}`);
  setCookie("reverse_share_token", reverseShareToken);
  return data;
};

const removeReverseShare = async (id: string) => {
  await api.delete(`/reverseShares/${id}`);
};

const getUploadUrl = async (
  shareId: string,
  fileId: string,
  fileName: string,
  fileSize: number,
  relativePath?: string,
  order?: number,
  previewGroup?: boolean,
  previewHeader?: string | null,
) => {
  const params = new URLSearchParams({
    id: fileId,
    name: fileName,
    size: fileSize.toString(),
  });
  if (relativePath) {
    params.append("relativePath", relativePath);
  }
  if (typeof order === "number" && Number.isFinite(order)) {
    params.append("order", Math.max(0, Math.trunc(order)).toString());
  }
  if (typeof previewGroup === "boolean") {
    params.append("previewGroup", String(previewGroup));
  }
  if (previewHeader) {
    params.append("previewHeader", previewHeader);
  }

  const response = await api.post(
    `shares/${shareId}/files/upload-url?${params}`,
  );
  return response.data as {
    useChunkedUpload: boolean;
    uploadUrl?: string;
    fileId?: string;
  };
};

const confirmUpload = async (
  shareId: string,
  fileId: string,
  fileName: string,
  fileSize: number,
  relativePath?: string,
  order?: number,
  previewGroup?: boolean,
  previewHeader?: string | null,
) => {
  const params = new URLSearchParams({
    id: fileId,
    name: fileName,
    size: fileSize.toString(),
  });
  if (relativePath) {
    params.append("relativePath", relativePath);
  }
  if (typeof order === "number" && Number.isFinite(order)) {
    params.append("order", Math.max(0, Math.trunc(order)).toString());
  }
  if (typeof previewGroup === "boolean") {
    params.append("previewGroup", String(previewGroup));
  }
  if (previewHeader) {
    params.append("previewHeader", previewHeader);
  }

  const response = await api.post(
    `shares/${shareId}/files/confirm-upload?${params}`,
  );
  return response.data as { id: string; name: string };
};

const uploadFileDirectToR2 = async (
  uploadUrl: string,
  file: File | Blob,
  options?: {
    stallTimeoutMs?: number;
    totalTimeoutMs?: number;
  },
  onProgress?: (
    _progress: number,
    _loadedBytes: number,
    _totalBytes: number,
  ) => void,
) => {
  const maxAttempts = 3;
  const stallTimeoutMs = options?.stallTimeoutMs ?? 45_000;
  const totalTimeoutMs = options?.totalTimeoutMs ?? 180_000;

  const attemptUpload = (_attempt: number) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let stallTimer: ReturnType<typeof setTimeout> | null = null;
      let totalTimer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

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

      const succeed = () => {
        if (settled) return;
        settled = true;
        clearStallTimer();
        clearTotalTimer();
        resolve();
      };

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
              `Upload stalled for more than ${Math.round(stallTimeoutMs / 1000)} seconds`,
            ),
          );
        }, stallTimeoutMs);
      };

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress, event.loaded, event.total);
        }
        armStallTimer();
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          succeed();
        } else {
          fail(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        fail(new Error("Upload failed"));
      });

      xhr.addEventListener("abort", () => {
        fail(new Error("Upload aborted"));
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader(
        "Content-Type",
        (file as File).type || "application/octet-stream",
      );
      totalTimer = setTimeout(() => {
        fail(
          new Error(
            `Upload exceeded ${Math.round(totalTimeoutMs / 1000)} seconds`,
          ),
        );
      }, totalTimeoutMs);
      armStallTimer();
      xhr.send(file);
    });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await attemptUpload(attempt);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Upload failed");

      if (attempt >= maxAttempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw lastError || new Error("Upload failed");
};

const getAllShares = list;

export default {
  list,
  create,
  completeShare,
  revertComplete,
  relockAfterEditFailure,
  getShareToken,
  get,
  getFromOwner,
  update,
  remove,
  getMetaData,
  getVirusScanStatus,
  startVirusScan,
  getFileVirusScanStatus,
  startFileVirusScan,
  doesFileSupportPreview,
  getMyShares,
  getGroupShares,
  getAllShares,
  listAllShares,
  bulkDeleteShares,
  bulkAssignGroup,
  isShareIdAvailable,
  downloadFile,
  removeFile,
  updateFile,
  uploadFile,
  setReverseShare,
  createReverseShare,
  getMyReverseShares,
  removeReverseShare,
  getUploadUrl,
  confirmUpload,
  uploadFileDirectToR2,
  downloadSelectedArchiveEntries,
};
