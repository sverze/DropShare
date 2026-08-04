import { Expose, plainToClass } from "class-transformer";

export class ReverseShareDTO {
  @Expose()
  id: string;

  @Expose()
  name: string | null;

  @Expose()
  maxShareSize: string;

  @Expose()
  shareExpiration: Date;

  @Expose()
  token: string;

  @Expose()
  simplified: boolean;

  from(partial: Partial<ReverseShareDTO>) {
    return plainToClass(ReverseShareDTO, partial, {
      excludeExtraneousValues: true,
    });
  }
}
