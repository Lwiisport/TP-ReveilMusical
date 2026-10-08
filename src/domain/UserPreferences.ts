import type { ContactInfo } from "./ContactInfo.js";
import type { DayOfWeek } from "./DayOfWeek.js";
import type { NotificationChannel } from "./NotificationChannel.js";
import type { Weather } from "./Weather.js";

/**
 * Préférences de réveil d'un utilisateur, telles que les retourne
 * le service interne de préférences.
 */
export interface UserPreferences {
  userId: string;
  /**
   * Morceau choisi par l'utilisateur pour chaque combinaison
   * jour de la semaine × météo. Le jour seul ou la météo seule ne
   * suffisent pas : c'est la combinaison des deux qui détermine
   * le morceau.
   */
  songsByDayAndWeather: Partial<
    Record<DayOfWeek, Partial<Record<Weather, string>>>
  >;
  /** Morceau de secours pour les combinaisons non couvertes. */
  fallbackSong: string;
  preferredChannel: NotificationChannel;
  contact: ContactInfo;
}
