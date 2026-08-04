import { IsString } from "class-validator";

export class SignInEmailCodeDTO {
  @IsString()
  code: string;

  @IsString()
  loginToken: string;
}

export class ResendEmailCodeDTO {
  @IsString()
  loginToken: string;
}
