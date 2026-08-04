import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateDonationIntentDto {
  @IsNumber()
  @Min(0.01)
  @Max(1000000)
  amountFiat: number;
}

export class UpdateDonationStatusDto {
  @IsIn(["pending", "confirmed", "failed", "cancelled", "expired", "paid_late"])
  status: "pending" | "confirmed" | "failed" | "cancelled" | "expired" | "paid_late";

  @IsOptional()
  @IsString()
  txHash?: string;

  @IsOptional()
  @IsString()
  amountCrypto?: string;
}
