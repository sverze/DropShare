import {
  ColorScheme,
  ColorSchemeProvider,
  Container,
  MantineProvider,
  Stack,
  Center,
  Loader,
  Text,
} from "@mantine/core";
import { useColorScheme } from "@mantine/hooks";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import axios from "axios";
import { getCookie, setCookie } from "cookies-next";
import moment from "moment";
import { GetServerSidePropsContext } from "next";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IntlProvider } from "react-intl";
import Header from "../components/header/Header";
import { ConfigContext } from "../hooks/config.hook";
import { UserContext } from "../hooks/user.hook";
import { LOCALES } from "../i18n/locales";
import configService from "../services/config.service";
import userService from "../services/user.service";
import GlobalStyle from "../styles/global.style";
import globalStyle from "../styles/mantine.style";
import {
  buildBrandPalette,
  buildThemeCss,
  isHexColor,
  resolveTheme,
  rgbString,
  shade,
} from "../theme/theme.util";
import Config from "../types/config.type";
import { CurrentUser } from "../types/user.type";
import i18nUtil from "../utils/i18n.util";
import { canAccessAdminRoute } from "../utils/capabilities.util";
import { logoVersion, versionedAsset } from "../utils/logo-asset.util";
import Footer from "../components/footer/Footer";
import BannerHost from "../components/BannerHost";

const excludeDefaultLayoutRoutes: string[] = ["/embed-preview"];
const excludeDefaultLayoutRoutePrefixes: string[] = ["/embed/"];
const excludeDefaultLayoutPrefixes: string[] = [];

const fullWidthRoutes = ["/admin/shares", "/admin/emails"];
const fullWidthRoutePrefixes = ["/admin/config/", "/s/"];

function updateThemeColor(color: string) {
  if (typeof document === "undefined") return;

  let themeColorMeta = document.querySelector<HTMLMetaElement>("meta[name=\"theme-color\"]");
  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.name = "theme-color";
    document.head.appendChild(themeColorMeta);
  }

  themeColorMeta.content = color;
}

const MOMENT_LOCALE_MAP: Record<string, string> = {
  "ar-EG": "ar",
  "cs-CZ": "cs",
  "da-DK": "da",
  "de-DE": "de",
  "el-GR": "el",
  "en-US": "en",
  "es-ES": "es",
  "et-EE": "et",
  "fi-FI": "fi",
  "fr-FR": "fr",
  "hr-HR": "hr",
  "hu-HU": "hu",
  "it-IT": "it",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "nl-BE": "nl-be",
  "pl-PL": "pl",
  "pt-BR": "pt-br",
  "ru-RU": "ru",
  "sl-SI": "sl",
  "sr-CS": "sr",
  "sr-SP": "sr",
  "sv-SE": "sv",
  "th-TH": "th",
  "tr-TR": "tr",
  "uk-UA": "uk",
  "vi-VN": "vi",
  "zh-CN": "zh-cn",
  "zh-TW": "zh-tw",
};

async function applyMomentLocale(locale: string) {
  const momentLocale = MOMENT_LOCALE_MAP[locale] || locale.toLowerCase();

  if (momentLocale === "en") {
    moment.locale("en");
    return;
  }

  try {
    await import(`moment/locale/${momentLocale}`);
    moment.locale(momentLocale);
  } catch {
    moment.locale("en");
  }
}

function useSSO(
  _user: any,
  _applyTheme: (_theme: "light" | "dark") => void,
) {
  return { isExchanging: false, isRedirecting: false };
}

