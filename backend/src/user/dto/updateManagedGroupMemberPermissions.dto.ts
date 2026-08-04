import { IsBoolean, IsOptional } from "class-validator";

export class UpdateManagedGroupMemberPermissionsDto {
  @IsOptional()
  @IsBoolean()
  allowEditShares?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditShareThemeColor?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditShareName?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditShareDescription?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditShareFileOrder?: boolean;

  @IsOptional()
  @IsBoolean()
  canAddFiles?: boolean;

  @IsOptional()
  @IsBoolean()
  canRemoveFiles?: boolean;
}
