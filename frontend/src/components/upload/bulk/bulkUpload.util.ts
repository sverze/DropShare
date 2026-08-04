
import pLimit from "p-limit";
import { FileUpload } from "../../../types/File.type";
import { CreateShare } from "../../../types/share.type";
import shareService from "../../../services/share.service";
import { generateAvailableLink } from "../../../utils/share-link.util";
import { uploadFileInChunks } from "../../../utils/chunkedUpload.util";

const LARGE_FILE_MULTIPART_THRESHOLD = 2 * 1024 * 1024 * 1024;
const LARGE_FILE_MULTIPART_PART_SIZE = 128 * 1024 * 1024;
const MAX_CONCURRENT_PARTS = 8;

export type BulkShareOptions = Omit<CreateShare, "id" | "name"> & {
  removeExtensionFromShareName?: boolean;
  shareNamePrefix?: string;
};

export type BulkSubmitHandler = (..._args: [BulkShareOptions]) => void;

export type BulkUploadContext = {
  shareIdLength: number;
  multipartThreshold: number;
  multipartPartSize: number;
  defaultAccentColor: string;
  // Whether object storage is on. Multipart and presigned direct uploads both
  // need it; without it every file goes through the backend in chunks.
  storageEnabled: boolean;
  chunkSize: number;
};

function getEffectiveMultipartPartSize(
  fileSize: number,
  configuredPartSize: number,
): number {
  if (fileSize >= LARGE_FILE_MULTIPART_THRESHOLD) {
    return Math.max(configuredPartSize, LARGE_FILE_MULTIPART_PART_SIZE);
  }

  return configuredPartSize;
}

export const stripExtension = (fileName: string) => {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return fileName;
  }

  return fileName.slice(0, lastDotIndex);
};

export const buildMassShareName = (
  fileName: string,
  options: Pick<
    BulkShareOptions,
    "removeExtensionFromShareName" | "shareNamePrefix"
  >,
) => {
  const resolvedFileName = options.removeExtensionFromShareName
    ? stripExtension(fileName)
    : fileName;
  const resolvedBaseName = stripExtension(fileName);
  const template = options.shareNamePrefix?.trim();

  if (!template) {
    return resolvedFileName;
  }

  if (template.includes("[filename]") || template.includes("[basename]")) {
    return template
      .replaceAll("[filename]", resolvedFileName)
      .replaceAll("[basename]", resolvedBaseName)
      .trim();
  }

  return `${template}${template.endsWith(" ") ? "" : " "}${resolvedFileName}`.trim();
};

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

export const normalizeBulkOptions = (
  bulkOptions: BulkShareOptions,
  defaultAccentColor: string,
): BulkShareOptions => {
  const recipients = Array.isArray(bulkOptions.recipients)
    ? bulkOptions.recipients.filter(Boolean)
    : [];
  const security = {
    password: bulkOptions.security?.password || undefined,
    maxViews: bulkOptions.security?.maxViews || undefined,
  };

  return {
    expiration: bulkOptions.expiration || "7-days",
    recipients,
    description: bulkOptions.description || undefined,
    accentColor: bulkOptions.accentColor || defaultAccentColor,
    shareWithGroup: bulkOptions.shareWithGroup,
    removeExtensionFromShareName: Boolean(
      bulkOptions.removeExtensionFromShareName,
    ),
    shareNamePrefix: bulkOptions.shareNamePrefix || undefined,
    groupId: bulkOptions.shareWithGroup ? bulkOptions.groupId || null : null,
    security: security.password || security.maxViews ? security : {},
  };
};

async function uploadMultipart(
  file: File,
  shareId: string,
  fileId: string,
  fileName: string,
  partSize: number,
  onProgress: (_percent: number, _uploadedBytes: number) => void,
) {
  const totalParts = Math.ceil(file.size / partSize);
  let uploadId: string | undefined;
  let key: string | undefined;

  const uploadChunkWithProgress = (
    url: string,
    chunk: Blob,
    contentType: string,
    onChunkProgress: (_loadedBytes: number) => void,
  ) =>
    new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      xhr.setRequestHeader("Content-Type", contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onChunkProgress(event.loaded);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onChunkProgress(chunk.size);
          const etag = xhr.getResponseHeader("ETag");
          if (!etag) {
            reject(new Error("No ETag returned for uploaded part"));
            return;
          }
          resolve(etag.replace(/"/g, ""));
          return;
        }

        reject(new Error(`Failed to upload part: ${xhr.status}`));
      };

      xhr.onerror = () =>
        reject(new Error("Network error while uploading part"));
      xhr.onabort = () => reject(new Error("Upload cancelled"));
      xhr.send(chunk);
    });

  try {
    const initResponse = await fetch("/api/storage/multipart/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shareId,
        fileId,
        fileName,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
      }),
    });

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

    const emitProgress = () => {
      const activeUploadedBytes = Array.from(inFlightPartBytes.values()).reduce(
        (sum, value) => sum + value,
        0,
      );
      const uploadedBytes = Math.min(
        committedBytes + activeUploadedBytes,
        file.size,
      );
      onProgress((uploadedBytes / file.size) * 95, uploadedBytes);
    };

    const partNumbers = Array.from(
      { length: totalParts },
      (_, index) => index + 1,
    );
    const urlsResponse = await fetch("/api/storage/multipart/part-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, uploadId, partNumbers }),
    });

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
          emitProgress();

          const etag = await uploadChunkWithProgress(
            url,
            chunk,
            file.type || "application/octet-stream",
            (loadedBytes) => {
              inFlightPartBytes.set(partNumber, loadedBytes);
              emitProgress();
            },
          );

          committedBytes += chunk.size;
          inFlightPartBytes.delete(partNumber);
          completedParts.push({
            PartNumber: partNumber,
            ETag: etag,
          });
          emitProgress();
        }),
      ),
    );

    const completeResponse = await fetch("/api/storage/multipart/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        uploadId,
        parts: [...completedParts].sort((a, b) => a.PartNumber - b.PartNumber),
      }),
    });

    if (!completeResponse.ok) {
      throw new Error("Failed to complete multipart upload");
    }

    onProgress(97, file.size);
    await shareService.confirmUpload(shareId, fileId, fileName, file.size);
    onProgress(100, file.size);
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

