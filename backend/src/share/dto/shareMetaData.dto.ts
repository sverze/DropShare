import { Expose, plainToClass } from "class-transformer";

export class ShareMetaDataDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  hasPassword: boolean;

  @Expose()
  isZipReady: boolean;

  @Expose()
  virusScanStatus?: string;

  @Expose()
  fileCount: number;

  @Expose()
  totalSize: number;

  @Expose()
  previewImageId: string | null;

  @Expose()
  accentColor: string;

  @Expose()
  firstFileName?: string | null;

  @Expose()
  firstFileFacts?: string | null;

  from(partial: Partial<ShareMetaDataDTO>) {
    return plainToClass(ShareMetaDataDTO, partial, {
      excludeExtraneousValues: true,
    });
  }
}
