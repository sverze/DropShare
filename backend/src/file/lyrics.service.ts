import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import axios from "axios";

export type LyricsProvider = "genius" | "lrclib";

type LyricsSearchResult = {
  title: string;
  artist: string;
  /** Genius page URL, or an "lrclib:<id>" pseudo-URL for LRCLIB entries. */
  url: string;
  thumbnail?: string | null;
  provider: LyricsProvider;
};

/**
 * LRCLIB pseudo-URLs. LRCLIB has no per-song web page to link to, so its
 * entries are addressed by id through the same import path as Genius links.
 */
const LRCLIB_URL_PREFIX = "lrclib:";

@Injectable()
export class LyricsService {
  private readonly logger = new Logger(LyricsService.name);

  private readonly requestTimeoutMs = Number(
    process.env.LYRICS_REQUEST_TIMEOUT_MS || 10_000,
  );

  // LRCLIB asks callers to identify themselves rather than impersonate a
  // browser, and unlike Genius it does not block requests from hosting
  // providers.
  private readonly lrclibHeaders = {
    "User-Agent": "DropShare (https://github.com/sverze/DropShare)",
    Accept: "application/json",
  };

  private readonly geniusHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept:
      "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://genius.com/",
  };

  /**
   * Search both providers and merge.
   *
   * Genius has by far the better catalogue, particularly for unreleased and
   * leaked material, but it serves 403 to requests from hosting providers.
   * LRCLIB does not block, so it keeps the feature alive for released tracks.
   * A failure of either provider is not fatal as long as the other answers.
   */
  async search(rawQuery: string): Promise<LyricsSearchResult[]> {
    const query = rawQuery.trim();

    if (!query) {
      throw new BadRequestException("Search query is required");
    }

    const [genius, lrclib] = await Promise.allSettled([
      this.searchGenius(query),
      this.searchLrclib(query),
    ]);

    const results = [
      ...(genius.status === "fulfilled" ? genius.value : []),
      ...(lrclib.status === "fulfilled" ? lrclib.value : []),
    ];

    if (genius.status === "rejected") {
      this.logger.warn(
        `Genius search failed: ${this.describeFailure(genius.reason)}`,
      );
    }
    if (lrclib.status === "rejected") {
      this.logger.warn(
        `LRCLIB search failed: ${this.describeFailure(lrclib.reason)}`,
      );
    }

    // Only surface an error when nothing at all came back; a partial result is
    // more useful than a failure.
    if (
      results.length === 0 &&
      genius.status === "rejected" &&
      lrclib.status === "rejected"
    ) {
      throw new ServiceUnavailableException(
        "Lyrics search is unavailable right now. Both Genius and LRCLIB " +
          "failed to respond - you can still paste lyrics in manually.",
      );
    }

    return results;
  }

  private async searchGenius(query: string): Promise<LyricsSearchResult[]> {
    const response = await axios.get("https://genius.com/api/search/song", {
      headers: this.geniusHeaders,
      params: { q: query },
      timeout: this.requestTimeoutMs,
    });

    const sections = response.data?.response?.sections;
    const hits = Array.isArray(sections)
      ? sections.flatMap((section: any) =>
          Array.isArray(section?.hits) ? section.hits : [],
        )
      : [];

    return hits
      .map((hit: any) => hit?.result)
      .filter((result: any) => result?._type === "song" && result?.url)
      .slice(0, 8)
      .map((result: any) => ({
        title: String(result.title || "").trim(),
        artist: String(result.primary_artist?.name || "").trim(),
        url: String(result.url),
        thumbnail:
          result.song_art_image_thumbnail_url ||
          result.song_art_image_url ||
          null,
        provider: "genius" as const,
      }));
  }

  private async searchLrclib(query: string): Promise<LyricsSearchResult[]> {
    const response = await axios.get("https://lrclib.net/api/search", {
      headers: this.lrclibHeaders,
      params: { q: query },
      timeout: this.requestTimeoutMs,
    });

    const rows = Array.isArray(response.data) ? response.data : [];

    return rows
      .filter((row: any) => row?.id && (row.plainLyrics || row.syncedLyrics))
      .slice(0, 8)
      .map((row: any) => ({
        title: String(row.trackName || "").trim(),
        artist: String(row.artistName || "").trim(),
        url: `${LRCLIB_URL_PREFIX}${row.id}`,
        thumbnail: null,
        provider: "lrclib" as const,
      }));
  }

  /**
   * Fetch lyrics for a search result or a pasted link. Routes on the URL:
   * LRCLIB entries carry the pseudo-URL minted above, anything else is
   * treated as a Genius page.
   */
  async importFromUrl(rawUrl: string) {
    const trimmed = rawUrl.trim();

    if (trimmed.toLowerCase().startsWith(LRCLIB_URL_PREFIX)) {
      return this.importFromLrclib(trimmed.slice(LRCLIB_URL_PREFIX.length));
    }

    return this.importFromGenius(trimmed);
  }

  private async importFromLrclib(rawId: string) {
    const id = rawId.trim();

    if (!/^\d+$/.test(id)) {
      throw new BadRequestException("Invalid LRCLIB id");
    }

    let response: { data: any };
    try {
      response = await axios.get(`https://lrclib.net/api/get/${id}`, {
        headers: this.lrclibHeaders,
        timeout: this.requestTimeoutMs,
      });
    } catch (error) {
      throw this.toUpstreamException(error, "LRCLIB");
    }

    const row = response.data ?? {};

    // Prefer plain lyrics. syncedLyrics is LRC format with a [mm:ss.xx] stamp
    // per line, which would render as literal noise in the lyrics view.
    const lyricsText = String(
      row.plainLyrics || this.stripLrcTimestamps(row.syncedLyrics || ""),
    ).trim();

    if (!lyricsText) {
      throw new BadRequestException("LRCLIB has no lyrics for that track");
    }

    const title = [row.trackName, row.artistName]
      .filter(Boolean)
      .join(" - ")
      .trim();

    return {
      url: `${LRCLIB_URL_PREFIX}${id}`,
      title: title || "Imported from LRCLIB",
      lyricsText,
    };
  }

  private stripLrcTimestamps(synced: string) {
    return String(synced)
      .split("\n")
      .map((line) => line.replace(/^\s*\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*/, ""))
      .join("\n");
  }

  private async importFromGenius(rawUrl: string) {
    const url = this.normalizeGeniusUrl(rawUrl);

    let response: { data: any };
    try {
      response = await axios.get(url, {
        headers: this.geniusHeaders,
        responseType: "text",
        timeout: this.requestTimeoutMs,
      });
    } catch (error) {
      throw this.toUpstreamException(error, "Genius");
    }

    const html = String(response.data || "");
    const lyricsHtml = this.extractLyricsHtml(html);
    const lyricsText = this.htmlToLyricsRichText(lyricsHtml);
    const title = this.extractTitle(html);

    if (!this.richLyricsToPlainText(lyricsText).trim()) {
      throw new BadRequestException("No lyrics found on that Genius page");
    }

    return {
      url,
      title,
      lyricsText,
    };
  }

  /**
   * Turn an upstream failure into something the user can act on.
   *
   * Without this an axios rejection propagates as a bare 500 "Internal server
   * error", which tells nobody anything. The 403 case is the common one and
   * deserves a specific message: Genius blocks requests originating from
   * hosting providers, so a self-hosted instance on any cloud will see it and
   * no amount of retrying will help.
   */
  private toUpstreamException(error: unknown, provider: string) {
    const status = (error as any)?.response?.status;
    const code = (error as any)?.code;

    if (status === 403 || status === 401) {
      return new ServiceUnavailableException(
        `${provider} is refusing requests from this server (HTTP ${status}). ` +
          `This usually means the host's IP range is blocked. ` +
          `Try the other provider, or paste the lyrics in manually.`,
      );
    }

    if (status === 404) {
      return new BadRequestException(`${provider} has no lyrics at that link`);
    }

    if (status === 429) {
      return new ServiceUnavailableException(
        `${provider} is rate limiting this server. Try again shortly.`,
      );
    }

    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      return new ServiceUnavailableException(`${provider} timed out`);
    }

    if (
      code === "ENOTFOUND" ||
      code === "ENETUNREACH" ||
      code === "EHOSTUNREACH" ||
      code === "ECONNREFUSED"
    ) {
      return new ServiceUnavailableException(
        `Could not reach ${provider} from this server (${code})`,
      );
    }

    this.logger.error(
      `Unexpected ${provider} failure: ${this.describeFailure(error)}`,
    );

    return new ServiceUnavailableException(
      `${provider} lookup failed. You can still paste lyrics in manually.`,
    );
  }

  private describeFailure(error: unknown) {
    const status = (error as any)?.response?.status;
    const code = (error as any)?.code;
    const message = (error as any)?.message ?? String(error);

    return [status && `HTTP ${status}`, code, message]
      .filter(Boolean)
      .join(" ");
  }

  private normalizeGeniusUrl(rawUrl: string) {
    let parsed: URL;

    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new BadRequestException("Enter a valid Genius URL");
    }

    if (!/(^|\.)genius\.com$/i.test(parsed.hostname)) {
      throw new BadRequestException("Only Genius URLs are supported");
    }

    parsed.hash = "";
    parsed.search = "";

    return parsed.toString();
  }

  private extractLyricsHtml(pageHtml: string) {
    const combined = this.extractDivBlocks(pageHtml, 'data-lyrics-container="true"')
      .map((html) => this.stripNestedDivBlocks(html, "data-exclude-from-selection"))
      .map((html) => html.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (combined) {
      return combined;
    }

    const bodyMatch = pageHtml.match(
      /"lyricsData\\":\{.*?"body\\":\{"html\\":"((?:\\.|[^"\\])*)"/s,
    );

    if (bodyMatch?.[1]) {
      return JSON.parse(`"${bodyMatch[1]}"`) as string;
    }

    throw new BadRequestException("Unable to read lyrics from that Genius page");
  }

  private extractDivBlocks(sourceHtml: string, marker: string) {
    const blocks: string[] = [];
    let searchFrom = 0;

    while (searchFrom < sourceHtml.length) {
      const markerIndex = sourceHtml.indexOf(marker, searchFrom);
      if (markerIndex === -1) break;

      const startTagIndex = sourceHtml.lastIndexOf("<div", markerIndex);
      const startTagEnd = sourceHtml.indexOf(">", markerIndex);

      if (startTagIndex === -1 || startTagEnd === -1) {
        break;
      }

      const closingTagIndex = this.findClosingDivIndex(sourceHtml, startTagEnd + 1);

      if (closingTagIndex === -1) {
        break;
      }

      blocks.push(sourceHtml.slice(startTagEnd + 1, closingTagIndex));
      searchFrom = closingTagIndex + "</div>".length;
    }

    return blocks;
  }

  private stripNestedDivBlocks(sourceHtml: string, marker: string) {
    let result = "";
    let cursor = 0;

    while (cursor < sourceHtml.length) {
      const markerIndex = sourceHtml.indexOf(marker, cursor);

      if (markerIndex === -1) {
        result += sourceHtml.slice(cursor);
        break;
      }

      const startTagIndex = sourceHtml.lastIndexOf("<div", markerIndex);
      const startTagEnd = sourceHtml.indexOf(">", markerIndex);

      if (startTagIndex === -1 || startTagEnd === -1) {
        result += sourceHtml.slice(cursor);
        break;
      }

      result += sourceHtml.slice(cursor, startTagIndex);

      const closingTagIndex = this.findClosingDivIndex(sourceHtml, startTagEnd + 1);

      if (closingTagIndex === -1) {
        cursor = startTagEnd + 1;
        continue;
      }

      cursor = closingTagIndex + "</div>".length;
    }

    return result;
  }

  private findClosingDivIndex(sourceHtml: string, contentStart: number) {
    const divTagPattern = /<\/?div\b[^>]*>/gi;
    divTagPattern.lastIndex = contentStart;

    let depth = 1;
    let match: RegExpExecArray | null;

    while ((match = divTagPattern.exec(sourceHtml))) {
      const tag = match[0];
      const isClosingTag = tag.startsWith("</");
      const isSelfClosingTag = /\/>$/.test(tag);

      if (isClosingTag) {
        depth -= 1;
      } else if (!isSelfClosingTag) {
        depth += 1;
      }

      if (depth === 0) {
        return match.index;
      }
    }

    return -1;
  }

  private htmlToLyricsRichText(rawHtml: string) {
    const normalizedHtml = rawHtml
      .replace(/<span\b(?=[^>]*(?:opacity\s*:\s*0|pointer-events\s*:\s*none|position\s*:\s*absolute))[^>]*>.*?<\/span>/gis, "")
      .replace(/<(script|style|svg|button)\b[^>]*>.*?<\/\1>/gis, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
      .replace(/\r\n/g, "\n");

    return this.keepSafeLyricsFormatting(normalizedHtml)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private keepSafeLyricsFormatting(rawHtml: string) {
    const allowedTags = new Set(["b", "strong", "i", "em", "u"]);
    const tokenRegex = /<\/?([a-zA-Z0-9]+)(\s+[^>]*)?>/g;
    let output = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(rawHtml))) {
      output += this.decodeHtmlText(rawHtml.slice(lastIndex, match.index));

      const original = match[0];
      const tagName = match[1].toLowerCase();
      const isClosing = original.startsWith("</");

      if (allowedTags.has(tagName)) {
        output += isClosing ? `</${tagName}>` : `<${tagName}>`;
      }

      lastIndex = tokenRegex.lastIndex;
    }

    output += this.decodeHtmlText(rawHtml.slice(lastIndex));
    return output;
  }

  private richLyricsToPlainText(value: string) {
    return this.decodeHtmlText(value.replace(/<[^>]+>/g, ""));
  }

  private extractTitle(pageHtml: string) {
    const titleMatch = pageHtml.match(/<title>(.*?)<\/title>/i);
    const rawTitle = titleMatch?.[1] || "Imported from Genius";

    return this.decodeHtmlEntities(
      rawTitle.replace(/\s*\|\s*Genius Lyrics\s*$/i, "").trim(),
    );
  }

  private decodeHtmlEntities(text: string) {
    return text
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
        String.fromCharCode(Number.parseInt(code, 16)),
      )
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ");
  }

  private decodeHtmlText(text: string) {
    return text
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
        String.fromCharCode(Number.parseInt(code, 16)),
      )
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ");
  }
}
