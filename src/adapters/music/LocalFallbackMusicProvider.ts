import type { Song } from "../../domain/Song.js";
import type { MusicProvider } from "../../ports/MusicProvider.js";

/** Petite liste codée en dur : le silence n'est jamais acceptable. */
const LOCAL_SONGS: readonly Song[] = [
  { title: "Here Comes the Sun", artist: "The Beatles" },
  { title: "Sunny", artist: "Boney M." },
  { title: "Wake Me Up Before You Go-Go", artist: "Wham!" },
  { title: "Good Morning", artist: "Max Frost" },
  { title: "Lovely Day", artist: "Bill Withers" },
];

/**
 * Adapter : fallback local, dernier maillon de la chaîne.
 * Ne dépend d'aucun service externe et ne retourne jamais `null` :
 * il garantit qu'un réveil produit toujours un morceau.
 */
export class LocalFallbackMusicProvider implements MusicProvider {
  readonly name = "local-fallback";

  constructor(private readonly songs: readonly Song[] = LOCAL_SONGS) {}

  async findSong(query: string): Promise<Song | null> {
    // Choix déterministe à partir de la requête : reproductible en test.
    let hash = 0;
    for (const ch of query) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const song = this.songs[hash % this.songs.length];
    return song ?? this.songs[0] ?? { title: "Réveil", artist: "Inconnu" };
  }
}
