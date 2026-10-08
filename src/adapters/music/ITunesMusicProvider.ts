import type { Song } from "../../domain/Song.js";
import type { MusicProvider } from "../../ports/MusicProvider.js";

/** Shape minimal de la réponse iTunes (contrat externe, confiné ici). */
interface ITunesSearchResponse {
  results?: Array<{
    trackName?: string;
    artistName?: string;
    // trackViewUrl et autres champs propres à iTunes sont volontairement ignorés.
  }>;
}

/**
 * Adapter : iTunes Search API -> port MusicProvider.
 * `fetch` est injecté pour permettre le test sans réseau et pour
 * ne pas coupler la classe à l'implémentation HTTP.
 */
export class ITunesMusicProvider implements MusicProvider {
  readonly name = "itunes";

  constructor(private readonly http: typeof fetch = fetch) {}

  async findSong(query: string): Promise<Song | null> {
    const url =
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}` +
      `&media=music&limit=5`;
    const response = await this.http(url);
    if (!response.ok) {
      throw new Error(`iTunes a répondu ${response.status}`);
    }
    const data = (await response.json()) as ITunesSearchResponse;
    const hit = data.results?.find((r) => r.trackName && r.artistName);
    if (!hit) return null;
    // Seuls les champs métier sont exposés : le reste du contrat iTunes ne fuit pas.
    return { title: hit.trackName!, artist: hit.artistName! };
  }
}
