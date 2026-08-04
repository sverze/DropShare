import { Expose, plainToClass, Type } from "class-transformer";
import { FileDTO } from "src/file/dto/file.dto";
import { PublicUserDTO } from "src/user/dto/publicUser.dto";

class ShareGroupDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;
}

export class ShareDTO {
  @Expose()
  id: string;

  @Expose()
  name?: string;

  @Expose()
  expiration: Date;

  @Expose()
  @Type(() => FileDTO)
  files: FileDTO[];

  @Expose()
  @Type(() => PublicUserDTO)
  creator: PublicUserDTO;

  @Expose()
  groupId?: string | null;

  @Expose()
  @Type(() => ShareGroupDTO)
  group?: ShareGroupDTO | null;

  @Expose()
  description: string;

  @Expose()
  hasPassword?: boolean;

  @Expose()
  size: number;

  @Expose()
  views: number;

  @Expose()
  downloads: number;

  @Expose()
  accentColor: string;

  @Expose()
  previewStyle?: string;

  @Expose()
  uploadLocked?: boolean;

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

  @Expose()
  editablePermissions?: {
    canAccessEditor: boolean;
    canEditShareThemeColor: boolean;
    canEditShareName: boolean;
    canEditShareDescription: boolean;
    canEditShareFileOrder: boolean;
    canAddFiles: boolean;
    canRemoveFiles: boolean;
  };

  from(partial: Partial<ShareDTO>) {
    return plainToClass(ShareDTO, partial, { excludeExtraneousValues: true });
  }

  fromList(partial: Partial<ShareDTO>[]) {
    return partial.map((part) =>
      plainToClass(ShareDTO, part, { excludeExtraneousValues: true }),
    );
  }
}
