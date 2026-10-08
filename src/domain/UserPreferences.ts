import type { ContactInfo } from "./ContactInfo.js";
import type { NotificationChannel } from "./NotificationChannel.js";
import type { Weather } from "./Weather.js";

/**
 * Préférences de réveil d'un utilisateur, telles que les retourne
 * le service interne de préférences.
 */
export interface UserPreferences {
  userId: string;
  /** Morceau choisi par l'utilisateur pour chaque type de météo. */
  songsByWeather: Partial<Record<Weather, string>>;
  /** Morceau de secours pour les cas non couverts. */
  fallbackSong: string;
  preferredChannel: NotificationChannel;
  contact: ContactInfo;
}
