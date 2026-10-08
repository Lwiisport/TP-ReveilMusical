import type { Song } from "../../domain/Song.js";
import type { MusicProvider } from "../../ports/MusicProvider.js";

interface CacheEntry {
  song: Song | null;
  expiresAt: number;
}

/**
 * Decorator : cache à TTL devant un fournisseur de musique.
 * iTunes plafonne à ~20 requêtes/minute : mémoriser les réponses
 * (y compris les « null ») évite de frapper l'API pour la même requête.
 */
export class CachedMusicProvider implements MusicProvider {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly inner: MusicProvider,
    private readonly ttlMs = 60_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get name(): string {
    return this.inner.name;
  }

  async findSong(query: string): Promise<Song | null> {
    const key = query.trim().toLowerCase();
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.song;

    const song = await this.inner.findSong(query);
    this.cache.set(key, { song, expiresAt: this.now() + this.ttlMs });
    return song;
  }
}
