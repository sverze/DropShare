import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { PrismaService } from "src/prisma/prisma.service";
import { ShareSecurityService } from "./share-security.service";

const LOOKUP_WINDOW_MS = 60 * 1000;
const LOOKUP_LIMIT = 90;
const UNIQUE_MISS_THRESHOLD = 12;
const TOTAL_MISS_THRESHOLD = 20;

const recentLookupMap = new Map<string, number[]>();
const lastThrottleLogMap = new Map<string, number>();

function getClientIp(req: Request): string {
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  const xForwardedFor = req.headers["x-forwarded-for"];
  const xRealIp = req.headers["x-real-ip"];

  if (cfConnectingIp && typeof cfConnectingIp === "string") {
    return cfConnectingIp;
  }

  if (xForwardedFor) {
    const header =
      typeof xForwardedFor === "string" ? xForwardedFor : xForwardedFor[0];
    return header.split(",")[0].trim();
  }

  if (xRealIp && typeof xRealIp === "string") {
    return xRealIp;
  }

  return req.ip || req.socket.remoteAddress || "Unknown";
}

function normalizeIpAddress(ip: string): string {
  if (!ip || ip === "Unknown") return ip;
  return ip
    .trim()
    .replace(/^::ffff:/i, "")
    .toLowerCase();
}

function isPrivateIpAddress(ip: string): boolean {
  if (!ip || ip === "Unknown") return false;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;

  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function sanitizePath(path: string): string {
  try {
    const url = new URL(path, "http://dropshare.local");
    return url.pathname;
  } catch {
    return path.split("?")[0];
  }
}

function extractShareLookupTarget(
  path: string,
  method: string,
): { shareId: string; fileId?: string | null } | null {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "shares") {
    return null;
  }

  const shareId = segments[2];
  if (!shareId) return null;

  const reserved = new Set(["all", "limit", "admin", "isShareIdAvailable"]);

  if (reserved.has(shareId)) {
    return null;
  }

  if (
    method === "GET" &&
    (segments.length === 3 || segments[3] === "metaData")
  ) {
    return { shareId };
  }

  if (method === "POST" && segments.length === 4 && segments[3] === "token") {
    return { shareId };
  }

  if (segments[3] === "files" && segments[4]) {
    const fileAction = segments[5];

    if (
      fileAction === "hls" ||
      fileAction === "thumbnail" ||
      fileAction === "metadata"
    ) {
      return null;
    }

    return { shareId, fileId: segments[4] };
  }

  return null;
}

@Injectable()
export class ShareSecurityMiddleware implements NestMiddleware {
  constructor(
    private prisma: PrismaService,
    private shareSecurityService: ShareSecurityService,
  ) {}

  private checkRateLimit(ipAddress: string) {
    const now = Date.now();
    const recent = (recentLookupMap.get(ipAddress) || []).filter(
      (timestamp) => now - timestamp < LOOKUP_WINDOW_MS,
    );
    recent.push(now);
    recentLookupMap.set(ipAddress, recent);
    return recent.length > LOOKUP_LIMIT;
  }

  private async maybeLogThrottle(
    ipAddress: string,
    method: string,
    path: string,
    shareId: string,
    fileId: string | null,
    userAgent?: string | null,
  ) {
    const now = Date.now();
    const lastLoggedAt = lastThrottleLogMap.get(ipAddress) || 0;
    if (now - lastLoggedAt < 60 * 1000) {
      return;
    }

    lastThrottleLogMap.set(ipAddress, now);
    await this.shareSecurityService.recordEvent({
      ipAddress,
      method,
      path,
      shareId,
      fileId,
      outcome: "THROTTLED",
      reason: "share_lookup_rate_limit",
      userAgent,
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const path = sanitizePath(req.originalUrl || req.url);
    const target = extractShareLookupTarget(path, req.method);

    if (!target) {
      return next();
    }

    const ipAddress = normalizeIpAddress(getClientIp(req));
    const userAgent = req.headers["user-agent"];
    const userAgentValue =
      typeof userAgent === "string" ? userAgent : userAgent?.[0] || null;

    if (await this.shareSecurityService.isRateLimitExempt(ipAddress)) {
      return next();
    }

    if (this.checkRateLimit(ipAddress)) {
      await this.maybeLogThrottle(
        ipAddress,
        req.method,
        path,
        target.shareId,
        target.fileId || null,
        userAgentValue,
      );

      return res.status(429).json({
        message: "Too many share lookups. Please try again shortly.",
      });
    }

    const share = await this.prisma.share.findUnique({
      where: { id: target.shareId },
      select: { id: true },
    });

    if (share) {
      return next();
    }

    await this.shareSecurityService.recordEvent({
      ipAddress,
      method: req.method,
      path,
      shareId: target.shareId,
      fileId: target.fileId || null,
      outcome: "MISS",
      reason: "share_not_found",
      userAgent: userAgentValue,
    });

    const { totalMisses, uniqueMisses } =
      await this.shareSecurityService.getRecentMissSummary(ipAddress);

    if (
      !isPrivateIpAddress(ipAddress) &&
      (uniqueMisses >= UNIQUE_MISS_THRESHOLD ||
        totalMisses >= TOTAL_MISS_THRESHOLD)
    ) {
      await this.shareSecurityService.ensureAutoBlock(
        ipAddress,
        `Auto-blocked after ${uniqueMisses} unique invalid share lookups (${totalMisses} total misses in 10 minutes)`,
      );

      await this.shareSecurityService.recordEvent({
        ipAddress,
        method: req.method,
        path,
        shareId: target.shareId,
        fileId: target.fileId || null,
        outcome: "AUTO_BLOCKED",
        reason: `unique_misses=${uniqueMisses};total_misses=${totalMisses}`,
        userAgent: userAgentValue,
      });
    }

    return res.status(404).json({
      message: target.fileId ? "File not found" : "Share not found",
    });
  }
}
