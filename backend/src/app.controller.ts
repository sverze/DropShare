import { Controller, Get, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { ConfigService } from "./config/config.service";
import { PrismaService } from "./prisma/prisma.service";
import { join } from "path";
import * as sharp from "sharp";

const FALLBACK_ACCENT = "#00ff5a";

function hexToRgb(hex: string) {
  const normalized = hex.slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function normalizeAccentColor(value: string | undefined, fallback: string): string {
  const normalized = (value || fallback).trim().toLowerCase();
  const prefixed = normalized.startsWith("#") ? normalized : `#${normalized}`;

  return /^#[0-9a-f]{6}$/i.test(prefixed) ? prefixed : fallback;
}

@Controller("/")
export class AppController {
  constructor(
    private prismaService: PrismaService,
    private configService: ConfigService,
  ) {}

  @Get("health")
  async health(@Res({ passthrough: true }) res: Response) {
    try {
      await this.prismaService.config.findMany();
      return "OK";
    } catch {
      res.statusCode = 500;
      return "ERROR";
    }
  }

  @Get("manifest")
  async manifest(@Res() res: Response) {
    const read = (key: string, fallback: string) => {
      try {
        const value = this.configService.get(key as `${string}.${string}`);
        return typeof value === "string" && value.trim() ? value.trim() : fallback;
      } catch {
        return fallback;
      }
    };

    const appName = read("general.appName", "This site");
    const sizes = [48, 72, 96, 128, 144, 152, 192, 384, 512];

    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      name: appName,
      short_name: appName,
      description: "Secure file sharing made simple",
      theme_color: normalizeAccentColor(
        read("general.themeDarkAccent", FALLBACK_ACCENT),
        FALLBACK_ACCENT,
      ),
      background_color: normalizeAccentColor(
        read("general.themeDarkBackground", "#0a0f0e"),
        "#0a0f0e",
      ),
      display: "standalone",
      orientation: "portrait",
      scope: "/",
      start_url: "/",
      icons: sizes.map((size) => ({
        src: `img/icons/icon-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any maskable",
      })),
    });
  }

  @Get("share-logo")
  async shareLogo(
    @Query("accent") accent: string | undefined,
    @Res() res: Response,
  ) {
    try {
      let siteAccent = FALLBACK_ACCENT;
      try {
        siteAccent =
          normalizeAccentColor(
            this.configService.get("general.themeDarkAccent"),
            FALLBACK_ACCENT,
          ) ?? FALLBACK_ACCENT;
      } catch {
      }

      const accentColor = normalizeAccentColor(accent, siteAccent);
      const logoPath = join(process.cwd(), "..", "frontend", "public", "img", "logo.png");

      if (this.configService.get("general.themeLogoIsOpaque") === true) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.send(await sharp(logoPath).png().toBuffer());
        return;
      }
      const logo = sharp(logoPath).ensureAlpha();
      const metadata = await logo.metadata();
      const width = metadata.width || 1024;
      const height = metadata.height || 1024;
      const alphaMask = await sharp(logoPath)
        .ensureAlpha()
        .extractChannel("alpha")
        .raw()
        .toBuffer();
      const { r, g, b } = hexToRgb(accentColor);
      const pngBuffer = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r, g, b },
        },
      })
        .joinChannel(alphaMask, {
          raw: {
            width,
            height,
            channels: 1,
          },
        })
        .png({
          compressionLevel: 9,
          palette: false,
        })
        .toBuffer();

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(pngBuffer);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate share logo" });
    }
  }
}
