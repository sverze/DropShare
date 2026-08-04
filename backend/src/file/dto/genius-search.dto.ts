import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class GeniusSearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query: string;
}
