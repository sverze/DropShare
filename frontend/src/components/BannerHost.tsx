import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import useConfig from "../hooks/config.hook";
import {
  activeBanners,
  dismissBanner,
  parseBanners,
  readDismissed,
} from "../utils/banner.util";
import Banner from "./Banner";

/**
 * Renders every banner configured for the current route. Mounted once in _app
 * so a banner reaches all pages without each page opting in.
 */
const BannerHost = () => {
  const config = useConfig();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Dismissals live in localStorage, so they can only be read after mount.
  // Until then nothing is treated as dismissed, which keeps the server-rendered
  // markup and the first client render identical and avoids a hydration warning.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setDismissed(readDismissed());
  }, []);

  const banners = useMemo(() => {
    let raw: unknown = "";
    try {
      raw = config.get("banners.items");
    } catch {
      // Config key missing (e.g. an install that has not run the migration yet).
      return [];
    }
    return parseBanners(raw);
  }, [config]);

  const visible = useMemo(() => {
    const active = activeBanners(banners, router.asPath || router.pathname);
    return mounted ? active.filter((b) => !dismissed.includes(b.id)) : active;
  }, [banners, router.asPath, router.pathname, dismissed, mounted]);

  if (visible.length === 0) return null;

  const onDismiss = (id: string) => {
    dismissBanner(id);
    setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  return (
    <>
      {visible.map((banner) => (
        <Banner key={banner.id} banner={banner} onDismiss={onDismiss} />
      ))}
    </>
  );
};

export default BannerHost;
