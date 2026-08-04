import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { CapabilityGuard } from "src/auth/guard/capability.guard";
import { RequireCapability } from "src/auth/decorator/requireCapability.decorator";
import { PrismaService } from "src/prisma/prisma.service";
import { ConfigService } from "src/config/config.service";
import * as fs from "fs/promises";
import { SHARE_DIRECTORY } from "src/constants";

@Controller("admin")
export class AdminStatsController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Get("stats")
  @RequireCapability("stats.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getStats() {
    const [totalShares, totalFiles, totalUsers] = await Promise.all([
      this.prisma.share.count(),
      this.prisma.file.count(),
      this.prisma.user.count(),
    ]);

    const viewsDownloads = await this.prisma.share.aggregate({
      _sum: {
        views: true,
        downloads: true,
      },
    });

    const totalViews = viewsDownloads._sum.views ?? 0;
    const totalDownloads = viewsDownloads._sum.downloads ?? 0;

    let storageUsed = 0;
    try {
      const files = await this.prisma.file.findMany({
        select: { size: true },
      });
      storageUsed = files.reduce(
        (sum, file) => sum + parseInt(file.size || "0"),
        0,
      );
    } catch (e) {
      storageUsed = 0;
    }

    const storageLimit =
      this.config.get("share.maxSize") || 10 * 1024 * 1024 * 1024;

    const popularShares = await this.prisma.share.findMany({
      orderBy: [{ views: "desc" }, { downloads: "desc" }],
      take: 10,
      select: {
        id: true,
        name: true,
        views: true,
        downloads: true,
      },
    });

    const users = await this.prisma.user.findMany({
      select: {
        username: true,
        shares: {
          select: {
            views: true,
          },
        },
      },
    });

    const userStats = users
      .map((user) => ({
        username: user.username,
        shareCount: user.shares.length,
        totalViews: user.shares.reduce(
          (sum, share) => sum + (share.views ?? 0),
          0,
        ),
      }))
      .sort((a, b) => b.shareCount - a.shareCount)
      .slice(0, 10);

    const [recentShares, recentShareActivities] = await Promise.all([
      this.prisma.share.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          createdAt: true,
          creator: {
            select: { username: true },
          },
        },
      }),
      this.prisma.shareActivity.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const recentActivity = [
      ...recentShares.map((share) => ({
        type: "share_created",
        at: share.createdAt,
        description: `${share.creator?.username || "Anonymous"} created "${share.name || share.id}"`,
        details: null,
      })),
      ...recentShareActivities.map((activity) => ({
        type: activity.action,
        at: activity.createdAt,
        description: `${activity.actorUsername || "Guest"} ${activity.summary.charAt(0).toLowerCase()}${activity.summary.slice(1)}`,
        details: activity.details,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 20)
      .map((activity) => ({
        type: activity.type,
        description: activity.description,
        details: activity.details,
        time: this.formatTimeAgo(activity.at),
      }));

    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);

    const viewLogs = await this.prisma.requestLog.findMany({
      where: {
        method: "POST",
        path: { endsWith: "/track-view" },
        createdAt: { gte: since24h },
      },
      select: { path: true, ipAddress: true },
    });
    const views24h = viewLogs.length;
    const visitors24h = new Set(viewLogs.map((r) => r.ipAddress)).size;
    const activeShares24h = new Set(
      viewLogs
        .map((r) => (r.path.match(/\/shares\/([^/]+)\/files\//) || [])[1])
        .filter(Boolean),
    ).size;

    const downloads24h = await this.prisma.shareEngagementEvent.count({
      where: { type: "download", createdAt: { gte: since24h } },
    });

    const trendStart = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const [trendEvents, firstEvent] = await Promise.all([
      this.prisma.shareEngagementEvent.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true, type: true },
      }),
      this.prisma.shareEngagementEvent.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const buckets = new Map<string, { views: number; downloads: number }>();
    for (let i = 13; i >= 0; i--) {
      buckets.set(dayKey(new Date(now - i * 24 * 60 * 60 * 1000)), {
        views: 0,
        downloads: 0,
      });
    }
    for (const e of trendEvents) {
      const bucket = buckets.get(dayKey(e.createdAt));
      if (!bucket) continue;
      if (e.type === "download") bucket.downloads += 1;
      else bucket.views += 1;
    }
    const dailyTrend = Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      views: v.views,
      downloads: v.downloads,
    }));

    return {
      last24h: {
        views: views24h,
        downloads: downloads24h,
        visitors: visitors24h,
        activeShares: activeShares24h,
      },
      dailyTrend,
      trackingSince: firstEvent?.createdAt ?? null,
      totalShares,
      totalFiles,
      totalUsers,
      totalViews,
      totalDownloads,
      storageUsed,
      storageLimit,
      popularShares: popularShares.map((s) => ({
        id: s.id,
        name: s.name,
        views: s.views ?? 0,
        downloads: s.downloads ?? 0,
      })),
      userStats,
      recentActivity,
    };
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  }
}