function App({ Component, pageProps }: AppProps) {
  const systemTheme = useColorScheme(pageProps.colorScheme);
  const router = useRouter();

  const [colorScheme, setColorScheme] = useState<ColorScheme>(systemTheme);
  const [user, setUser] = useState<CurrentUser | null>(pageProps.user);
  const [route, setRoute] = useState<string>(pageProps.route);
  const [configVariables, setConfigVariables] = useState<Config[]>(pageProps.configVariables);
  const [isRedirectingFromAdmin, setIsRedirectingFromAdmin] = useState(false);

  const siteTheme = useMemo(
    () => resolveTheme((key) => configService.get(key, configVariables)),
    [configVariables],
  );
  const themeCss = useMemo(() => buildThemeCss(siteTheme), [siteTheme]);

  useEffect(() => {
    document.documentElement.dataset.lsScheme = colorScheme;
  }, [colorScheme]);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    let scrolling = false;

    const onScroll = () => {
      if (!scrolling) {
        scrolling = true;
        document.documentElement.dataset.lsScrolling = "1";
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        scrolling = false;
        delete document.documentElement.dataset.lsScrolling;
      }, 180);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(idleTimer);
      delete document.documentElement.dataset.lsScrolling;
    };
  }, []);

  const mantineTheme = useMemo(
    () => ({
      ...globalStyle,
      colors: {
        ...globalStyle.colors,
        brand: buildBrandPalette(
          siteTheme[colorScheme].accent,
          colorScheme,
        ) as any,
      },
    }),
    [siteTheme, colorScheme],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const flushStalePwaState = async () => {
      try {
        const flushKey = "dropshare-pwa-flush-v1";
        if (sessionStorage.getItem(flushKey)) return;

        sessionStorage.setItem(flushKey, "1");

        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys
              .filter((key) =>
                key.includes("workbox") ||
                key.includes("next") ||
                key.includes("dropshare"),
              )
              .map((key) => caches.delete(key)),
          );
        }
      } catch {
        return;
      }
    };

    void flushStalePwaState();
  }, []);

  useEffect(() => {
    if (pageProps.user && pageProps.user !== user) {
      setUser(pageProps.user);
    }
  }, [pageProps.user]);

  useEffect(() => {
    const checkAuthState = async () => {
      if (typeof window === "undefined") return;
      
      const justLoggedIn = sessionStorage.getItem("just_logged_in");
      
      if (justLoggedIn && !user) {
        sessionStorage.removeItem("just_logged_in");
        window.location.reload();
        return;
      }
      
      if (justLoggedIn && user) {
        sessionStorage.removeItem("just_logged_in");
      }
      
      if (!user) {
        try {
          const response = await fetch("/api/users/me", {
            credentials: "include",
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          }
        } catch (e) {
          console.error("Failed to fetch user after auth redirect:", e);
        }
      }
    };
    
    checkAuthState();
  }, [user]);

  const toggleColorScheme = useCallback((value: ColorScheme) => {
    const theme = value ?? "dark";
    setColorScheme(theme);
    setCookie("mantine-color-scheme", theme, {
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    try {
      const prefs = JSON.parse(localStorage.getItem("userPreferences") || "{}");
      prefs.colorScheme = theme;
      localStorage.setItem("userPreferences", JSON.stringify(prefs));
    } catch {
    }
    
    if (user) {
      setUser({ ...user, theme });
      
      fetch("/api/users/me/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme }),
      }).catch((err) => {
        console.error("Failed to save theme to account:", err);
      });
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    const currentUser = await userService.getCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  const { isExchanging, isRedirecting } = useSSO(user, toggleColorScheme);

  const isRedirectingToTools = false;

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const currentUser = user || pageProps.user;
    if (!currentUser?.id) return;
    
    fetch("/api/users/me", { credentials: "include" })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.theme) {
          const currentCookie = getCookie("mantine-color-scheme") || "dark";
          if (data.theme !== currentCookie) {
            setColorScheme(data.theme as ColorScheme);
            setCookie("mantine-color-scheme", data.theme, {
              sameSite: "lax",
              maxAge: 60 * 60 * 24 * 365,
              path: "/",
            });
          }
        }
      })
      .catch(() => {});
  }, [user?.id, pageProps.user?.id]);
  
  useEffect(() => {
    if (typeof window === "undefined" || user) return;
    
    try {
      const prefs = localStorage.getItem("userPreferences");
      if (prefs) {
        const parsed = JSON.parse(prefs);
        if (parsed.colorScheme === "dark" || parsed.colorScheme === "light") {
          const currentCookie = document.cookie.includes("mantine-color-scheme=light") ? "light" : "dark";
          if (parsed.colorScheme !== currentCookie) {
            setColorScheme(parsed.colorScheme);
            setCookie("mantine-color-scheme", parsed.colorScheme, {
              sameSite: "lax",
              maxAge: 60 * 60 * 24 * 365,
              path: "/",
            });
          }
        }
      }
    } catch {
    }
  }, [user]);

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      setRoute(url);
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!route.startsWith("/admin")) {
      setIsRedirectingFromAdmin(false);
      return;
    }

    if (canAccessAdminRoute(user, route)) {
      setIsRedirectingFromAdmin(false);
      return;
    }

    setIsRedirectingFromAdmin(true);
    router.replace("/upload");
  }, [route, router, user?.isAdmin, user?.capabilities]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const isEmbed = router.pathname.startsWith("/embed");
    const isShare =
      router.pathname === "/share/[shareId]" ||
      router.pathname === "/s/[shareId]";
    const isDark = colorScheme === "dark";
    const styleId = "domain-background-style";
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    
    let backgroundStyle: string;
    if (isEmbed) {
      backgroundStyle = isDark ? "#040908" : "#f7fbf8";
    } else if (isShare) {
      backgroundStyle = "var(--ls-share-bg)";
    } else {
      backgroundStyle = "var(--ls-page-bg)";
    }
    
    style.textContent = `html, body { background: ${backgroundStyle} !important; background-attachment: fixed !important; }`;
    document.head.appendChild(style);
    document.documentElement.style.background = backgroundStyle;
    document.documentElement.style.backgroundAttachment = "fixed";
    document.body.style.background = backgroundStyle;
    document.body.style.backgroundAttachment = "fixed";
  }, [colorScheme, pageProps.ogData?.accentColor, router.pathname]);

  const language = useRef(pageProps.language);
  useEffect(() => {
    applyMomentLocale(language.current);
  }, []);

  const isDriveRoute = false;
  const isKitRoute = false;
  const isAuthRoute = route.startsWith("/auth");
  const isEmbedRoute = route.startsWith("/embed");
  const isShareEditRoute =
    route.startsWith("/share/") && route.endsWith("/edit");
  const isShareRoute =
    !isShareEditRoute &&
    (route.startsWith("/share/") ||
      route.startsWith("/s/") ||
      route.startsWith("/d/"));

  const faviconVersion = logoVersion((key) =>
    configService.get(key, configVariables),
  );
  const isHomeRoute = route === "/" || (route ?? "").startsWith("/?");
  const defaultThemeColor = siteTheme[colorScheme].accent;

  // Repoint the site header at the share's own accent, emitted with the
  // server-rendered theme CSS rather than set from an effect. The header is
  // position:fixed with a backdrop-filter, so it becomes a composited layer on
  // first paint and does not repaint when a custom property it depends on
  // changes afterwards. Emitting it here means the first frame is already
  // correct. 0.15 mirrors how the site's own header background relates to its
  // accent.
  const shareAccent = isShareRoute
    ? (pageProps.ogData?.accentColor as string | undefined)
    : undefined;
  const shareHeaderCss =
    shareAccent && isHexColor(shareAccent)
      ? `:root{--ls-header-bg:${shade(shareAccent, 0.15)};--ls-header-bg-rgb:${rgbString(
          shade(shareAccent, 0.15),
        )};--ls-header-border-rgb:${rgbString(shareAccent)};}`
      : "";

  useEffect(() => {
    if (!isShareRoute) {
      updateThemeColor(defaultThemeColor);
    }
  }, [defaultThemeColor, isShareRoute]);

  const showDefaultDropShareAtmosphere =
    colorScheme === "dark" &&
    !isDriveRoute &&
    !isKitRoute &&
    !isAuthRoute &&
    !isEmbedRoute &&
    !isShareRoute;

  const getLoaderColor = () => "green";

  if (isExchanging || isRedirecting || isRedirectingToTools || isRedirectingFromAdmin) {
    return (
      <MantineProvider
        withGlobalStyles
        withNormalizeCSS
        theme={{
          ...globalStyle,
          colorScheme: "dark",
          colors: {
            ...globalStyle.colors,
            brand: buildBrandPalette(siteTheme.dark.accent, "dark") as any,
          },
        }}
      >
        <Center style={{ height: "100vh" }}>
          <Stack align="center" spacing="md">
            <Loader size="lg" color={getLoaderColor()} />
            <Text color="dimmed">
              {isExchanging
                ? "Signing you in..."
                : isRedirectingToTools || isRedirectingFromAdmin
                  ? "Loading..."
                  : "Checking login status..."}
            </Text>
          </Stack>
        </Center>
      </MantineProvider>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no" />
        <link
          rel="icon"
          href={versionedAsset("/img/favicon.ico", faviconVersion)}
          sizes="any"
          key="favicon-ico"
        />
        <link
          rel="apple-touch-icon"
          href={versionedAsset("/img/icons/icon-192x192.png", faviconVersion)}
          key="apple-touch-icon"
        />
        {!isShareRoute && (
          <meta name="theme-color" content={defaultThemeColor} key="theme-color" />
        )}
        <style
          id="dropshare-theme-vars"
          key="dropshare-theme-vars"
          dangerouslySetInnerHTML={{ __html: themeCss + shareHeaderCss }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var pathname = window.location.pathname;
                var isEmbed = pathname.startsWith('/embed');
                var isShare = !pathname.endsWith('/edit') && (pathname.startsWith('/share/') || pathname.startsWith('/s/'));
                                var isDark = document.cookie.includes('mantine-color-scheme=dark') ||
                            (!document.cookie.includes('mantine-color-scheme=') && window.matchMedia('(prefers-color-scheme: dark)').matches);

                // Set before first paint so the light palette isn't applied a
                // frame late; React re-asserts it once it hydrates.
                document.documentElement.dataset.lsScheme = isDark ? 'dark' : 'light';

                var backgroundStyle;
                if (isEmbed) {
                  backgroundStyle = isDark ? '#040908' : '#f7fbf8';
                } else if (isShare) {
                  backgroundStyle = 'var(--ls-share-bg)';
                } else {
                  backgroundStyle = 'var(--ls-page-bg)';
                }

                var style = document.createElement('style');
                style.textContent = 'body { background: ' + backgroundStyle + '; background-attachment: fixed; }';
                document.head.appendChild(style);
                
                // Also set on body if it exists
                if (document.body) {
                  document.body.style.background = backgroundStyle;
                  document.body.style.backgroundAttachment = 'fixed';
                }
              })();
            `,
          }}
        />
      </Head>
      <IntlProvider
        messages={i18nUtil.getLocaleByCode(language.current)?.messages}
        locale={language.current}
        defaultLocale={LOCALES.ENGLISH.code}
      >
        <MantineProvider
          key={`theme-${colorScheme}`}
          withGlobalStyles
          withNormalizeCSS
          theme={{ ...mantineTheme, colorScheme }}
        >
          <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
            <GlobalStyle
              disableDefaultAtmosphere={isShareRoute}
            />
            <Notifications 
              position="bottom-right"
              limit={5}
              containerWidth={360}
              autoClose={4000}
              styles={{ root: { marginBottom: 70 } }}
            />
            <ConfigContext.Provider
              value={{
                configVariables,
                refresh: async () => {
                  setConfigVariables(await configService.list());
                },
              }}
            >
                <UserContext.Provider
                  value={{
                    user,
                    refreshUser,
                  }}
                >
                  <ModalsProvider>
                  {showDefaultDropShareAtmosphere && (
                    <>
                      <div
                        style={{
                          position: "fixed",
                          inset: 0,
                          pointerEvents: "none",
                          zIndex: 0,
                          background: `
                            radial-gradient(circle at 12% 18%, rgba(var(--ls-accent-rgb), 0.18) 0%, transparent 34%),
                            radial-gradient(circle at 88% 14%, rgba(var(--ls-accent-rgb), 0.12) 0%, transparent 26%),
                            radial-gradient(circle at 50% 100%, rgba(var(--ls-accent-rgb), 0.08) 0%, transparent 42%),
                            linear-gradient(180deg, rgba(3, 10, 8, 0.96) 0%, rgba(4, 9, 8, 0.985) 100%)
                          `,
                        }}
                      />
                      <div
                        style={{
                          position: "fixed",
                          inset: 0,
                          pointerEvents: "none",
                          zIndex: 0,
                          opacity: 0.03,
                          backgroundImage:
                            "radial-gradient(var(--ls-accent) 1px, transparent 1px)",
                          backgroundSize: "28px 28px",
                        }}
                      />
                      <div
                        style={{
                          position: "fixed",
                          top: "-30%",
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: "100%",
                          height: "60%",
                          pointerEvents: "none",
                          zIndex: 0,
                          background:
                            "radial-gradient(ellipse at center, rgba(var(--ls-accent-rgb), 0.06) 0%, transparent 60%)",
                        }}
                      />
                    </>
                  )}
                  {isAuthRoute ||
                  excludeDefaultLayoutRoutes.includes(router.pathname) ||
                  excludeDefaultLayoutRoutePrefixes.some((p) => route.startsWith(p)) ||
                  excludeDefaultLayoutPrefixes.some((p) => route.startsWith(p)) ? (
                    <Component {...pageProps} />
                  ) : fullWidthRoutes.some(r => route.startsWith(r)) ||
                    isShareRoute ||
                    isHomeRoute ||
                    fullWidthRoutePrefixes.some((p) => route.startsWith(p)) ? (
                    <Stack justify="space-between" sx={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
                      <div>
                        <Header />
                        <BannerHost />
                        <Component {...pageProps} />
                      </div>
                      <Footer />
                    </Stack>
                  ) : (
                    <Stack justify="space-between" sx={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
                      <div>
                        <Header />
                        <BannerHost />
                        <Container>
                          <Component {...pageProps} />
                        </Container>
                      </div>
                      <Footer />
                    </Stack>
                  )}
                  </ModalsProvider>
                </UserContext.Provider>
              </ConfigContext.Provider>
          </ColorSchemeProvider>
        </MantineProvider>
      </IntlProvider>
    </>
  );
}

App.getInitialProps = async ({ ctx }: { ctx: GetServerSidePropsContext }) => {
  let pageProps: {
    user?: CurrentUser;
    configVariables?: Config[];
    route?: string;
    colorScheme: ColorScheme;
    language?: string;
  } = {
    route: ctx.resolvedUrl,
    colorScheme: (getCookie("mantine-color-scheme", ctx) as ColorScheme) ?? "dark",
  };

  if (ctx.req) {
    const apiURL = process.env.API_URL || "http://localhost:8080";
    const cookieHeader = ctx.req.headers.cookie;

    pageProps.user = await axios(`${apiURL}/api/users/me`, {
      headers: { cookie: cookieHeader },
    })
      .then((res) => res.data)
      .catch(() => null);

    pageProps.configVariables = (await axios(`${apiURL}/api/configs`)).data;
    pageProps.route = ctx.req.url;

    const requestLanguage = i18nUtil.getLanguageFromAcceptHeader(
      ctx.req.headers["accept-language"],
    );

    pageProps.language = ctx.req.cookies["language"] ?? requestLanguage;

    if (
      pageProps.route?.startsWith("/admin") &&
      !canAccessAdminRoute(pageProps.user, pageProps.route)
    ) {
      ctx.res?.writeHead(302, { Location: "/upload" });
      ctx.res?.end();
    }
  }
  return { pageProps };
};

export default App;
