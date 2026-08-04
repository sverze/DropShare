import { Expose, plainToClass, Type } from "class-transformer";

class UserActivityIpDTO {
  @Expose()
  ipAddress: string;

  @Expose()
  requests: number;

  @Expose()
  lastSeen: Date;
}

class UserActivityUserDTO {
  @Expose()
  userId: string;

  @Expose()
  username: string;

  @Expose()
  email: string;

  @Expose()
  requests: number;

  @Expose()
  lastSeen: Date;

  @Expose()
  bannedAt: Date | null;

  @Expose()
  bannedUntil: Date | null;

  @Expose()
  @Type(() => UserActivityIpDTO)
  ips: UserActivityIpDTO[];
}

export class UserActivitySummaryDTO {
  @Expose()
  @Type(() => UserActivityUserDTO)
  users: UserActivityUserDTO[];

  from(partial: Partial<UserActivitySummaryDTO>) {
    return plainToClass(UserActivitySummaryDTO, partial, {
      excludeExtraneousValues: true,
    });
  }
}
