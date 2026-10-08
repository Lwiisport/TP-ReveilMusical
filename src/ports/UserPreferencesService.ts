import type { UserPreferences } from "../domain/UserPreferences.js";

/**
 * Port vers le service interne de préférences utilisateur.
 * Comme les fournisseurs de musique, c'est une dépendance
 * interchangeable accédée via une interface.
 */
export interface UserPreferencesService {
  getPreferences(userId: string): Promise<UserPreferences>;
}
