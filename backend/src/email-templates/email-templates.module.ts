import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { EmailTemplatesController } from "./email-templates.controller";
import { EmailTemplatesService } from "./email-templates.service";

@Module({
  imports: [EmailModule],
  controllers: [EmailTemplatesController],
  providers: [EmailTemplatesService],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
