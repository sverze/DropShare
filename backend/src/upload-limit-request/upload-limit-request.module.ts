import { Module } from '@nestjs/common';
import { UploadLimitRequestService } from './upload-limit-request.service';
import { UserUploadLimitRequestController } from './user-upload-limit-request.controller';
import { AdminUploadLimitRequestController } from './admin-upload-limit-request.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    UserUploadLimitRequestController,
    AdminUploadLimitRequestController,
  ],
  providers: [UploadLimitRequestService],
  exports: [UploadLimitRequestService],
})
export class UploadLimitRequestModule {}
