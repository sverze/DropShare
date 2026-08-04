import { useEffect } from "react";
import { useRouter } from "next/router";
import { LoadingOverlay } from "@mantine/core";
import { deleteCookie, getCookie } from "cookies-next";
import authService from "../../services/auth.service";

const SignOut = () => {
  const router = useRouter();

  useEffect(() => {
    const handleSignOut = async () => {
      const returnUrl = router.query.returnUrl as string;

      const currentTheme = getCookie("mantine-color-scheme") || "dark";
      // Clear cookies on whatever host this instance is actually served from,
      // so a single distributed image works on any domain.
      const host = window.location.hostname;

      const cookiesToClear = [
        "access_token",
        "refresh_token",
        "dropshare_session",
      ];

      try {
        await authService.signOut({ redirect: false });
      } catch (e) {
      }

      cookiesToClear.forEach((cookie) => {
        deleteCookie(cookie, { path: "/" });
        deleteCookie(cookie, { path: "/", domain: `.${host}` });
        deleteCookie(cookie, { path: "/", domain: host });
      });

      try {
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.setItem("sso_signed_out", "1");
      } catch (e) {
      }

      try {
        sessionStorage.removeItem("sso_check_done");
      } catch (e) {
      }

      if (returnUrl && isAllowedReturnUrl(returnUrl)) {
        const url = new URL(returnUrl);
        url.searchParams.set("logged_out", "1");
        url.searchParams.set("sso_theme", currentTheme as string);
        
        setTimeout(() => {
          window.location.href = url.toString();
        }, 100);
      } else {
        setTimeout(() => {
          window.location.href = `/?logged_out=1&sso_theme=${currentTheme}`;
        }, 100);
      }
    };

    if (router.isReady) {
      handleSignOut();
    }
  }, [router.isReady, router.query.returnUrl]);

  return <LoadingOverlay visible overlayOpacity={1} />;
};

function isAllowedReturnUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    // Same-origin only (the instance's own host or a subdomain of it), so the
    // check works on any domain without a build-time allowlist.
    const host = window.location.hostname;
    return parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

SignOut.getInitialProps = () => {
  return {
    noHeader: true,
    noFooter: true,
  };
};

export default SignOut;
