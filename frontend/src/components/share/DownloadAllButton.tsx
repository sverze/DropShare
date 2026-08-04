import { Button, useMantineTheme } from "@mantine/core";
import React, { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { TbDownload } from "react-icons/tb";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import toast from "../../utils/toast.util";
import { rgbString as hexToRgb } from "../../theme/theme.util";
import useSiteTheme from "../../theme/useSiteTheme";

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex).split(", ").map(Number);
  const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  return brightness > 150 ? "#000000" : "#ffffff";
}

interface DownloadAllButtonProps {
  shareId: string;
  accentColor?: string;
}

const DownloadAllButton = ({ shareId, accentColor }: DownloadAllButtonProps) => {
  const theme = useMantineTheme();
  const siteTheme = useSiteTheme();
  const buttonAccent =
    accentColor ||
    (theme.colorScheme === "dark"
      ? siteTheme.dark.accent
      : siteTheme.light.accent);
  
  const [isZipReady, setIsZipReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const t = useTranslate();

  const downloadAll = async () => {
    setIsLoading(true);
    await shareService
      .downloadFile(shareId, "zip")
      .then(() => setIsLoading(false));
  };

  useEffect(() => {
    shareService
      .getMetaData(shareId)
      .then((share) => setIsZipReady(share.isZipReady))
      .catch(() => {});

    const timer = setInterval(() => {
      shareService
        .getMetaData(shareId)
        .then((share) => {
          setIsZipReady(share.isZipReady);
          if (share.isZipReady) clearInterval(timer);
        })
        .catch(() => clearInterval(timer));
    }, 5000);
    return () => {
      clearInterval(timer);
    };
  }, [shareId]);

  const buttonStyle: React.CSSProperties = {
    background: isHovered 
      ? `linear-gradient(135deg, ${adjustColor(buttonAccent, 15)} 0%, ${buttonAccent} 100%)`
      : `linear-gradient(135deg, ${buttonAccent} 0%, ${adjustColor(buttonAccent, -30)} 100%)`,
    border: "none",
    borderRadius: 12,
    padding: "12px 24px",
    fontWeight: 600,
    fontSize: 14,
    color: getContrastColor(buttonAccent),
    boxShadow: isHovered 
      ? `0 6px 28px rgba(${hexToRgb(buttonAccent)}, 0.5)`
      : `0 4px 20px rgba(${hexToRgb(buttonAccent)}, 0.35)`,
    transition: "all 0.25s ease",
    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
    height: "auto",
    minHeight: 46,
  };

  return (
    <Button
      style={buttonStyle}
      loading={isLoading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        if (!isZipReady) {
          toast.error(t("share.notify.download-all-preparing"));
        } else {
          downloadAll();
        }
      }}
      leftIcon={<TbDownload size={18} />}
    >
      <FormattedMessage id="share.button.download-all" />
    </Button>
  );
};

export default DownloadAllButton;
