/**
 * Levée quand aucun morceau n'a pu être produit : le fournisseur
 * de musique est en panne ou a renvoyé une réponse vide (null).
 * Une erreur explicite permet de distinguer une panne d'un simple
 * « rien trouvé », sans jamais tomber dans le silence.
 */
export class MusicProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MusicProviderError";
  }
}
