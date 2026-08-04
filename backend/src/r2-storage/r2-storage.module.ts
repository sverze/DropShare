import { forwardRef, Global, Module } from "@nestjs/common";
import { FileModule } from "src/file/file.module";
import { ShareModule } from "src/share/share.module";
import { R2StorageService } from "./r2-storage.service";
import { MultipartUploadController } from "./multipart-upload.controller";

@Global()
@Module({
  imports: [forwardRef(() => ShareModule), forwardRef(() => FileModule)],
  controllers: [MultipartUploadController],
  providers: [R2StorageService],
  exports: [R2StorageService],
})
export class R2StorageModule {}
