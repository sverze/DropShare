import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class GeniusImportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url: string;
}
