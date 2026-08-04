import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { User } from "@prisma/client";
import { Response } from "express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { CapabilityGuard } from "src/auth/guard/capability.guard";
import { AdminOrManagerGuard } from "src/auth/guard/adminOrManager.guard";
import { RequireCapability } from "src/auth/decorator/requireCapability.decorator";
import { effectiveCapabilities } from "src/auth/capabilities";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { ConfigService } from "../config/config.service";
import { CreateUserDTO } from "./dto/createUser.dto";
import { CreateInviteCodeDto } from "./dto/createInviteCode.dto";
import { UpdateOwnUserDTO } from "./dto/updateOwnUser.dto";
import { UpdateInviteCodeDto } from "./dto/updateInviteCode.dto";
import { UpdateUserDto } from "./dto/updateUser.dto";
import { RedeemInviteCodeDto } from "./dto/redeemInviteCode.dto";
import { UserDTO } from "./dto/user.dto";
import { UserSevice } from "./user.service";
import { UserActivitySummaryDTO } from "./dto/userActivitySummary.dto";
import { CreateBlockedIpDto } from "./dto/createBlockedIp.dto";
import { BanUserDto } from "./dto/banUser.dto";
import { BlockedIpDTO } from "./dto/blockedIp.dto";
import { CreateUserShareThemeColorDto } from "./dto/createUserShareThemeColor.dto";
import { UserShareThemeColorDTO } from "./dto/userShareThemeColor.dto";
import { CreateUserGroupDto } from "./dto/createUserGroup.dto";
import { UpdateUserGroupDto } from "./dto/updateUserGroup.dto";
import { UpsertUserGroupMembershipDto } from "./dto/upsertUserGroupMembership.dto";
import { UserGroupDTO } from "./dto/userGroup.dto";
import { UpdateManagedGroupMemberPermissionsDto } from "./dto/updateManagedGroupMemberPermissions.dto";

const avatarStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = join(process.cwd(), "data", "avatars");
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const imageFileFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new BadRequestException("Only image files are allowed"), false);
  }
  const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const ext = extname(file.originalname).toLowerCase();
  if (!allowedExts.includes(ext)) {
    return cb(new BadRequestException("Invalid file extension"), false);
  }
  cb(null, true);
};

@Controller("users")
export class UserController {
  constructor(
    private userService: UserSevice,
    private config: ConfigService,
  ) {}

  @Get("me")
  @UseGuards(JwtGuard)
  async getCurrentUser(@GetUser() user?: User) {
    if (!user) return null;
    const currentUser = await this.userService.getCurrentUserProfile(user.id);
    const userDTO = new UserDTO().from(currentUser);
    userDTO.hasPassword = !!user.password;
    userDTO.capabilities = effectiveCapabilities(
      user,
      this.config.get("access.managerCapabilities"),
    );
    return userDTO;
  }

  @Patch("me")
  @UseGuards(JwtGuard)
  async updateCurrentUser(
    @GetUser() user: User,
    @Body() data: UpdateOwnUserDTO,
  ) {
    await this.userService.update(user.id, data);

    const updatedUser = await this.userService.getCurrentUserProfile(user.id);
    const userDTO = new UserDTO().from(updatedUser);
    userDTO.hasPassword = !!updatedUser?.password;
    return userDTO;
  }

  @Post("me/redeem-invite")
  @UseGuards(JwtGuard)
  async redeemInviteCode(
    @GetUser() user: User,
    @Body() dto: RedeemInviteCodeDto,
  ) {
    const updatedUser = await this.userService.redeemInviteCodeForUser(
      user.id,
      dto.inviteCode,
    );
    const userDTO = new UserDTO().from(updatedUser);
    userDTO.hasPassword = !!updatedUser?.password;
    return userDTO;
  }

  @Get("me/share-theme-colors")
  @UseGuards(JwtGuard)
  async listOwnShareThemeColors(@GetUser() user: User) {
    return new UserShareThemeColorDTO().fromList(
      await this.userService.listOwnShareThemeColors(user.id),
    );
  }

  @Post("me/share-theme-colors")
  @UseGuards(JwtGuard)
  async createOwnShareThemeColor(
    @GetUser() user: User,
    @Body() dto: CreateUserShareThemeColorDto,
  ) {
    return new UserShareThemeColorDTO().from(
      await this.userService.createOwnShareThemeColor(user.id, dto),
    );
  }

  @Delete("me/share-theme-colors/:id")
  @UseGuards(JwtGuard)
  async deleteOwnShareThemeColor(
    @GetUser() user: User,
    @Param("id") id: string,
  ) {
    return new UserShareThemeColorDTO().from(
      await this.userService.deleteOwnShareThemeColor(user.id, id),
    );
  }

