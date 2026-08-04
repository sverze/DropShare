import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InviteCode, Prisma, User } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as argon from "argon2";
import * as crypto from "crypto";
import { Entry } from "ldapts";
import { AuthSignInDTO } from "src/auth/dto/authSignIn.dto";
import { EmailService } from "src/email/email.service";
import { PrismaService } from "src/prisma/prisma.service";
import { inspect } from "util";
import { ConfigService } from "../config/config.service";
import { FileService } from "../file/file.service";
import { Capability, hasCapability } from "../auth/capabilities";
import { CreateUserDTO } from "./dto/createUser.dto";
import { CreateInviteCodeDto } from "./dto/createInviteCode.dto";
import { UpdateUserDto } from "./dto/updateUser.dto";
import { UpdateInviteCodeDto } from "./dto/updateInviteCode.dto";
import { CreateBlockedIpDto } from "./dto/createBlockedIp.dto";
import { BanUserDto } from "./dto/banUser.dto";
import { CreateUserShareThemeColorDto } from "./dto/createUserShareThemeColor.dto";
import { CreateUserGroupDto } from "./dto/createUserGroup.dto";
import { UpdateUserGroupDto } from "./dto/updateUserGroup.dto";
import { UpsertUserGroupMembershipDto } from "./dto/upsertUserGroupMembership.dto";
import { UpdateManagedGroupMemberPermissionsDto } from "./dto/updateManagedGroupMemberPermissions.dto";

const MAX_CUSTOM_SHARE_THEME_COLORS = 7;

const GROUP_ROLE_LEADER = "leader";
const GROUP_ROLE_MEMBER = "member";

@Injectable()
export class UserSevice {
  private readonly logger = new Logger(UserSevice.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private fileService: FileService,
    private configService: ConfigService,
  ) {}

  private getGroupMembershipInclude() {
    return {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
    } as any;
  }

  private sanitizeManagedGroupPermissions(dto: UpdateManagedGroupMemberPermissionsDto) {
    const allowEditShares = dto.allowEditShares ?? false;

    return {
      allowEditShares,
      canEditShareThemeColor: allowEditShares && Boolean(dto.canEditShareThemeColor),
      canEditShareName: allowEditShares && Boolean(dto.canEditShareName),
      canEditShareDescription: allowEditShares && Boolean(dto.canEditShareDescription),
      canEditShareFileOrder: allowEditShares && Boolean(dto.canEditShareFileOrder),
      canAddFiles: allowEditShares && Boolean(dto.canAddFiles),
      canRemoveFiles: allowEditShares && Boolean(dto.canRemoveFiles),
    };
  }

  private async getLeaderManagedGroup(userId: string) {
    const membership = await this.prisma.userGroupMembership.findFirst({
      where: { userId, role: GROUP_ROLE_LEADER },
      include: {
        group: {
          include: this.getGroupMembershipInclude(),
        },
      },
    }) as any;

    if (!membership?.group || membership.role !== GROUP_ROLE_LEADER) {
      throw new ForbiddenException("Only group leaders can manage this group");
    }

    return membership.group;
  }

  private async getLeaderManagedGroupById(userId: string, groupId: string) {
    const membership = await this.prisma.userGroupMembership.findFirst({
      where: { userId, groupId, role: GROUP_ROLE_LEADER },
      include: {
        group: {
          include: this.getGroupMembershipInclude(),
        },
      },
    }) as any;

    if (!membership?.group) {
      throw new ForbiddenException("Only group leaders can manage this group");
    }

    return membership.group;
  }

  async list() {
    return await this.prisma.user.findMany({
      include: {
        _count: {
          select: {
            passkeys: true,
          },
        },
        shareThemeColors: {
          orderBy: { createdAt: "asc" },
        },
        groupMemberships: {
          include: {
            group: {
              include: {
                memberships: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        username: true,
                        email: true,
                      },
                    },
                  },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        },
      },
    });
  }

  private normalizeIpAddress(ipAddress: string) {
    return ipAddress.trim().replace(/^::ffff:/i, "").toLowerCase();
  }

  private isBannableIp(ip: string): boolean {
    const v = (ip || "").trim().toLowerCase();
    if (!v || v === "unknown") return false;
    if (v.includes(".")) {
      const parts = v.split(".");
      if (parts.length !== 4) return false;
      const oct = parts.map((p) => Number(p));
      if (oct.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
        return false;
      }
      const [a, b] = oct;
      if (a === 0 || a === 127 || a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 169 && b === 254) return false;
      return true;
    }
    if (v.includes(":")) {
      if (v === "::1") return false;
      if (v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd")) {
        return false;
      }
      return true;
    }
    return false;
  }

