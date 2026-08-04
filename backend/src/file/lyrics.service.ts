import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";

type GeniusSearchResult = {
  title: string;
  artist: string;
  url: string;
  thumbnail?: string | null;
};

@Injectable()
export class LyricsService {
  private readonly geniusHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept:
      "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://genius.com/",
  };

  async searchGenius(rawQuery: string): Promise<GeniusSearchResult[]> {
    const query = rawQuery.trim();

    if (!query) {
      throw new BadRequestException("Search query is required");
    }

    const response = await axios.get("https://genius.com/api/search/song", {
      headers: this.geniusHeaders,
      params: { q: query },
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
      }));
  }

  async importFromGenius(rawUrl: string) {
    const url = this.normalizeGeniusUrl(rawUrl);
    const response = await axios.get(url, {
      headers: this.geniusHeaders,
      responseType: "text",
    });

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
