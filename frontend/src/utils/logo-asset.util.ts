export const logoVersion = (get: (_key: string) => unknown): string => {
  try {
    return String(get("general.themeLogoVersion") ?? "").trim();
  } catch {
    return "";
  }
};

export const versionedAsset = (path: string, version: string): string =>
  version ? `${path}?v=${encodeURIComponent(version)}` : path;
