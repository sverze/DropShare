/**
 * Share visibility.
 *
 * Stored as a plain string on `Share.visibility` to match the other string
 * enums in the schema (`virusScanStatus`, `previewStyle`).
 */
export const PUBLIC_VISIBILITY = "PUBLIC";
export const PRIVATE_VISIBILITY = "PRIVATE";

export type ShareVisibility =
  | typeof PUBLIC_VISIBILITY
  | typeof PRIVATE_VISIBILITY;

/** Normalise the `share.defaultShareVisibility` config value. */
export function parseConfiguredVisibility(value: unknown): ShareVisibility {
  return String(value ?? "").trim().toLowerCase() === "public"
    ? PUBLIC_VISIBILITY
    : PRIVATE_VISIBILITY;
}
