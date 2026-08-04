import { Expose, plainToClass } from "class-transformer";

export class BlockedIpDTO {
  @Expose()
  id: string;

  @Expose()
  ipAddress: string;

  @Expose()
  note?: string | null;

  @Expose()
  createdAt: Date;

  from(partial: Partial<BlockedIpDTO>) {
    return plainToClass(BlockedIpDTO, partial, {
      excludeExtraneousValues: true,
    });
  }

  fromList(partial: Partial<BlockedIpDTO>[]) {
    return partial.map((part) =>
      plainToClass(BlockedIpDTO, part, {
        excludeExtraneousValues: true,
      }),
    );
  }
}
