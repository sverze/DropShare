import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class BulkShareActionDTO {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];

  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}

export class BulkAssignGroupDTO extends BulkShareActionDTO {
  @IsOptional()
  @IsString()
  targetGroupId?: string;
}
