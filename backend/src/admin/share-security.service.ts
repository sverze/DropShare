import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

const MISS_WINDOW_MS = 10 * 60 * 1000;
const EXEMPT_CACHE_TTL_MS = 60 * 1000;

type ShareSecurityEventInput = {
  ipAddress: string;
  method: string;
  path: string;
  shareId?: string | null;
  fileId?: string | null;
  outcome: "MISS" | "THROTTLED" | "AUTO_BLOCKED";
  reason?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class ShareSecurityService {
  private rateLimitExemptCache = new Map<
    string,
    { exempt: boolean; expiresAt: number }
  >();

  constructor(private prisma: PrismaService) {}

  private normalizeIpAddress(ipAddress: string) {
    return ipAddress.trim().replace(/^::ffff:/i, "").toLowerCase();
  }

  async recordEvent(input: ShareSecurityEventInput) {
    return this.prisma.shareSecurityEvent.create({
      data: {
        ipAddress: input.ipAddress,
        method: input.method,
        path: input.path,
        shareId: input.shareId || null,
        fileId: input.fileId || null,
        outcome: input.outcome,
        reason: input.reason || null,
        userAgent: input.userAgent || null,
      },
    });
  }

  async getRecentMissSummary(ipAddress: string) {
    const cutoff = new Date(Date.now() - MISS_WINDOW_MS);

    const [totalMisses, uniqueMissGroups] = await Promise.all([
      this.prisma.shareSecurityEvent.count({
        where: {
          ipAddress,
          outcome: "MISS",
          createdAt: { gte: cutoff },
        },
      }),
      this.prisma.shareSecurityEvent.groupBy({
        by: ["shareId"],
        where: {
          ipAddress,
          outcome: "MISS",
          createdAt: { gte: cutoff },
          shareId: { not: null },
        },
      }),
    ]);

    return {
      totalMisses,
      uniqueMisses: uniqueMissGroups.length,
    };
  }

  async ensureAutoBlock(ipAddress: string, note: string) {
    const existing = await this.prisma.blockedIp.findUnique({
      where: { ipAddress },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.blockedIp.create({
      data: {
        ipAddress,
        note,
      },
    });
  }

  async isRateLimitExempt(ipAddress: string) {
    const normalizedIp = this.normalizeIpAddress(ipAddress);
    const cached = this.rateLimitExemptCache.get(normalizedIp);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.exempt;
    }

    const entry = await this.prisma.rateLimitExemptIp.findUnique({
      where: { ipAddress: normalizedIp },
      select: { id: true },
    });
    const exempt = Boolean(entry);

    this.rateLimitExemptCache.set(normalizedIp, {
      exempt,
      expiresAt: Date.now() + EXEMPT_CACHE_TTL_MS,
    });

    return exempt;
  }

  async listRateLimitExemptIps() {
    return this.prisma.rateLimitExemptIp.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async createRateLimitExemptIp(input: {
    ipAddress: string;
    note?: string | null;
  }) {
    const ipAddress = this.normalizeIpAddress(input.ipAddress);

    try {
      const [entry] = await this.prisma.$transaction([
        this.prisma.rateLimitExemptIp.create({
          data: {
            ipAddress,
            note: input.note?.trim() || null,
          },
        }),
        this.prisma.blockedIp.deleteMany({
          where: { ipAddress },
        }),
      ]);

      this.rateLimitExemptCache.set(ipAddress, {
        exempt: true,
        expiresAt: Date.now() + EXEMPT_CACHE_TTL_MS,
      });

      return entry;
    } catch (error) {
      if ((error as any)?.code === "P2002") {
        throw new ConflictException("IP address is already rate-limit exempt");
      }
      throw error;
    }
  }

  async deleteRateLimitExemptIp(id: string) {
    const deleted = await this.prisma.rateLimitExemptIp.delete({
      where: { id },
    });

    this.rateLimitExemptCache.delete(deleted.ipAddress);

    return deleted;
  }

  async getSummary() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [events, blockedIps, rateLimitExemptIps] = await Promise.all([
      this.prisma.shareSecurityEvent.findMany({
        where: {
          createdAt: { gte: last24h },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.blockedIp.findMany({
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.rateLimitExemptIp.findMany({
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const blockedIpSet = new Set(blockedIps.map((entry) => entry.ipAddress));
    const blockedIpByAddress = new Map(
      blockedIps.map((entry) => [entry.ipAddress, entry]),
    );
    const exemptIpSet = new Set(
      rateLimitExemptIps.map((entry) => entry.ipAddress),
    );
    const exemptIpByAddress = new Map(
      rateLimitExemptIps.map((entry) => [entry.ipAddress, entry]),
    );
    const suspiciousByIp = new Map<
      string,
      {
        ipAddress: string;
        misses: number;
        throttles: number;
        autoBlocks: number;
        uniqueShareIds: Set<string>;
        lastSeen: Date;
      }
    >();

    for (const event of events) {
      const current = suspiciousByIp.get(event.ipAddress) || {
        ipAddress: event.ipAddress,
        misses: 0,
        throttles: 0,
        autoBlocks: 0,
        uniqueShareIds: new Set<string>(),
        lastSeen: event.createdAt,
      };

      if (event.outcome === "MISS") current.misses += 1;
      if (event.outcome === "THROTTLED") current.throttles += 1;
      if (event.outcome === "AUTO_BLOCKED") current.autoBlocks += 1;
      if (event.shareId) current.uniqueShareIds.add(event.shareId);
      if (event.createdAt > current.lastSeen)
        current.lastSeen = event.createdAt;

      suspiciousByIp.set(event.ipAddress, current);
    }

    const suspiciousIps = Array.from(suspiciousByIp.values())
      .map((entry) => ({
        ipAddress: entry.ipAddress,
        misses: entry.misses,
        throttles: entry.throttles,
        autoBlocks: entry.autoBlocks,
        uniqueShareIds: entry.uniqueShareIds.size,
        lastSeen: entry.lastSeen,
        blocked: blockedIpSet.has(entry.ipAddress),
        blockedIpId: blockedIpByAddress.get(entry.ipAddress)?.id || null,
        rateLimitExempt: exemptIpSet.has(entry.ipAddress),
        rateLimitExemptId:
          exemptIpByAddress.get(entry.ipAddress)?.id || null,
      }))
      .sort((a, b) => {
        const scoreA = a.autoBlocks * 100 + a.misses * 10 + a.throttles * 5;
        const scoreB = b.autoBlocks * 100 + b.misses * 10 + b.throttles * 5;
        return scoreB - scoreA;
      })
      .slice(0, 25);

    return {
      misses24h: events.filter((event) => event.outcome === "MISS").length,
      throttles24h: events.filter((event) => event.outcome === "THROTTLED")
        .length,
      autoBlocks24h: events.filter((event) => event.outcome === "AUTO_BLOCKED")
        .length,
      uniqueIps24h: new Set(events.map((event) => event.ipAddress)).size,
      blockedIps: blockedIps.length,
      rateLimitExemptIps: rateLimitExemptIps.length,
      rateLimitExemptIpList: rateLimitExemptIps,
      suspiciousIps,
    };
  }

  async listEvents(params: {
    page?: string;
    limit?: string;
    outcome?: string;
    ip?: string;
    shareId?: string;
  }) {
    const pageNum = Math.max(1, parseInt(params.page || "1", 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(params.limit || "50", 10) || 50),
    );
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, any> = {};

    if (params.outcome) {
      where.outcome = params.outcome;
    }

    if (params.ip) {
      where.ipAddress = { contains: params.ip.trim() };
    }

    if (params.shareId) {
      where.shareId = { contains: params.shareId.trim() };
    }

    const [events, total] = await Promise.all([
      this.prisma.shareSecurityEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      this.prisma.shareSecurityEvent.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async listRecoverableShares() {
    const shares = await this.prisma.share.findMany({
      where: {
        uploadLocked: false,
        files: {
          some: {},
        },
      },
      orderBy: {
        editedAt: "desc",
      },
      take: 100,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
      },
    });

    return shares.map((share) => ({
      id: share.id,
      name: share.name,
      createdAt: share.createdAt,
      editedAt: share.editedAt,
      expiration: share.expiration,
      views: share.views,
      downloads: share.downloads,
      fileCount: share._count.files,
      creator: share.creator,
    }));
  }
}
