import { Expose, plainToClass } from "class-transformer";
import { ShareDTO } from "src/share/dto/share.dto";

export class FileDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  size: string;

  @Expose()
  order?: number;

  @Expose()
  previewGroup?: boolean;

  @Expose()
  previewHeader?: string | null;

  @Expose()
  relativePath: string | null;

  @Expose()
  lyricsText?: string | null;

  @Expose()
  lyricsSource?: string | null;

  @Expose()
  lyricsSourceUrl?: string | null;

  @Expose()
  lyricsSyncEnabled?: boolean;

  @Expose()
  lyricsSyncedAt?: Date | null;

  @Expose()
  lyricsSyncStatus?: string | null;

  @Expose()
  lyricsSyncError?: string | null;

  @Expose()
  virusScanStatus?: string;

  @Expose()
  virusScanStartedAt?: Date | null;

  @Expose()
  virusScanCompletedAt?: Date | null;

  @Expose()
  virusScanThreats?: string | null;

  @Expose()
  virusScanError?: string | null;

  share: ShareDTO;

  from(partial: Partial<FileDTO>) {
    return plainToClass(FileDTO, partial, { excludeExtraneousValues: true });
  }
}
