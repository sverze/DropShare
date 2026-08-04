import { PartialType, PickType } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { UserDTO } from "./user.dto";

export class UpdateOwnUserDTO extends PartialType(
  PickType(UserDTO, ["username", "email"] as const),
) {
  @IsOptional()
  @IsString()
  avatar?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(["dark", "light"])
  theme?: string;
}
