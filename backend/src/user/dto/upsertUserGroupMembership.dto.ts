import { IsIn, IsString } from "class-validator";

export class UpsertUserGroupMembershipDto {
  @IsString()
  userId: string;

  @IsString()
  @IsIn(["member", "leader"])
  role: string;
}