  private normalizeInviteCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private normalizeShareThemeColor(color: string): string {
    const normalized = color.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
      throw new BadRequestException("Share theme colors must be valid 6-digit hex values");
    }

    return normalized;
  }

  private normalizeShareThemeName(name: string): string {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException("Share theme color names cannot be empty");
    }

    return normalized;
  }

  private validateInviteCodeFormat(code: string) {
    if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
      throw new BadRequestException(
        "Invite codes must be 4-32 characters and only use letters, numbers, dashes, or underscores",
      );
    }
  }

  private parseInviteExpiry(expiresAt?: string | null): Date | null {
    if (!expiresAt) return null;

    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Invalid invite code expiration date");
    }

    return parsed;
  }

  private getInviteCodeClient(
    tx?: Prisma.TransactionClient,
  ): Prisma.TransactionClient | PrismaService {
    return tx ?? this.prisma;
  }

  private async generateInviteCode(): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (let attempt = 0; attempt < 20; attempt++) {
      let code = "";
      for (let index = 0; index < 10; index++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await this.prisma.inviteCode.findUnique({
        where: { code },
      });

      if (!existing) return code;
    }

    throw new BadRequestException("Failed to generate a unique invite code");
  }

  private ensureInviteCodeIsUsable(inviteCode: InviteCode | null) {
    if (!inviteCode) {
      throw new BadRequestException("Invalid invite code");
    }

    if (!inviteCode.isActive) {
      throw new BadRequestException("Invalid invite code");
    }

    if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
      throw new BadRequestException("Invalid invite code");
    }

    if (
      inviteCode.maxUses !== null &&
      inviteCode.maxUses !== undefined &&
      inviteCode.useCount >= inviteCode.maxUses
    ) {
      throw new BadRequestException("Invalid invite code");
    }
  }

  async listInviteCodes() {
    return await this.prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        group: {
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
  }

  private normalizeGroupName(name: string): string {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException("Group name cannot be empty");
    }
    return normalized;
  }

  private parseShareSizeLimit(value?: string | null): bigint | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    return BigInt(value);
  }

  async listGroups() {
    return await this.prisma.userGroup.findMany({
      orderBy: [{ name: "asc" }],
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  }

  private resolveGroupShareSizeLimit(
    actingUser: Pick<User, "isAdmin" | "role">,
    rawValue?: string | null,
    currentValue?: bigint | null,
  ): bigint | null | undefined {
    const parsed = this.parseShareSizeLimit(rawValue);
    const isRaising =
      parsed !== null &&
      parsed !== undefined &&
      parsed !== (currentValue ?? null);
    if (
      isRaising &&
      !actingUser?.isAdmin &&
      !this.hasCap(actingUser, "users.limits")
    ) {
      throw new ForbiddenException(
        "Setting a group share-size limit requires the per-user limits permission",
      );
    }
    return parsed;
  }

  async createGroup(
    actingUser: Pick<User, "isAdmin" | "role">,
    dto: CreateUserGroupDto,
  ) {
    const shareSizeLimit =
      this.resolveGroupShareSizeLimit(actingUser, dto.shareSizeLimit) ?? null;
    try {
      return await this.prisma.userGroup.create({
        data: {
          name: this.normalizeGroupName(dto.name),
          shareSizeLimit,
        },
        include: this.getGroupMembershipInclude(),
      });
    } catch (error) {
      if ((error as any)?.code === "P2002") {
        throw new ConflictException("A group with this name already exists");
      }
      throw error;
    }
  }

  async updateGroup(
    actingUser: Pick<User, "isAdmin" | "role">,
    id: string,
    dto: UpdateUserGroupDto,
  ) {
    const existing = await this.prisma.userGroup.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException("Group not found");
    }

    const shareSizeLimit =
      dto.shareSizeLimit === undefined
        ? undefined
        : this.resolveGroupShareSizeLimit(
            actingUser,
            dto.shareSizeLimit,
            existing.shareSizeLimit,
          );

    try {
      return await this.prisma.userGroup.update({
        where: { id },
        data: {
          name: dto.name === undefined ? undefined : this.normalizeGroupName(dto.name),
          shareSizeLimit,
        },
        include: this.getGroupMembershipInclude(),
      });
    } catch (error) {
      if ((error as any)?.code === "P2002") {
        throw new ConflictException("A group with this name already exists");
      }
      throw error;
    }
  }

  async deleteGroup(id: string) {
    return await this.prisma.userGroup.delete({
      where: { id },
      include: this.getGroupMembershipInclude(),
    });
  }

  async upsertGroupMembership(
    actingUser: User,
    groupId: string,
    dto: UpsertUserGroupMembershipDto,
  ) {
    if (dto.role === "leader" && !actingUser.isAdmin) {
      throw new ForbiddenException(
        "Only administrators can assign the group leader role",
      );
    }

    const group = await this.prisma.userGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return await this.prisma.userGroupMembership.upsert({
      where: { userId_groupId: { userId: dto.userId, groupId } },
      create: {
        userId: dto.userId,
        groupId,
        role: dto.role,
      },
      update: {
        role: dto.role,
      },
      include: {
        group: {
          include: this.getGroupMembershipInclude(),
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  async removeGroupMembership(userId: string, groupId?: string) {
    const membership = await this.prisma.userGroupMembership.findFirst({
      where: {
        userId,
        ...(groupId ? { groupId } : {}),
      },
    });

    if (!membership) {
      throw new NotFoundException("Group membership not found");
    }

    return await this.prisma.userGroupMembership.delete({
      where: { id: membership.id },
    });
  }

  async getOwnManagedGroup(userId: string) {
    return await this.getLeaderManagedGroup(userId);
  }

  async listOwnManagedGroups(userId: string) {
    const memberships = await this.prisma.userGroupMembership.findMany({
      where: { userId, role: GROUP_ROLE_LEADER },
      include: {
        group: {
          include: this.getGroupMembershipInclude(),
        },
      },
      orderBy: { createdAt: "asc" },
    }) as any[];

    return memberships.map((membership) => membership.group);
  }

  async updateOwnManagedGroupMemberPermissions(
    leaderUserId: string,
    groupId: string,
    memberUserId: string,
    dto: UpdateManagedGroupMemberPermissionsDto,
  ) {
    const group = await this.getLeaderManagedGroupById(leaderUserId, groupId);

    const membership = await this.prisma.userGroupMembership.findFirst({
      where: { userId: memberUserId, groupId: group.id },
    });

    if (!membership || membership.groupId !== group.id) {
      throw new NotFoundException("Group member not found");
    }

    if (membership.role === GROUP_ROLE_LEADER) {
      throw new ForbiddenException("Leader permissions are managed automatically");
    }

    await this.prisma.userGroupMembership.update({
      where: { id: membership.id },
      data: this.sanitizeManagedGroupPermissions(dto) as any,
    });

    return await this.prisma.userGroup.findUnique({
      where: { id: group.id },
      include: this.getGroupMembershipInclude(),
    });
  }

  async removeOwnManagedGroupMember(
    leaderUserId: string,
    groupId: string,
    memberUserId: string,
  ) {
    const group = await this.getLeaderManagedGroupById(leaderUserId, groupId);

    const membership = await this.prisma.userGroupMembership.findFirst({
      where: { userId: memberUserId, groupId: group.id },
    });

    if (!membership || membership.groupId !== group.id) {
      throw new NotFoundException("Group member not found");
    }

    if (membership.userId === leaderUserId) {
      throw new ForbiddenException("You cannot remove yourself from the group");
    }

    await this.prisma.userGroupMembership.delete({
      where: { id: membership.id },
    });

    return await this.prisma.userGroup.findUnique({
      where: { id: group.id },
      include: this.getGroupMembershipInclude(),
    });
  }

  async getUserActivitySummary() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const topUsers = await this.prisma.requestLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since }, userId: { not: null } },
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { userId: "desc" } },
      take: 20,
    });

    const userIds = topUsers
      .map((g) => g.userId)
      .filter((id): id is string => !!id);

    if (userIds.length === 0) {
      return {
        users: [],
        blockedIps: await this.prisma.blockedIp.findMany({
          orderBy: { createdAt: "desc" },
        }),
      };
    }

    const [ipGroups, users, blockedIps] = await Promise.all([
      this.prisma.requestLog.groupBy({
        by: ["userId", "ipAddress"],
        where: { createdAt: { gte: since }, userId: { in: userIds } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          email: true,
          bannedAt: true,
          bannedUntil: true,
        },
      }),
      this.prisma.blockedIp.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    const usersById = new Map(users.map((u) => [u.id, u]));
    const ipsByUser = new Map<
      string,
      { ipAddress: string; requests: number; lastSeen: Date }[]
    >();
    for (const g of ipGroups) {
      if (!g.userId) continue;
      const list = ipsByUser.get(g.userId) ?? [];
      list.push({
        ipAddress: g.ipAddress,
        requests: g._count._all,
        lastSeen: g._max.createdAt ?? since,
      });
      ipsByUser.set(g.userId, list);
    }

    const activityUsers = topUsers.flatMap((g) => {
      const user = g.userId ? usersById.get(g.userId) : undefined;
      if (!user) return [];
      return [
        {
          userId: user.id,
          username: user.username,
          email: user.email,
          bannedAt: user.bannedAt,
          bannedUntil: user.bannedUntil,
          requests: g._count._all,
          lastSeen: g._max.createdAt ?? since,
          ips: (ipsByUser.get(user.id) ?? [])
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 5),
        },
      ];
    });

    return { users: activityUsers, blockedIps };
  }

  async listBlockedIps() {
    return this.prisma.blockedIp.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async createBlockedIp(dto: CreateBlockedIpDto) {
    const ipAddress = this.normalizeIpAddress(dto.ipAddress);

    try {
      return await this.prisma.blockedIp.create({
        data: {
          ipAddress,
          note: dto.note?.trim() || null,
        },
      });
    } catch (error) {
      if ((error as any)?.code === "P2002") {
        throw new ConflictException("IP address is already blocked");
      }
      throw error;
    }
  }

  async deleteBlockedIp(id: string) {
    return await this.prisma.blockedIp.delete({
      where: { id },
    });
  }

  private resolveBanUntil(dto: BanUserDto): Date | null {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    switch (dto.duration) {
      case "7d":
        return new Date(now + 7 * day);
      case "2w":
        return new Date(now + 14 * day);
      case "permanent":
        return null;
      case "custom":
        if (!dto.customDays || dto.customDays < 1) {
          throw new BadRequestException(
            "A custom ban needs a positive number of days.",
          );
        }
        return new Date(now + dto.customDays * day);
      default:
        throw new BadRequestException("Invalid ban duration.");
    }
  }

  private async banUserIps(
    userId: string,
    bannedById: string,
    expiresAt: Date | null,
  ): Promise<number> {
    const logs = await this.prisma.requestLog.findMany({
      where: { userId, ipAddressFull: { not: null } },
      distinct: ["ipAddressFull"],
      select: { ipAddressFull: true },
    });

    const ips = Array.from(
      new Set(
        logs
          .map((log) => log.ipAddressFull)
          .filter((ip): ip is string => !!ip)
          .map((ip) => this.normalizeIpAddress(ip))
          .filter((ip) => this.isBannableIp(ip)),
      ),
    );

    let count = 0;
    for (const ipAddress of ips) {
      const existing = await this.prisma.blockedIp.findUnique({
        where: { ipAddress },
      });
      if (!existing) {
        await this.prisma.blockedIp.create({
          data: {
            ipAddress,
            note: "Auto-blocked with a banned account",
            expiresAt,
            userId,
            bannedById,
          },
        });
        count++;
      } else if (existing.userId === userId) {
        await this.prisma.blockedIp.update({
          where: { ipAddress },
          data: { expiresAt, bannedById },
        });
        count++;
      }
    }
    return count;
  }

  // A protected (owner-tier) account can only be modified by another protected
  // account. Ordinary admins and managers cannot ban, edit, demote, or delete
  // it, nor change its protected status.
  private assertProtectedModifiable(
    target: { protected: boolean },
    actingUser?: { protected?: boolean } | null,
  ) {
    if (target.protected && !actingUser?.protected) {
      throw new ForbiddenException(
        "This account is protected and can only be changed by a protected admin.",
      );
    }
  }

  async banUser(
    id: string,
    dto: BanUserDto,
    actingUser: Pick<User, "id" | "isAdmin" | "role" | "protected">,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, isAdmin: true, role: true, protected: true },
    });
    if (!target) throw new BadRequestException("User not found");
    this.assertProtectedModifiable(target, actingUser);

    if (actingUser.id === id) {
      throw new BadRequestException("You cannot ban your own account.");
    }
    if (target.isAdmin) {
      throw new ForbiddenException("Administrators cannot be banned.");
    }
    if (!actingUser.isAdmin && target.role !== "user") {
      throw new ForbiddenException("Managers can only ban basic users.");
    }

    const bannedUntil = this.resolveBanUntil(dto);
    const now = new Date();

    const bannedIpCount = dto.banIps
      ? await this.banUserIps(id, actingUser.id, bannedUntil)
      : 0;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        bannedAt: now,
        bannedUntil,
        banReason: dto.reason?.trim() || null,
        bannedById: actingUser.id,
        tokensValidAfter: now,
      },
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    await this.prisma.loginToken.deleteMany({ where: { userId: id } });

    return { user, bannedIpCount };
  }

  async unbanUser(
    id: string,
    actingUser: Pick<User, "isAdmin" | "role" | "protected">,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, isAdmin: true, role: true, protected: true },
    });
    if (!target) throw new BadRequestException("User not found");
    this.assertProtectedModifiable(target, actingUser);
    if (target.isAdmin) {
      throw new ForbiddenException("Administrators cannot be banned.");
    }
    if (!actingUser.isAdmin && target.role !== "user") {
      throw new ForbiddenException("Managers can only manage basic users.");
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
        bannedById: null,
      },
    });

    const removed = await this.prisma.blockedIp.deleteMany({
      where: { userId: id },
    });

    return { user, liftedIpCount: removed.count };
  }

  async forceLogoutUser(
    id: string,
    actingUser: Pick<User, "isAdmin" | "role" | "protected">,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, isAdmin: true, role: true, protected: true },
    });
    if (!target) throw new BadRequestException("User not found");
    this.assertProtectedModifiable(target, actingUser);
    if (target.isAdmin) {
      throw new ForbiddenException("Administrators cannot be force-logged-out.");
    }
    if (!actingUser.isAdmin && target.role !== "user") {
      throw new ForbiddenException("Managers can only manage basic users.");
    }

    await this.prisma.user.update({
      where: { id },
      data: { tokensValidAfter: new Date() },
    });
    const removed = await this.prisma.refreshToken.deleteMany({
      where: { userId: id },
    });

    return { success: true, revokedSessions: removed.count };
  }

  async createInviteCode(dto: CreateInviteCodeDto, createdById: string) {
    const code = dto.code
      ? this.normalizeInviteCode(dto.code)
      : await this.generateInviteCode();

    this.validateInviteCodeFormat(code);

    try {
      return await this.prisma.inviteCode.create({
        data: {
          code,
          description: dto.description?.trim() || null,
          maxUses: dto.maxUses ?? null,
          expiresAt: this.parseInviteExpiry(dto.expiresAt),
          isActive: dto.isActive ?? true,
          createdBy: { connect: { id: createdById } },
          group: dto.groupId ? { connect: { id: dto.groupId } } : undefined,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          group: {
            include: {
              memberships: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      email: true,
                    },
                  },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code == "P2002") {
          throw new BadRequestException("An invite code with this value already exists");
        }
      }
      throw e;
    }
  }

  async updateInviteCode(id: string, dto: UpdateInviteCodeDto) {
    const existing = await this.prisma.inviteCode.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException("Invite code not found");
    }

    if (
      dto.maxUses !== undefined &&
      dto.maxUses !== null &&
      dto.maxUses < existing.useCount
    ) {
      throw new BadRequestException("Max uses cannot be lower than the current use count");
    }

    return await this.prisma.inviteCode.update({
      where: { id },
      data: {
        description:
          dto.description === undefined ? undefined : dto.description?.trim() || null,
        maxUses: dto.maxUses === undefined ? undefined : dto.maxUses,
        expiresAt:
          dto.expiresAt === undefined ? undefined : this.parseInviteExpiry(dto.expiresAt),
        isActive: dto.isActive,
        group:
          dto.groupId === undefined
            ? undefined
            : dto.groupId
            ? { connect: { id: dto.groupId } }
            : { disconnect: true },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        group: {
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
  }

  async deleteInviteCode(id: string) {
    return await this.prisma.inviteCode.delete({
      where: { id },
    });
  }

  async consumeInviteCode(code: string | undefined, tx?: Prisma.TransactionClient) {
    if (!code?.trim()) {
      throw new BadRequestException("Invite code is required");
    }

    const db = this.getInviteCodeClient(tx);
    const normalizedCode = this.normalizeInviteCode(code);

    const inviteCode = await db.inviteCode.findUnique({
      where: { code: normalizedCode },
      include: {
        group: true,
      },
    });

    this.ensureInviteCodeIsUsable(inviteCode);

    return await db.inviteCode.update({
      where: { id: inviteCode.id },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  async redeemInviteCodeForUser(userId: string, code: string | undefined) {
    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          groupMemberships: true,
        },
      });

      if (!user) {
        throw new BadRequestException("User not found");
      }

      if (user.canCreateShares) {
        throw new BadRequestException("This account can already create shares");
      }

      const inviteCode = await this.consumeInviteCode(code, tx);

      if (
        inviteCode.groupId &&
        !user.groupMemberships.some((membership) => membership.groupId === inviteCode.groupId)
      ) {
        await tx.userGroupMembership.create({
          data: {
            userId,
            groupId: inviteCode.groupId,
            role: "member",
          },
        });
      }

      return await tx.user.update({
        where: { id: userId },
        data: {
          canCreateShares: true,
        },
        include: {
          shareThemeColors: {
            orderBy: { createdAt: "asc" },
          },
          groupMemberships: {
            include: {
              group: {
                include: {
                  memberships: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          username: true,
                          email: true,
                        },
                      },
                    },
                    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
                  },
                },
              },
            },
          },
        },
      });
    });
  }

  async get(id: string) {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  async getCurrentUserProfile(id: string) {
    return await this.prisma.user.findUnique({
      where: { id },
      include: {
        shareThemeColors: {
          orderBy: { createdAt: "asc" },
        },
        groupMemberships: {
          include: {
            group: {
              include: {
                memberships: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        username: true,
                        email: true,
                      },
                    },
                  },
                  orderBy: [{ role: "asc" }, { createdAt: "asc" }],
                },
              },
            },
          },
        },
      },
    });
  }

  private readonly ROLES = ["admin", "manager", "user"];

  private resolveRoleAndAdmin(
    patch: { role?: string | null; isAdmin?: boolean },
    existingRole?: string,
  ): { role?: string; isAdmin?: boolean } {
    if (patch.role !== undefined && patch.role !== null && patch.role !== "") {
      const role = this.ROLES.includes(patch.role) ? patch.role : "user";
      return { role, isAdmin: role === "admin" };
    }
    if (patch.isAdmin !== undefined) {
      if (patch.isAdmin) return { role: "admin", isAdmin: true };
      return {
        role: existingRole === "admin" || !existingRole ? "user" : existingRole,
        isAdmin: false,
      };
    }
    return {};
  }

  private hasCap(
    actingUser: Pick<User, "isAdmin" | "role">,
    capability: Capability,
  ): boolean {
    return hasCapability(
      actingUser,
      capability,
      this.configService.get("access.managerCapabilities"),
    );
  }

  async create(dto: CreateUserDTO, actingUser?: Pick<User, "isAdmin" | "role"> | null) {
    let hash: string;

    if (!dto.password) {
      const randomPassword = crypto.randomUUID();
      hash = await argon.hash(randomPassword);
      await this.emailService.sendInviteEmail(dto.email, randomPassword);
    } else {
      hash = await argon.hash(dto.password);
    }

    const maxFileSizeOverride = dto.maxFileSizeOverride && dto.maxFileSizeOverride !== ""
      ? BigInt(dto.maxFileSizeOverride)
      : null;

    const isManagerActor = !!actingUser && !actingUser.isAdmin;
    const { role, isAdmin } = this.resolveRoleAndAdmin(
      isManagerActor ? { role: "user" } : { role: dto.role, isAdmin: dto.isAdmin },
    );
    const canSetLimits =
      !isManagerActor || this.hasCap(actingUser, "users.limits");

    try {
      return await this.prisma.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          password: hash,
          isAdmin: isAdmin ?? false,
          role: role ?? "user",
          canCreateShares: canSetLimits ? dto.canCreateShares ?? true : true,
          maxFileSizeOverride: canSetLimits ? maxFileSizeOverride : null,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code == "P2002") {
          const duplicatedField: string = e.meta.target[0];
          throw new BadRequestException(
            `A user with this ${duplicatedField} already exists`,
          );
        }
      }
    }
  }

  async update(
    id: string,
    user: UpdateUserDto,
    actingUser?: Pick<User, "isAdmin" | "role" | "protected"> | null,
  ) {
    try {
      const target = await this.prisma.user.findUnique({
        where: { id },
        select: { role: true, isAdmin: true, protected: true },
      });
      if (!target) throw new BadRequestException("User not found");
      // A protected account can only be edited or demoted by another protected
      // admin.
      this.assertProtectedModifiable(target, actingUser);

      const dto: any = { ...user };
      const isManagerActor = !!actingUser && !actingUser.isAdmin;

      if (actingUser?.isAdmin !== true) {
        delete dto.role;
        delete dto.isAdmin;
      }

      // Only a protected admin may grant or revoke protected status; for
      // everyone else the field is ignored.
      if (actingUser?.protected !== true) {
        delete dto.protected;
      }

      if (isManagerActor) {
        if (target.role !== "user") {
          throw new ForbiddenException("Managers can only edit basic users.");
        }

        const touchesDetails =
          dto.username !== undefined ||
          dto.email !== undefined ||
          dto.avatar !== undefined;
        const touchesPassword = !!dto.password;
        const touchesLimits =
          dto.canCreateShares !== undefined ||
          dto.maxFileSizeOverride !== undefined;

        if (touchesDetails && !this.hasCap(actingUser, "users.edit"))
          throw new ForbiddenException("Not allowed to edit user details.");
        if (touchesPassword && !this.hasCap(actingUser, "users.password"))
          throw new ForbiddenException("Not allowed to reset passwords.");
        if (touchesLimits && !this.hasCap(actingUser, "users.limits"))
          throw new ForbiddenException("Not allowed to change user limits.");
      }

      const hash = dto.password && (await argon.hash(dto.password));

      let maxFileSizeOverride: bigint | null | undefined = undefined;
      if (dto.maxFileSizeOverride !== undefined) {
        maxFileSizeOverride =
          dto.maxFileSizeOverride === null || dto.maxFileSizeOverride === ""
            ? null
            : BigInt(dto.maxFileSizeOverride);
      }

      const roleSync = this.resolveRoleAndAdmin(
        { role: dto.role, isAdmin: dto.isAdmin },
        target.role,
      );

      const {
        maxFileSizeOverride: _m,
        role: _r,
        isAdmin: _a,
        password: _p,
        ...rest
      } = dto;
      const updateData: any = { ...rest };
      if (hash) updateData.password = hash;
      if (maxFileSizeOverride !== undefined)
        updateData.maxFileSizeOverride = maxFileSizeOverride;
      if (roleSync.role !== undefined) updateData.role = roleSync.role;
      if (roleSync.isAdmin !== undefined) updateData.isAdmin = roleSync.isAdmin;

      if (target.isAdmin && updateData.isAdmin === false) {
        const adminCount = await this.prisma.user.count({
          where: { isAdmin: true },
        });
        if (adminCount === 1) {
          throw new BadRequestException("Cannot remove the last admin user.");
        }
      }

      return await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
    } catch (e) {
      if (e instanceof ForbiddenException || e instanceof BadRequestException) {
        throw e;
      }
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code == "P2002") {
          const duplicatedField: string = e.meta.target[0];
          throw new BadRequestException(
            `A user with this ${duplicatedField} already exists`,
          );
        }
      }
    }
  }

  async listOwnShareThemeColors(userId: string) {
    return await this.prisma.userShareThemeColor.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createOwnShareThemeColor(
    userId: string,
    dto: CreateUserShareThemeColorDto,
  ) {
    const name = this.normalizeShareThemeName(dto.name);
    const color = this.normalizeShareThemeColor(dto.color);

    const builtInColors = new Set(
      this.configService
        .getSharePresets()
        .map((preset) => preset.color.trim().toLowerCase()),
    );

    if (builtInColors.has(color)) {
      throw new ConflictException("That color already exists in the default palette");
    }

    const existingCount = await this.prisma.userShareThemeColor.count({
      where: { userId },
    });

    if (existingCount >= MAX_CUSTOM_SHARE_THEME_COLORS) {
      throw new BadRequestException(
        `You can save up to ${MAX_CUSTOM_SHARE_THEME_COLORS} custom share colors`,
      );
    }

    try {
      return await this.prisma.userShareThemeColor.create({
        data: {
          userId,
          name,
          color,
        },
      });
    } catch (error) {
      if ((error as any)?.code === "P2002") {
        throw new ConflictException("You already saved that share color");
      }
      throw error;
    }
  }

  async deleteOwnShareThemeColor(userId: string, colorId: string) {
    const color = await this.prisma.userShareThemeColor.findUnique({
      where: { id: colorId },
    });

    if (!color || color.userId !== userId) {
      throw new NotFoundException("Share theme color not found");
    }

    return await this.prisma.userShareThemeColor.delete({
      where: { id: colorId },
    });
  }

  async delete(
    id: string,
    actingUser?: Pick<User, "isAdmin" | "role" | "protected"> | null,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { shares: true },
    });
    if (!user) throw new BadRequestException("User not found");
    this.assertProtectedModifiable(user, actingUser);

    if (actingUser && !actingUser.isAdmin && user.role !== "user") {
      throw new ForbiddenException("Managers can only delete basic users.");
    }

    if (user.isAdmin) {
      const userCount = await this.prisma.user.count({
        where: { isAdmin: true },
      });

      if (userCount === 1) {
        throw new BadRequestException("Cannot delete the last admin user");
      }
    }

    await Promise.all(
      user.shares.map((share) => this.fileService.deleteAllFiles(share.id)),
    );

    return await this.prisma.user.delete({ where: { id } });
  }

  async findOrCreateFromLDAP(
    providedCredentials: AuthSignInDTO,
    ldapEntry: Entry,
  ) {
    const fieldNameMemberOf = this.configService.get("ldap.fieldNameMemberOf");
    const fieldNameEmail = this.configService.get("ldap.fieldNameEmail");

    let isAdmin = false;
    if (fieldNameMemberOf in ldapEntry) {
      const adminGroup = this.configService.get("ldap.adminGroups");
      const entryGroups = Array.isArray(ldapEntry[fieldNameMemberOf])
        ? ldapEntry[fieldNameMemberOf]
        : [ldapEntry[fieldNameMemberOf]];
      isAdmin = entryGroups.includes(adminGroup) ?? false;
    } else {
      this.logger.warn(
        `Trying to create/update a ldap user but the member field ${fieldNameMemberOf} is not present.`,
      );
    }

    let userEmail: string | null = null;
    if (fieldNameEmail in ldapEntry) {
      const value = Array.isArray(ldapEntry[fieldNameEmail])
        ? ldapEntry[fieldNameEmail][0]
        : ldapEntry[fieldNameEmail];
      if (value) {
        userEmail = value.toString();
      }
    } else {
      this.logger.warn(
        `Trying to create/update a ldap user but the email field ${fieldNameEmail} is not present.`,
      );
    }

    if (providedCredentials.email) {
      userEmail = providedCredentials.email;
    }

    const randomId = crypto.randomUUID();
    const placeholderUsername = `ldap_user_${randomId}`;
    const placeholderEMail = `${randomId}@ldap.local`;

    try {
      const user = await this.prisma.user.upsert({
        create: {
          username: providedCredentials.username ?? placeholderUsername,
          email: userEmail ?? placeholderEMail,
          password: await argon.hash(crypto.randomUUID()),

          isAdmin,
          role: isAdmin ? "admin" : "user",
          ldapDN: ldapEntry.dn,
        },
        update: {
          isAdmin,
          role: isAdmin ? "admin" : "user",
          ldapDN: ldapEntry.dn,
        },
        where: {
          ldapDN: ldapEntry.dn,
        },
      });

      if (user.username === placeholderUsername) {
        await this.prisma.user
          .update({
            where: {
              id: user.id,
            },
            data: {
              username: `user_${user.id}`,
            },
          })
          .then((newUser) => {
            user.username = newUser.username;
          })
          .catch((error) => {
            this.logger.warn(
              `Failed to update users ${user.id} placeholder username: ${inspect(error)}`,
            );
          });
      }

      if (userEmail && userEmail !== user.email) {
        await this.prisma.user
          .update({
            where: {
              id: user.id,
            },
            data: {
              email: userEmail,
            },
          })
          .then((newUser) => {
            this.logger.log(
              `Updated users ${user.id} email from ldap from ${user.email} to ${userEmail}.`,
            );
            user.email = newUser.email;
          })
          .catch((error) => {
            this.logger.error(
              `Failed to update users ${user.id} email to ${userEmail}: ${inspect(error)}`,
            );
          });
      }

      return user;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code == "P2002") {
          const duplicatedField: string = e.meta.target[0];
          throw new BadRequestException(
            `A user with this ${duplicatedField} already exists`,
          );
        }
      }
    }
  }
}
