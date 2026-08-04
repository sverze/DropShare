import {
  IsBoolean,
  IsHexColor,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateShareDTO {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsHexColor({
    message: "accentColor must be a valid hex color (e.g., #00ff5a)",
  })
  accentColor?: string;

  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @IsBoolean()
  shareWithGroup?: boolean;

  @IsOptional()
  @IsString()
  groupId?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(["full", "consolidated"])
  previewStyle?: string;
}
