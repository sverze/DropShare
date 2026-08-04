import { IsHexColor, IsString, Length } from "class-validator";

export class CreateUserShareThemeColorDto {
  @IsString()
  @Length(1, 24)
  name: string;

  @IsHexColor()
  color: string;
}
