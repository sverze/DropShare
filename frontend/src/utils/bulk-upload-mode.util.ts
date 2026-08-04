export type BulkUploadMode = "page" | "modal";

export const getBulkUploadMode = (
  getConfig: (_key: string) => unknown,
): BulkUploadMode => {
  try {
    return getConfig("share.bulkUploadMode") === "modal" ? "modal" : "page";
  } catch {
    return "page";
  }
};

