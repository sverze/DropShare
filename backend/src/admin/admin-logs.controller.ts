import { Controller, Get, Delete, Query, UseGuards, Param } from "@nestjs/common";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { CapabilityGuard } from "src/auth/guard/capability.guard";
import { RequireCapability } from "src/auth/decorator/requireCapability.decorator";
import { PrismaService } from "src/prisma/prisma.service";

@Controller("admin/logs")
export class AdminLogsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @RequireCapability("logs.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getLogs(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "50",
    @Query("ip") ipFilter?: string,
    @Query("path") pathFilter?: string,
    @Query("method") methodFilter?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const DEFAULT_LOOKBACK_DAYS = 30;
    const where: any = {};

    if (ipFilter) where.ipAddress = { contains: ipFilter };
    if (pathFilter) where.path = { contains: pathFilter };
    if (methodFilter) where.method = methodFilter;

    where.createdAt = {
      gte: startDate
        ? new Date(startDate)
        : new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
    };
    if (endDate) where.createdAt.lte = new Date(endDate);

    const COUNT_CAP = 10000;
    const [logs, capSample] = await Promise.all([
      this.prisma.requestLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      this.prisma.requestLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: { id: true },
        take: COUNT_CAP + 1,
      }),
    ]);
    const capped = capSample.length > COUNT_CAP;
    const total = capped ? COUNT_CAP : capSample.length;

    return {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        capped,
      },
    };
  }

  @Get("summary")
  @RequireCapability("logs.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getLogsSummary() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [maxRow, minRow, logs24h, logs7d] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ v: number | bigint | null }[]>(
        'SELECT MAX(rowid) AS v FROM "RequestLog"',
      ),
      this.prisma.$queryRawUnsafe<{ v: number | bigint | null }[]>(
        'SELECT MIN(rowid) AS v FROM "RequestLog"',
      ),
      this.prisma.requestLog.count({
        where: { createdAt: { gte: last24h } },
      }),
      this.prisma.requestLog.count({
        where: { createdAt: { gte: last7d } },
      }),
    ]);
    const maxId = Number(maxRow?.[0]?.v ?? 0);
    const minId = Number(minRow?.[0]?.v ?? 0);
    const totalLogs = maxId > 0 ? maxId - minId + 1 : 0;

    const uniqueIps24h = await this.prisma.requestLog.groupBy({
      by: ["ipAddress"],
      where: { createdAt: { gte: last24h } },
    });

    const topIps = await this.prisma.requestLog.groupBy({
      by: ["ipAddress"],
      where: { createdAt: { gte: last7d } },
      _count: { ipAddress: true },
      orderBy: { _count: { ipAddress: "desc" } },
      take: 10,
    });

    const topPaths = await this.prisma.requestLog.groupBy({
      by: ["path"],
      where: { createdAt: { gte: last7d } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 10,
    });

    const browsers = await this.prisma.requestLog.groupBy({
      by: ["browser"],
      where: { createdAt: { gte: last7d } },
      _count: { browser: true },
      orderBy: { _count: { browser: "desc" } },
    });

    const operatingSystems = await this.prisma.requestLog.groupBy({
      by: ["os"],
      where: { createdAt: { gte: last7d } },
      _count: { os: true },
      orderBy: { _count: { os: "desc" } },
    });

    const devices = await this.prisma.requestLog.groupBy({
      by: ["device"],
      where: { createdAt: { gte: last7d } },
      _count: { device: true },
      orderBy: { _count: { device: "desc" } },
    });

    const errors24h = await this.prisma.requestLog.count({
      where: {
        createdAt: { gte: last24h },
        statusCode: { gte: 400 },
      },
    });

    return {
      totalLogs,
      logs24h,
      logs7d,
      uniqueIps24h: uniqueIps24h.length,
      errorRate24h: logs24h > 0 ? ((errors24h / logs24h) * 100).toFixed(2) : "0",
      topIps: topIps.map((ip) => ({
        ipAddress: ip.ipAddress,
        count: ip._count.ipAddress,
      })),
      topPaths: topPaths.map((p) => ({
        path: p.path,
        count: p._count.path,
      })),
      browsers: browsers.map((b) => ({
        name: b.browser || "Unknown",
        count: b._count.browser,
      })),
      operatingSystems: operatingSystems.map((o) => ({
        name: o.os || "Unknown",
        count: o._count.os,
      })),
      devices: devices.map((d) => ({
        name: d.device || "Unknown",
        count: d._count.device,
      })),
    };
  }

  @Delete("clear")
  @RequireCapability("logs.delete")
  @UseGuards(JwtGuard, CapabilityGuard)
  async clearOldLogs(@Query("olderThanDays") days: string = "30") {
    const daysNum = Math.max(1, parseInt(days) || 30);
    const cutoffDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const result = await this.prisma.requestLog.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    return {
      message: `Deleted ${result.count} logs older than ${daysNum} days`,
      deletedCount: result.count,
    };
  }

  @Delete(":id")
  @RequireCapability("logs.delete")
  @UseGuards(JwtGuard, CapabilityGuard)
  async deleteLog(@Param("id") id: string) {
    await this.prisma.requestLog.delete({ where: { id } });
    return { message: "Log deleted" };
  }
}
