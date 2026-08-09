import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { GeniusImportDto } from "./dto/genius-import.dto";
import { GeniusSearchDto } from "./dto/genius-search.dto";
import { LyricsService } from "./lyrics.service";

@Controller("lyrics")
export class LyricsController {
  constructor(private readonly lyricsService: LyricsService) {}

  /**
   * Searches every provider and merges the results, each tagged with the
   * provider it came from.
   *
   * The genius/* paths are kept as aliases so older clients keep working;
   * they have not been Genius-only since LRCLIB was added.
   */
  @Post("search")
  @Throttle({ default: { limit: 30, ttl: 60 } })
  async search(@Body() body: GeniusSearchDto) {
    return { results: await this.lyricsService.search(body.query) };
  }

  @Post("import")
  @Throttle({ default: { limit: 30, ttl: 60 } })
  async import(@Body() body: GeniusImportDto) {
    return this.lyricsService.importFromUrl(body.url);
  }

  @Post("genius/search")
  @Throttle({ default: { limit: 30, ttl: 60 } })
  async searchGenius(@Body() body: GeniusSearchDto) {
    return { results: await this.lyricsService.search(body.query) };
  }

  @Post("genius/import")
  @Throttle({ default: { limit: 30, ttl: 60 } })
  async importFromGenius(@Body() body: GeniusImportDto) {
    return this.lyricsService.importFromUrl(body.url);
  }
}
