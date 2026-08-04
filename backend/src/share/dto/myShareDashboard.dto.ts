import { Expose, plainToClass, Type } from "class-transformer";
import { MyShareDTO } from "./myShare.dto";

class MySharesPaginationDTO {
  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  total: number;

  @Expose()
  totalPages: number;
}

class MySharesStatsDTO {
  @Expose()
  totalShares: number;

  @Expose()
  totalFiles: number;

  @Expose()
  totalViews: number;

  @Expose()
  totalDownloads: number;

  @Expose()
  totalSize: number;

  @Expose()
  uniqueVisitors30d: number;
}

export class MyShareDashboardDTO {
  @Expose()
  @Type(() => MyShareDTO)
  shares: MyShareDTO[];

  @Expose()
  @Type(() => MySharesPaginationDTO)
  pagination: MySharesPaginationDTO;

  @Expose()
  @Type(() => MySharesStatsDTO)
  stats: MySharesStatsDTO;

  from(partial: Partial<MyShareDashboardDTO>) {
    return plainToClass(MyShareDashboardDTO, partial, {
      excludeExtraneousValues: true,
    });
  }
}
