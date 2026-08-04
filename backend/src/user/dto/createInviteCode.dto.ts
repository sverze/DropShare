import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateInviteCodeDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  maxUses?: number | null;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  groupId?: string | null;
}
