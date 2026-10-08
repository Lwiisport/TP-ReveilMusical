/**
 * Coordonnées de l'utilisateur, tous canaux confondus.
 * Chaque adaptateur de notification n'exploite que le champ
 * dont son canal a besoin.
 */
export interface ContactInfo {
  email?: string;
  phoneNumber?: string;
  deviceToken?: string;
}
