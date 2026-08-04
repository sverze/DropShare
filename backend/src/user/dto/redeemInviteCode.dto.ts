import { IsString, MinLength } from "class-validator";

export class RedeemInviteCodeDto {
  @IsString()
  @MinLength(1)
  inviteCode: string;
}
