import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, ValidateNested } from "class-validator";

export class ShareSecurityDTO {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  maxViews?: number;
}

export class CreateShareDTO {
  @IsString()
  @IsNotEmpty()
  @Matches("^[a-zA-Z0-9_-]*$", undefined, {
    message: "ID can only contain letters, numbers, underscores, and hyphens",
  })
  @Length(3, 50)
  id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsNotEmpty()
  @IsString()
  expiration: string;

  @IsOptional()
  recipients: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches("^#[0-9A-Fa-f]{6}$", undefined, {
    message: "accentColor must be a valid hex color (e.g., #00ff5a)",
  })
  accentColor?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShareSecurityDTO)
  security?: ShareSecurityDTO;

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

  /**
   * "public" or "private". Omitted means take share.defaultShareVisibility.
   */
  @IsOptional()
  @IsString()
  @IsIn(["public", "private"])
  visibility?: string;
}