export const uploadSingleFileAsShare = async (
  file: FileUpload,
  fileIndex: number,
  bulkOptions: BulkShareOptions,
  ctx: BulkUploadContext,
  setFileProgress: (
    _fileIndex: number,
    _progress: number,
    _uploadedBytes?: number,
  ) => void,
): Promise<{ fileName: string; link: string }> => {
  const uploadName = file.editableName || file.name;
  const shareName = buildMassShareName(uploadName, bulkOptions);
  const shareId = await generateAvailableLink(ctx.shareIdLength);
  const sharePayload: CreateShare = {
    id: shareId,
    name: shareName,
    expiration: bulkOptions.expiration,
    recipients: bulkOptions.recipients,
    description: bulkOptions.description,
    accentColor: bulkOptions.accentColor,
    security: bulkOptions.security,
    shareWithGroup: bulkOptions.shareWithGroup,
    groupId: bulkOptions.shareWithGroup ? bulkOptions.groupId || null : null,
  };

  const createdShare = await shareService.create(sharePayload);
  const fileId = crypto.randomUUID();

  try {
    if (ctx.storageEnabled && file.size > ctx.multipartThreshold) {
      const effectivePartSize = getEffectiveMultipartPartSize(
        file.size,
        ctx.multipartPartSize,
      );
      await uploadMultipart(
        file,
        createdShare.id,
        fileId,
        uploadName,
        effectivePartSize,
        (progress, uploadedBytes) => {
          setFileProgress(fileIndex, progress, uploadedBytes);
        },
      );
      await persistLyricsIfNeeded(createdShare.id, fileId, file);
    } else {
      const uploadUrlResponse = await shareService.getUploadUrl(
        createdShare.id,
        fileId,
        uploadName,
        file.size,
      );

      if (uploadUrlResponse.useChunkedUpload || !uploadUrlResponse.uploadUrl) {
        // No presigned URL, so send the file through the backend. The server
        // records it once the last chunk lands, hence no confirmUpload here.
        await uploadFileInChunks(
          createdShare.id,
          file,
          { id: fileId, name: uploadName },
          ctx.chunkSize,
          (progress, uploadedBytes) => {
            setFileProgress(fileIndex, progress, uploadedBytes);
          },
        );
      } else {
        await shareService.uploadFileDirectToR2(
          uploadUrlResponse.uploadUrl,
          file,
          {
            totalTimeoutMs: Math.max(
              90_000,
              90_000 + Math.ceil(file.size / (1024 * 1024)) * 2_500,
            ),
            stallTimeoutMs: Math.max(
              30_000,
              30_000 + Math.ceil(file.size / (1024 * 1024)) * 750,
            ),
          },
          (progress, loadedBytes) => {
            setFileProgress(fileIndex, progress * 0.95, loadedBytes * 0.95);
          },
        );

        await shareService.confirmUpload(
          createdShare.id,
          fileId,
          uploadName,
          file.size,
        );
      }

      await persistLyricsIfNeeded(createdShare.id, fileId, file);
      setFileProgress(fileIndex, 100, file.size);
    }

    await shareService.completeShare(createdShare.id);

    return {
      fileName: uploadName,
      link: `${window.location.origin}/s/${createdShare.id}`,
    };
  } catch (error) {
    setFileProgress(fileIndex, -1);
    throw error;
  }
};

export const downloadManifest = (
  entries: Array<{ fileName: string; link: string }>,
): string => {
  const lines = [
    "Bulk Upload Links",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    ...entries.flatMap((entry) => [`${entry.fileName}\t${entry.link}`, ""]),
  ];

  const fileName = `bulk-share-links-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.txt`;
  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return fileName;
};
