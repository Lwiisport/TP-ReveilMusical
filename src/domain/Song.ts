/**
 * Morceau tel que le métier le connaît.
 * Volontairement agnostique : aucun champ propre à un fournisseur
 * (ex. `trackViewUrl` d'iTunes) ne doit apparaître ici.
 */
export interface Song {
  title: string;
  artist: string;
}
