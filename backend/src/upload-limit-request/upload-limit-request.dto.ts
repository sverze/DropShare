import { IsInt, IsString, Min, Max, MinLength, MaxLength } from 'class-validator';

export class CreateUploadLimitRequestDto {
  @IsInt()
  @Min(1, { message: 'Requested limit must be at least 1 GB' })
  @Max(1000, { message: 'Requested limit cannot exceed 1000 GB' })
  requestedLimit: number;

  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  @MaxLength(500, { message: 'Reason cannot exceed 500 characters' })
  reason: string;
}
