import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { GeniusImportDto } from "./dto/genius-import.dto";
import { GeniusSearchDto } from "./dto/genius-search.dto";
import { LyricsService } from "./lyrics.service";

@Controller("lyrics")
export class LyricsController {
  constructor(private readonly lyricsService: LyricsService) {}

  @Post("genius/search")
  @Throttle({
    default: {
      limit: 30,
      ttl: 60,
    },
  })
  async searchGenius(@Body() body: GeniusSearchDto) {
    return {
      results: await this.lyricsService.searchGenius(body.query),
    };
  }

  @Post("genius/import")
  @Throttle({
    default: {
      limit: 30,
      ttl: 60,
    },
  })
  async importFromGenius(@Body() body: GeniusImportDto) {
    return this.lyricsService.importFromGenius(body.url);
  }
}
