import { Expose, plainToClass, Type } from "class-transformer";

class UserGroupMemberDTO {
  @Expose()
  id: string;

  @Expose()
  role: string;

  @Expose()
  userId: string;

  @Expose()
  username: string;

  @Expose()
  email: string;

  @Expose()
  allowEditShares: boolean;

  @Expose()
  canEditShareThemeColor: boolean;

  @Expose()
  canEditShareName: boolean;

  @Expose()
  canEditShareDescription: boolean;

  @Expose()
  canEditShareFileOrder: boolean;

  @Expose()
  canAddFiles: boolean;

  @Expose()
  canRemoveFiles: boolean;
}

export class UserGroupDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  shareSizeLimit: string | null;

  @Expose()
  @Type(() => UserGroupMemberDTO)
  members: UserGroupMemberDTO[];

  from(partial: any) {
    const result = plainToClass(UserGroupDTO, partial, {
      excludeExtraneousValues: true,
    });
    result.shareSizeLimit =
      partial.shareSizeLimit !== undefined && partial.shareSizeLimit !== null
        ? partial.shareSizeLimit.toString()
        : null;
    result.members = (partial.memberships || partial.members || []).map((membership) => ({
      id: membership.id,
      role: membership.role,
      userId: membership.user?.id ?? membership.userId,
      username: membership.user?.username,
      email: membership.user?.email,
      allowEditShares: Boolean(membership.allowEditShares),
      canEditShareThemeColor: Boolean(membership.canEditShareThemeColor),
      canEditShareName: Boolean(membership.canEditShareName),
      canEditShareDescription: Boolean(membership.canEditShareDescription),
      canEditShareFileOrder: Boolean(membership.canEditShareFileOrder),
      canAddFiles: Boolean(membership.canAddFiles),
      canRemoveFiles: Boolean(membership.canRemoveFiles),
    }));
    return result;
  }

  fromList(partial: any[]) {
    return partial.map((entry) => this.from(entry));
  }
}
