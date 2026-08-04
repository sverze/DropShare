import { Expose, plainToClass } from "class-transformer";

export class UserShareThemeColorDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  color: string;

  @Expose()
  createdAt: Date;

  from(partial: Partial<UserShareThemeColorDTO>) {
    return plainToClass(UserShareThemeColorDTO, partial, {
      excludeExtraneousValues: true,
    });
  }

  fromList(partial: Partial<UserShareThemeColorDTO>[]) {
    return partial.map((item) => this.from(item));
  }
}