  @Delete("me")
  @HttpCode(204)
  @UseGuards(JwtGuard)
  async deleteCurrentUser(
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.userService.delete(user.id);

    const isSecure = this.config.get("general.secureCookies");

    response.cookie("access_token", "accessToken", {
      maxAge: -1,
      secure: isSecure,
    });
    response.cookie("refresh_token", "", {
      path: "/api/auth/token",
      httpOnly: true,
      maxAge: -1,
      secure: isSecure,
    });
  }

  @Post("me/avatar")
  @UseGuards(JwtGuard)
  @UseInterceptors(
    FileInterceptor("avatar", {
      storage: avatarStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadAvatar(
    @GetUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    if (user.avatar) {
      const oldAvatarPath = join(process.cwd(), "data", "avatars", user.avatar);
      if (existsSync(oldAvatarPath)) {
        try {
          unlinkSync(oldAvatarPath);
        } catch (e) {
        }
      }
    }

    await this.userService.update(user.id, { avatar: file.filename });

    return {
      avatar: `/api/users/avatars/${file.filename}`,
      message: "Avatar uploaded successfully",
    };
  }

  @Delete("me/avatar")
  @UseGuards(JwtGuard)
  async deleteAvatar(@GetUser() user: User) {
    if (user.avatar) {
      const avatarPath = join(process.cwd(), "data", "avatars", user.avatar);
      if (existsSync(avatarPath)) {
        try {
          unlinkSync(avatarPath);
        } catch (e) {
        }
      }
      await this.userService.update(user.id, { avatar: null });
    }
    return { message: "Avatar deleted successfully" };
  }

  @Get("avatars/:filename")
  async getAvatar(
    @Param("filename") filename: string,
    @Res() res: Response,
  ) {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const avatarPath = join(process.cwd(), "data", "avatars", sanitizedFilename);
    
    if (!existsSync(avatarPath)) {
      throw new NotFoundException("Avatar not found");
    }
    
    return res.sendFile(avatarPath);
  }

  @Get()
  @RequireCapability("users.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async list() {
    return new UserDTO().fromList(await this.userService.list());
  }

  @Post()
  @RequireCapability("users.create")
  @UseGuards(JwtGuard, CapabilityGuard)
  async create(@GetUser() actingUser: User, @Body() user: CreateUserDTO) {
    return new UserDTO().from(await this.userService.create(user, actingUser));
  }

  @Get("invite-codes/all")
  @RequireCapability("invites.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async listInviteCodes() {
    return await this.userService.listInviteCodes();
  }

  @Get("groups")
  @RequireCapability("groups.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async listGroups() {
    return new UserGroupDTO().fromList(await this.userService.listGroups());
  }

  @Post("groups")
  @RequireCapability("groups.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async createGroup(@GetUser() actingUser: User, @Body() dto: CreateUserGroupDto) {
    return new UserGroupDTO().from(
      await this.userService.createGroup(actingUser, dto),
    );
  }

  @Patch("groups/:id")
  @RequireCapability("groups.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async updateGroup(
    @GetUser() actingUser: User,
    @Param("id") id: string,
    @Body() dto: UpdateUserGroupDto,
  ) {
    return new UserGroupDTO().from(
      await this.userService.updateGroup(actingUser, id, dto),
    );
  }

  @Delete("groups/:id")
  @RequireCapability("groups.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async deleteGroup(@Param("id") id: string) {
    return new UserGroupDTO().from(await this.userService.deleteGroup(id));
  }

  @Put("groups/:id/members")
  @RequireCapability("groups.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async upsertGroupMembership(
    @GetUser() actingUser: User,
    @Param("id") id: string,
    @Body() dto: UpsertUserGroupMembershipDto,
  ) {
    return new UserGroupDTO().from(
      (await this.userService.upsertGroupMembership(actingUser, id, dto)).group,
    );
  }

  @Delete("groups/members/:userId")
  @RequireCapability("groups.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async removeGroupMembership(@Param("userId") userId: string) {
    await this.userService.removeGroupMembership(userId);
    return { success: true };
  }

  @Delete("groups/:id/members/:userId")
  @RequireCapability("groups.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async removeGroupMemberFromGroup(
    @Param("id") id: string,
    @Param("userId") userId: string,
  ) {
    await this.userService.removeGroupMembership(userId, id);
    return { success: true };
  }

  @Get("me/group/manage")
  @UseGuards(JwtGuard)
  async getOwnManagedGroup(@GetUser() user: User) {
    return new UserGroupDTO().from(await this.userService.getOwnManagedGroup(user.id));
  }

  @Get("me/groups/manage")
  @UseGuards(JwtGuard)
  async listOwnManagedGroups(@GetUser() user: User) {
    return new UserGroupDTO().fromList(await this.userService.listOwnManagedGroups(user.id));
  }

  @Patch("me/groups/:groupId/members/:userId")
  @UseGuards(JwtGuard)
  async updateOwnManagedGroupMemberPermissions(
    @GetUser() user: User,
    @Param("groupId") groupId: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateManagedGroupMemberPermissionsDto,
  ) {
    return new UserGroupDTO().from(
      await this.userService.updateOwnManagedGroupMemberPermissions(user.id, groupId, userId, dto),
    );
  }

  @Delete("me/groups/:groupId/members/:userId")
  @UseGuards(JwtGuard)
  async removeOwnManagedGroupMember(
    @GetUser() user: User,
    @Param("groupId") groupId: string,
    @Param("userId") userId: string,
  ) {
    return new UserGroupDTO().from(
      await this.userService.removeOwnManagedGroupMember(user.id, groupId, userId),
    );
  }

  @Get("admin/activity-summary")
  @RequireCapability("users.view")
  @UseGuards(JwtGuard, CapabilityGuard)
  async getUserActivitySummary() {
    return new UserActivitySummaryDTO().from(
      await this.userService.getUserActivitySummary(),
    );
  }

  @Get("admin/ip-bans")
  @RequireCapability("security.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async listBlockedIps() {
    return new BlockedIpDTO().fromList(await this.userService.listBlockedIps());
  }

  @Post("admin/ip-bans")
  @RequireCapability("security.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async createBlockedIp(@Body() dto: CreateBlockedIpDto) {
    return new BlockedIpDTO().from(await this.userService.createBlockedIp(dto));
  }

  @Delete("admin/ip-bans/:id")
  @RequireCapability("security.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async deleteBlockedIp(@Param("id") id: string) {
    await this.userService.deleteBlockedIp(id);
    return { success: true };
  }

  @Post("invite-codes")
  @RequireCapability("invites.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async createInviteCode(
    @GetUser() user: User,
    @Body() dto: CreateInviteCodeDto,
  ) {
    return await this.userService.createInviteCode(dto, user.id);
  }

  @Patch("invite-codes/:id")
  @RequireCapability("invites.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async updateInviteCode(
    @Param("id") id: string,
    @Body() dto: UpdateInviteCodeDto,
  ) {
    return await this.userService.updateInviteCode(id, dto);
  }

  @Delete("invite-codes/:id")
  @RequireCapability("invites.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async deleteInviteCode(@Param("id") id: string) {
    return await this.userService.deleteInviteCode(id);
  }

  @Post(":id/ban")
  @RequireCapability("users.ban")
  @UseGuards(JwtGuard, CapabilityGuard)
  async banUser(
    @GetUser() actingUser: User,
    @Param("id") id: string,
    @Body() dto: BanUserDto,
  ) {
    const { user, bannedIpCount } = await this.userService.banUser(
      id,
      dto,
      actingUser,
    );
    return { user: new UserDTO().from(user), bannedIpCount };
  }

  @Post(":id/unban")
  @RequireCapability("users.ban")
  @UseGuards(JwtGuard, CapabilityGuard)
  async unbanUser(@GetUser() actingUser: User, @Param("id") id: string) {
    const { user, liftedIpCount } = await this.userService.unbanUser(
      id,
      actingUser,
    );
    return { user: new UserDTO().from(user), liftedIpCount };
  }

  @Post(":id/force-logout")
  @RequireCapability("users.ban")
  @UseGuards(JwtGuard, CapabilityGuard)
  async forceLogoutUser(@GetUser() actingUser: User, @Param("id") id: string) {
    return this.userService.forceLogoutUser(id, actingUser);
  }

  @Patch(":id")
  @UseGuards(JwtGuard, AdminOrManagerGuard)
  async update(
    @Param("id") id: string,
    @Body() user: UpdateUserDto,
    @GetUser() actingUser: User,
  ) {
    return new UserDTO().from(
      await this.userService.update(id, user, actingUser),
    );
  }

  @Delete(":id")
  @RequireCapability("users.delete")
  @UseGuards(JwtGuard, CapabilityGuard)
  async delete(@Param("id") id: string, @GetUser() actingUser: User) {
    return new UserDTO().from(await this.userService.delete(id, actingUser));
  }
}
