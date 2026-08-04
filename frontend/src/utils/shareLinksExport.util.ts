import { FileMetaData } from "../types/File.type";
import { MyShare } from "../types/share.type";

const safeFileName = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "share-links";

const getShareName = (share: MyShare) => share.name || share.id;

const getFiles = (share: MyShare): FileMetaData[] =>
  Array.isArray(share.files) ? (share.files as FileMetaData[]) : [];

export const buildShareLinksExportText = (
  shares: MyShare[],
  origin: string,
  title = "Share links export",
) => {
  const lines: string[] = [
    title,
    `Generated: ${new Date().toLocaleString()}`,
    `Share count: ${shares.length}`,
    "",
  ];

  shares.forEach((share, shareIndex) => {
    const shareName = getShareName(share);
    const shareUrl = `${origin}/s/${share.id}`;
    const files = getFiles(share);

    lines.push(`${shareIndex + 1}. ${shareName}`);
    lines.push(`Share link: ${shareUrl}`);

    if (files.length === 0) {
      lines.push("Files: No files found for this share.");
      lines.push("");
      return;
    }

    files
      .slice()
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .forEach((file, fileIndex) => {
        const fileName = file.name || `File ${fileIndex + 1}`;
        const fileUrl = `${origin}/api/shares/${share.id}/files/${file.id}`;
        const embedUrl = `${origin}/embed/share/${share.id}?file=${file.id}`;
        const iframe = `<iframe src="${embedUrl}" width="720" height="300" loading="lazy" allow="fullscreen; clipboard-write" style="border:0;border-radius:24px;max-width:100%;"></iframe>`;

        lines.push(`  ${fileIndex + 1}. ${fileName}`);
        lines.push(`     File link: ${fileUrl}`);
        lines.push(`     Embed preview: ${embedUrl}`);
        lines.push(`     Embed iframe: ${iframe}`);
      });

    lines.push("");
  });

  return lines.join("\n");
};

export const downloadShareLinksTextFile = (
  shares: MyShare[],
  origin: string,
  title: string,
  fileName: string,
) => {
  const text = buildShareLinksExportText(shares, origin, title);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${safeFileName(fileName)}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
