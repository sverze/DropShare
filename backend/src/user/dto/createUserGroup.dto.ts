import { IsOptional, IsString, Matches } from "class-validator";

export class CreateUserGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @Matches(/^\d+$/, { message: "shareSizeLimit must be a numeric byte value" })
  shareSizeLimit?: string | null;
}
