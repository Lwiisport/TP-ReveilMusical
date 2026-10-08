import type { Song } from "../../domain/Song.js";
import type { MusicProvider } from "../../ports/MusicProvider.js";

interface MusicBrainzResponse {
  recordings?: Array<{
    title?: string;
    "artist-credit"?: Array<{ name?: string }>;
  }>;
}

/**
 * Adapter : MusicBrainz -> port MusicProvider.
 * MusicBrainz rejette toute requête sans en-tête User-Agent
 * identifiable (nom d'application + contact).
 */
export class MusicBrainzMusicProvider implements MusicProvider {
  readonly name = "musicbrainz";

  constructor(
    private readonly http: typeof fetch = fetch,
    private readonly userAgent = "ReveilMusical/0.1 (contact@reveil-musical.example)",
  ) {}

  async findSong(query: string): Promise<Song | null> {
    const url =
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}` +
      `&fmt=json&limit=1`;
    const response = await this.http(url, {
      headers: { "User-Agent": this.userAgent, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`MusicBrainz a répondu ${response.status}`);
    }
    const data = (await response.json()) as MusicBrainzResponse;
    const recording = data.recordings?.find((r) => r.title);
    if (!recording) return null;
    return {
      title: recording.title!,
      artist: recording["artist-credit"]?.find((a) => a.name)?.name ?? "Artiste inconnu",
    };
  }
}
