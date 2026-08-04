import { IsIP, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateRateLimitExemptIpDto {
  @IsIP()
  ipAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
