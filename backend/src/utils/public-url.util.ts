const normalizeOrigin = (value: string | undefined, fallback: string): string => {
  const origin = (value || fallback).trim();
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
};

export const DROPSHARE_URL = normalizeOrigin(
  process.env.PUBLIC_DROPSHARE_URL || process.env.APP_URL,
  "http://localhost:3000",
);
export const AUTH_URL = normalizeOrigin(
  process.env.PUBLIC_AUTH_URL || process.env.APP_URL,
  DROPSHARE_URL,
);

export const buildPublicUrl = (origin: string, path: string): string =>
  `${origin}${path.startsWith("/") ? path : `/${path}`}`;
