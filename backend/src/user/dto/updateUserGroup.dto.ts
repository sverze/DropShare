import { IsOptional, IsString, Matches } from "class-validator";

export class UpdateUserGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Matches(/^\d+$/, { message: "shareSizeLimit must be a numeric byte value" })
  shareSizeLimit?: string | null;
}
