import type { DayOfWeek } from "./DayOfWeek.js";
import type { NotificationChannel } from "./NotificationChannel.js";
import type { Song } from "./Song.js";
import type { Weather } from "./Weather.js";

/** Résultat d'un déclenchement de réveil, pour observabilité et tests. */
export interface WakeUpReport {
  userId: string;
  day: DayOfWeek;
  weather: Weather;
  /** Requête morceau issue des préférences (avant résolution fournisseur). */
  requestedSong: string;
  /** Morceau effectivement retenu. */
  song: Song;
  /** Fournisseur qui a fourni le morceau. */
  musicSource: string;
  /** Canal effectivement utilisé. */
  channelUsed: NotificationChannel | "LOG";
  /** Vrai si le canal préféré n'a pas pu être utilisé. */
  degraded: boolean;
}
