import type { Song } from "../../domain/Song.js";
import type { MusicProvider } from "../../ports/MusicProvider.js";

/**
 * Composite : chaîne de fournisseurs ordonnée par préférence.
 * Chaque fournisseur est essayé à tour de rôle ; une erreur ou une
 * absence de résultat fait passer au suivant. Placé en dernière
 * position, le fallback local garantit qu'un morceau est toujours
 * retourné : une panne fournisseur ne doit jamais empêcher le réveil.
 */
export class ResilientMusicProvider implements MusicProvider {
  readonly name = "resilient-chain";
  private lastUsed: MusicProvider | null = null;

  constructor(private readonly chain: readonly MusicProvider[]) {
    if (chain.length === 0) {
      throw new Error("ResilientMusicProvider requiert au moins un fournisseur");
    }
  }

  /** Fournisseur ayant répondu lors du dernier appel (observabilité/tests). */
  get lastProviderName(): string | null {
    return this.lastUsed?.name ?? null;
  }

  async findSong(query: string): Promise<Song> {
    for (const provider of this.chain) {
      try {
        const song = await provider.findSong(query);
        if (song) {
          this.lastUsed = provider;
          return song;
        }
      } catch {
        // Fournisseur en panne ou réponse inexploitable : on tente le suivant.
      }
    }
    // Ne devrait arriver que si la chaîne ne contient pas de fallback local.
    throw new Error(
      `Aucun fournisseur n'a pu fournir de morceau pour « ${query} »`,
    );
  }
}
