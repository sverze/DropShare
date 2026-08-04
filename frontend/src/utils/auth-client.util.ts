export type AuthClientId = "dropshare";

export type AuthClient = {
  id: AuthClientId;
  name: string;
  accent: string;
  description: string;
  authTitle: string;
  logoSrc: string;
};

const DEFAULT_CLIENT: AuthClient = {
  id: "dropshare",
  name: "",
  accent: "var(--ls-accent)",
  description: "",
  authTitle: "",
  logoSrc: "/img/logo.png",
};

export const getAuthClient = (_client?: string | string[]): AuthClient =>
  DEFAULT_CLIENT;

export const getAuthClientFromRedirect = (
  _redirect?: string | string[],
): AuthClient => DEFAULT_CLIENT;

export const authClientQuery = (_client?: AuthClientId): string => "";
