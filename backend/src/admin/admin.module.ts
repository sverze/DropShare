import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AdminStatsController } from "./admin-stats.controller";
import { AdminLogsController } from "./admin-logs.controller";
import { AdminShareSecurityController } from "./admin-share-security.controller";
import { AdminPreviewController } from "./admin-preview.controller";
import { AdminStorageController } from "./admin-storage.controller";
import { AccessLevelsController } from "./access-levels.controller";
import { AccessLevelsService } from "./access-levels.service";
import { EmailModule } from "src/email/email.module";
import { RequestLoggerMiddleware } from "./request-logger.middleware";
import { ShareSecurityMiddleware } from "./share-security.middleware";
import { ShareSecurityService } from "./share-security.service";
import { ShareModule } from "src/share/share.module";
import { FileModule } from "src/file/file.module";
import { R2StorageModule } from "src/r2-storage/r2-storage.module";

@Module({
  imports: [ShareModule, FileModule, R2StorageModule, EmailModule],
  controllers: [
    AdminStatsController,
    AdminLogsController,
    AdminShareSecurityController,
    AdminPreviewController,
    AdminStorageController,
    AccessLevelsController,
  ],
  providers: [
    ShareSecurityService,
    ShareSecurityMiddleware,
    AccessLevelsService,
  ],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
    consumer.apply(ShareSecurityMiddleware).forRoutes("shares");
  }
}
