import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule } from "src/config/config.module";
import { ShareModule } from "src/share/share.module";
import { ReverseShareModule } from "src/reverseShare/reverseShare.module";
import { FileController } from "./file.controller";
import { FileService } from "./file.service";
import { LyricsController } from "./lyrics.controller";
import { LyricsService } from "./lyrics.service";
import { LocalFileService } from "./local.service";

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ShareModule),
    forwardRef(() => ReverseShareModule),
  ],
  controllers: [FileController, LyricsController],
  providers: [FileService, LocalFileService, LyricsService],
  exports: [FileService, LyricsService],
})
export class FileModule {}
