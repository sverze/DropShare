import { Injectable, NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request, Response, NextFunction } from "express";
import { ConfigService } from "../config/config.service";
import { PrismaService } from "../prisma/prisma.service";

function parseUserAgent(ua: string | undefined): { browser: string; os: string; device: string } {
  if (!ua) {
    return { browser: "Unknown", os: "Unknown", device: "Unknown" };
  }

  let browser = "Unknown";
  let os = "Unknown";
  let device = "Desktop";

  if (ua.includes("Firefox/")) {
    browser = "Firefox";
  } else if (ua.includes("Edg/")) {
    browser = "Edge";
  } else if (ua.includes("Chrome/")) {
    browser = "Chrome";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    browser = "Safari";
  } else if (ua.includes("Opera") || ua.includes("OPR/")) {
    browser = "Opera";
  } else if (ua.includes("MSIE") || ua.includes("Trident/")) {
    browser = "Internet Explorer";
  }

  if (ua.includes("Windows NT 10")) {
    os = "Windows 10/11";
  } else if (ua.includes("Windows NT")) {
    os = "Windows";
  } else if (ua.includes("Mac OS X")) {
    os = "macOS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (ua.includes("iPhone") || ua.includes("iPad")) {
    os = "iOS";
  }

  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) {
    device = "Mobile";
  } else if (ua.includes("iPad") || ua.includes("Tablet")) {
    device = "Tablet";
  } else if (ua.includes("Bot") || ua.includes("bot") || ua.includes("Crawler") || ua.includes("Spider")) {
    device = "Bot";
  }

  return { browser, os, device };
}

function getClientIp(req: Request): string {
  const xForwardedFor = req.headers["x-forwarded-for"];
  const xRealIp = req.headers["x-real-ip"];

  if (xForwardedFor) {
    const ips = (typeof xForwardedFor === "string" ? xForwardedFor : xForwardedFor[0]).split(",");
    return ips[0].trim();
  }

  if (xRealIp && typeof xRealIp === "string") {
    return xRealIp;
  }

  return req.ip || req.socket.remoteAddress || "Unknown";
}

function normalizeIpAddress(ip: string): string {
  if (!ip || ip === "Unknown") return ip;
  return ip.trim().replace(/^::ffff:/i, "").toLowerCase();
}

function isLoopbackIp(ip: string): boolean {
  return ip === "::1" || ip.startsWith("127.");
}

function maskIpAddress(ip: string): string {
  if (!ip || ip === "Unknown") return ip;

  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      parts[3] = "0";
      return parts.join(".");
    }
  }

  if (ip.includes(":")) {
    const parts = ip.split(":");
    return [...parts.slice(0, 4), "0000", "0000", "0000", "0000"].join(":");
  }

  return ip;
}

function sanitizePath(path: string): string {
  try {
    const url = new URL(path, "http://dropshare.local");
    return url.pathname;
  } catch {
    return path.split("?")[0];
  }
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const path = sanitizePath(req.originalUrl || req.url);
    const rawIpAddress = normalizeIpAddress(getClientIp(req));

    const blockedIp = await this.prisma.blockedIp.findUnique({
      where: { ipAddress: rawIpAddress },
    });

    if (
      blockedIp &&
      (!blockedIp.expiresAt || blockedIp.expiresAt.getTime() > Date.now())
    ) {
      return res.status(403).json({
        message: "Access denied from this IP address",
      });
    }

    const skipPaths = [
      "/api/health",
      "/_next",
      "/static",
      "/favicon",
      "/__nextjs",
    ];

    if (skipPaths.some((skip) => path.startsWith(skip))) {
      return next();
    }

    if (!path.startsWith("/api")) {
      return next();
    }

    if (isLoopbackIp(rawIpAddress)) {
      return next();
    }

    const ipAddress = maskIpAddress(rawIpAddress);
    const userAgent = req.headers["user-agent"];
    const { browser, os, device } = parseUserAgent(userAgent);
    const method = req.method;

    let userId: string | null = null;
    let username: string | null = null;

    const accessToken = req.cookies?.access_token;
    if (accessToken) {
      try {
        const payload = this.jwtService.verify<{ sub?: string }>(accessToken, {
          secret: this.configService.get("internal.jwtSecret"),
        });

        if (payload?.sub) {
          const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, username: true },
          });
          userId = user?.id || null;
          username = user?.username || null;
        }
      } catch {
        userId = null;
        username = null;
      }
    }

    res.on("finish", async () => {
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;

      try {
        await this.prisma.requestLog.create({
          data: {
            ipAddress,
            ipAddressFull: userId ? rawIpAddress : null,
            method,
            path,
            statusCode,
            userAgent: userAgent || null,
            browser,
            os,
            device,
            userId,
            username,
            responseTime,
          },
        });
      } catch (error) {
        console.error("Failed to log request:", error);
      }
    });

    next();
  }
}
