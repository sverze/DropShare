export function safeRedirectPath(path: string | undefined) {
  if (!path) return "/";

  try {
    if (typeof window !== "undefined") {
      const url = new URL(path, window.location.origin);

      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}` || "/";
      }
    }
  } catch {
  }

  if (!path.startsWith("/")) return `/${path}`;

  return path;
}
