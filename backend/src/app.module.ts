import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AppCacheModule } from "./cache/cache.module";
import { AppController } from "./app.controller";
import { ClamScanModule } from "./clamscan/clamscan.module";
import { ConfigModule } from "./config/config.module";
import { DonationModule } from "./donation/donation.module";
import { EmailModule } from "./email/email.module";
import { EmailTemplatesModule } from "./email-templates/email-templates.module";
import { FileModule } from "./file/file.module";
import { ExportModule } from "./export/export.module";
import { JobsModule } from "./jobs/jobs.module";
import { OAuthModule } from "./oauth/oauth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { R2StorageModule } from "./r2-storage/r2-storage.module";
import { ReverseShareModule } from "./reverseShare/reverseShare.module";
import { ShareModule } from "./share/share.module";
import { UserModule } from "./user/user.module";
import { UploadLimitRequestModule } from "./upload-limit-request/upload-limit-request.module";

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    ShareModule,
    FileModule,
    EmailModule,
    PrismaModule,
    JobsModule,
    UserModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    ClamScanModule,
    ReverseShareModule,
    OAuthModule,
    AppCacheModule,
    AdminModule,
    ExportModule,
    R2StorageModule,
    UploadLimitRequestModule,
    DonationModule,
    EmailTemplatesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
