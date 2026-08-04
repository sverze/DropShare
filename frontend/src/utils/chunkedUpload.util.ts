import shareService from "../services/share.service";

/**
 * Uploads routed through the backend instead of straight to object storage.
 * The only path that works with no object storage configured, and safe when it
 * is: the backend reassembles the chunks and forwards them to the bucket.
 */

export const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024;

/**
 * Must match the server's `share.chunkSize`: it derives the expected chunk
 * index from bytes already on disk, so a different size fails partway through
 * with "unexpected_chunk_index".
 */
export const resolveChunkSize = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHUNK_SIZE;
};

export type ChunkedUploadFile = {
  id: string;
  name: string;
  relativePath?: string;
  order?: number;
  previewGroup?: boolean;
  previewHeader?: string | null;
};

export const uploadFileInChunks = async (
  shareId: string,
  file: File,
  meta: ChunkedUploadFile,
  chunkSize: number,
  onProgress?: (_percent: number, _uploadedBytes: number) => void,
): Promise<void> => {
  const size = resolveChunkSize(chunkSize);

  // A zero-byte file still needs one request, otherwise it is never created.
  let chunks = Math.ceil(file.size / size);
  if (chunks === 0) chunks++;

  for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
    const from = chunkIndex * size;
    const to = from + size;

    const response = await shareService.uploadFile(
      shareId,
      file.slice(from, to),
      meta,
      chunkIndex,
      chunks,
    );

    if (response.id !== meta.id) {
      throw new Error("Upload returned an unexpected file id");
    }

    const uploadedBytes = Math.min(file.size, to);
    onProgress?.(((chunkIndex + 1) / chunks) * 100, uploadedBytes);
  }
};
