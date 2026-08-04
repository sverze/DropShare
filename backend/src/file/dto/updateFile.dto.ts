import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateFileDTO {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  previewGroup?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  previewHeader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  lyricsText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lyricsSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  lyricsSourceUrl?: string;

  @IsOptional()
  @IsBoolean()
  lyricsSyncEnabled?: boolean;

  @IsOptional()
  @IsString()
  lyricsSyncedAt?: string;
}
