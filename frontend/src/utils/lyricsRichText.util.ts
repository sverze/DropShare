const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "br",
  "p",
  "div",
  "span",
  "small",
  "big",
]);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sanitizeStyle = (style: string) => {
  const declarations = style
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const safeDeclarations: string[] = [];

  for (const declaration of declarations) {
    const [property, rawValue] = declaration.split(":").map((part) => part?.trim());
    const value = rawValue?.toLowerCase();

    if (property?.toLowerCase() === "font-size" && value) {
      const numericSize = value.match(/^(\d{1,2})px$/);
      const parsedSize = numericSize ? Number(numericSize[1]) : NaN;

      if (Number.isFinite(parsedSize) && parsedSize >= 8 && parsedSize <= 64) {
        safeDeclarations.push(`font-size: ${parsedSize}px`);
      }
    }
  }

  return safeDeclarations.join("; ");
};

export const sanitizeLyricsHtml = (value: string) => {
  if (!value.trim()) return "";

  const tokenRegex = /<\/?([a-zA-Z0-9]+)(\s+[^>]*)?>/g;
  let output = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(value))) {
    output += escapeHtml(value.slice(lastIndex, match.index));

    const original = match[0];
    const tagName = match[1].toLowerCase();
    const rawAttributes = match[2] || "";
    const isClosing = original.startsWith("</");

    if (ALLOWED_TAGS.has(tagName)) {
      if (isClosing) {
        output += `</${tagName}>`;
      } else if (tagName === "br") {
        output += "<br>";
      } else if (tagName === "span") {
        const styleMatch = rawAttributes.match(/\sstyle=(["'])(.*?)\1/i);
        const safeStyle = styleMatch ? sanitizeStyle(styleMatch[2]) : "";
        output += safeStyle ? `<span style="${safeStyle}">` : "<span>";
      } else {
        output += `<${tagName}>`;
      }
    } else {
      output += escapeHtml(original);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  output += escapeHtml(value.slice(lastIndex));
  return output.replace(/\n/g, "<br>");
};

export const wrapLyricsSelection = (
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
) => {
  const selected = value.slice(start, end);
  const hasSelection = start !== end;

  return {
    text: `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`,
    selectionStart: start + before.length,
    selectionEnd: hasSelection ? start + before.length + selected.length : start + before.length,
  };
};
