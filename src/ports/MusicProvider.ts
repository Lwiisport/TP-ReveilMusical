import type { Song } from "../domain/Song.js";

/**
 * Port métier vers un fournisseur de musique.
 * Le métier ne connaît que cette interface : changer de fournisseur
 * revient à changer l'implémentation enregistrée dans le container IoC.
 */
export interface MusicProvider {
  /** Nom technique du fournisseur (observabilité uniquement). */
  readonly name: string;
  /**
   * Résout une requête libre (ex. "Here Comes the Sun") en morceau.
   * Retourne `null` si rien n'est trouvé ; peut lever une erreur
   * en cas de panne du fournisseur.
   */
  findSong(query: string): Promise<Song | null>;
}
