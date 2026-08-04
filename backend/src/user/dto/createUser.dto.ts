import { plainToClass } from "class-transformer";
import { Allow, IsOptional, MinLength } from "class-validator";
import { UserDTO } from "./user.dto";

export class CreateUserDTO extends UserDTO {
  @Allow()
  isAdmin: boolean;

  @Allow()
  @IsOptional()
  role: string;

  @Allow()
  @IsOptional()
  canCreateShares: boolean;

  @MinLength(8)
  @IsOptional()
  password: string;

  @IsOptional()
  maxFileSizeOverride: string | null;

  from(partial: Partial<CreateUserDTO>) {
    return plainToClass(CreateUserDTO, partial, {
      excludeExtraneousValues: true,
    });
  }
}
