import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { CreateUserDTO } from "./createUser.dto";

export class UpdateUserDto extends PartialType(CreateUserDTO) {
  @IsOptional()
  maxFileSizeOverride?: string | null;

  @IsOptional()
  @IsString()
  avatar?: string | null;

  // Owner-tier flag. The service only honours this when the acting user is
  // itself protected; otherwise it is ignored.
  @IsOptional()
  @IsBoolean()
  protected?: boolean;
}
