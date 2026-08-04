import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class BanUserDto {
  @IsIn(["7d", "2w", "permanent", "custom"])
  duration: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  customDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  banIps?: boolean;
}
