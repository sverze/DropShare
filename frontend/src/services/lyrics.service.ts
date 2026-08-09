import api from "./api.service";

export type LyricsProvider = "genius" | "lrclib";

export type GeniusSearchResult = {
  title: string;
  artist: string;
  /** Genius page URL, or an "lrclib:<id>" pseudo-URL for LRCLIB entries. */
  url: string;
  thumbnail?: string | null;
  /** Absent on responses from older backends; treat as Genius. */
  provider?: LyricsProvider;
};

const lyricsService = {
  /**
   * Searches every provider the backend knows about. The endpoint is still
   * named after Genius for compatibility, but results can come from either
   * source and carry a `provider` telling you which.
   */
  async searchGenius(query: string): Promise<GeniusSearchResult[]> {
    const response = await api.post("/lyrics/genius/search", { query });
    return response.data?.results || [];
  },

  async importFromGenius(url: string): Promise<{
    url: string;
    title: string;
    lyricsText: string;
  }> {
    const response = await api.post("/lyrics/genius/import", { url });
    return response.data;
  },
};

export default lyricsService;
