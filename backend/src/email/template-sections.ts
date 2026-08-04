
const OPEN_WRAP = "(?:<!--\\s*)?";
const CLOSE_WRAP = "(?:\\s*-->)?";

const sectionRe = () =>
  new RegExp(
    `${OPEN_WRAP}\\{\\{([#^])\\s*([a-zA-Z0-9_]+)\\s*\\}\\}${CLOSE_WRAP}` +
      `([\\s\\S]*?)` +
      `${OPEN_WRAP}\\{\\{/\\s*\\2\\s*\\}\\}${CLOSE_WRAP}`,
    "gi",
  );

const markerRe = () =>
  new RegExp(
    `${OPEN_WRAP}\\{\\{[#^/]\\s*[a-zA-Z0-9_]+\\s*\\}\\}${CLOSE_WRAP}`,
    "gi",
  );

export function renderSections(
  input: string,
  isPresent: (_name: string) => boolean | undefined,
): string {
  return input.replace(
    sectionRe(),
    (match, kind: string, name: string, body: string) => {
      const present = isPresent(name);
      if (present === undefined) return match;
      return present === (kind === "#") ? body : "";
    },
  );
}

export function sectionPresence(
  vars: Record<string, string>,
): (_name: string) => boolean | undefined {
  const lookup = new Map(
    Object.entries(vars).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return (name: string) => {
    const key = name.toLowerCase();
    if (!lookup.has(key)) return undefined;
    return String(lookup.get(key) ?? "").trim() !== "";
  };
}

export function stripSectionMarkers(input: string): string {
  let out = input;
  for (let i = 0; i < 8; i++) {
    const next = out.replace(markerRe(), "");
    if (next === out) break;
    out = next;
  }
  return out;
}

export function flattenSectionsAsPresent(input: string): string {
  return renderSections(input, () => true);
}

export function hasSectionMarkers(input: string): boolean {
  return /(?:<!--\s*)?\{\{[#^]\s*[a-zA-Z0-9_]+\s*\}\}/i.test(input);
}

export function normaliseTemplateHtml(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function templateSkeleton(input: string): string {
  return normaliseTemplateHtml(
    input.replace(/<([a-zA-Z0-9]+)\b[^>]*?(\/?)>/g, "<$1$2>"),
  );
}
