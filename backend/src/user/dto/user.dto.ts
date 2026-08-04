import { Expose, plainToClass } from "class-transformer";
import { IsEmail, Length, Matches, MinLength } from "class-validator";
import { UserShareThemeColorDTO } from "./userShareThemeColor.dto";
import { UserGroupDTO } from "./userGroup.dto";

export class UserDTO {
  @Expose()
  id: string;

  @Expose()
  @Matches("^[a-zA-Z0-9_.]*$", undefined, {
    message: "Username can only contain letters, numbers, dots and underscores",
  })
  @Length(3, 32)
  username: string;

  @Expose()
  @IsEmail()
  email: string;

  @Expose()
  hasPassword: boolean;

  @MinLength(8)
  password: string;

  @Expose()
  isAdmin: boolean;

  @Expose()
  protected: boolean;

  @Expose()
  role: string;

  @Expose()
  capabilities?: string[];

  @Expose()
  canCreateShares: boolean;

  @Expose()
  bannedAt: Date | null;

  @Expose()
  bannedUntil: Date | null;

  @Expose()
  banReason: string | null;

  @Expose()
  avatar: string | null;

  @Expose()
  theme: string;

  @Expose()
  isLdap: boolean;

  ldapDN?: string;

  @Expose()
  totpVerified: boolean;

  @Expose()
  hasPasskeys: boolean;

  @Expose()
  maxFileSizeOverride: string | null;

  @Expose()
  shareThemeColors: UserShareThemeColorDTO[];

  @Expose()
  groupMembership?: {
    id: string;
    role: string;
    allowEditShares: boolean;
    canEditShareThemeColor: boolean;
    canEditShareName: boolean;
    canEditShareDescription: boolean;
    canEditShareFileOrder: boolean;
    canAddFiles: boolean;
    canRemoveFiles: boolean;
    group: UserGroupDTO;
  } | null;

  @Expose()
  groupMemberships?: {
    id: string;
    role: string;
    allowEditShares: boolean;
    canEditShareThemeColor: boolean;
    canEditShareName: boolean;
    canEditShareDescription: boolean;
    canEditShareFileOrder: boolean;
    canAddFiles: boolean;
    canRemoveFiles: boolean;
    group: UserGroupDTO;
  }[];

  from(partial: any) {
    const result = plainToClass(UserDTO, partial, {
      excludeExtraneousValues: true,
    });
    result.isLdap = partial.ldapDN?.length > 0;
    if (partial.maxFileSizeOverride !== undefined && partial.maxFileSizeOverride !== null) {
      result.maxFileSizeOverride = partial.maxFileSizeOverride.toString();
    } else {
      result.maxFileSizeOverride = null;
    }
    result.avatar = this.resolveAvatar(partial.avatar);
    result.theme = partial.theme || "dark";
    result.hasPasskeys = (partial._count?.passkeys ?? partial.passkeys?.length ?? 0) > 0;
    result.shareThemeColors = new UserShareThemeColorDTO().fromList(
      partial.shareThemeColors || [],
    );
    const memberships = partial.groupMemberships || (partial.groupMembership ? [partial.groupMembership] : []);
    result.groupMemberships = memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      allowEditShares: Boolean(membership.allowEditShares),
      canEditShareThemeColor: Boolean(membership.canEditShareThemeColor),
      canEditShareName: Boolean(membership.canEditShareName),
      canEditShareDescription: Boolean(membership.canEditShareDescription),
      canEditShareFileOrder: Boolean(membership.canEditShareFileOrder),
      canAddFiles: Boolean(membership.canAddFiles),
      canRemoveFiles: Boolean(membership.canRemoveFiles),
      group: new UserGroupDTO().from(membership.group),
    }));
    result.groupMembership = result.groupMemberships[0] || null;
    return result;
  }

  fromList(partial: any[]) {
    return partial.map((part) => this.from(part));
  }

  private resolveAvatar(avatar?: string | null): string | null {
    if (!avatar) return null;
    if (/^https?:\/\//i.test(avatar) || avatar.startsWith("/")) {
      return avatar;
    }
    return `/api/users/avatars/${avatar}`;
  }
}
