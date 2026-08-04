import api from "./api.service";

export type GeniusSearchResult = {
  title: string;
  artist: string;
  url: string;
  thumbnail?: string | null;
};

const lyricsService = {
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
