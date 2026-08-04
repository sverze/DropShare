import {
  IsBoolean,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateReverseShareDTO {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsBoolean()
  sendEmailNotification: boolean;

  @IsString()
  maxShareSize: string;

  @IsString()
  shareExpiration: string;

  @Min(1)
  @Max(1000)
  maxUseCount: number;

  @IsBoolean()
  simplified: boolean;

  @IsBoolean()
  publicAccess: boolean;
}
