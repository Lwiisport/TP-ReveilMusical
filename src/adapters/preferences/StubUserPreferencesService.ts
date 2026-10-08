import { DayOfWeek } from "../../domain/DayOfWeek.js";
import { NotificationChannel } from "../../domain/NotificationChannel.js";
import type { UserPreferences } from "../../domain/UserPreferences.js";
import { Weather } from "../../domain/Weather.js";
import type { UserPreferencesService } from "../../ports/UserPreferencesService.js";

const DEFAULTS: Record<string, UserPreferences> = {
  "user-1": {
    userId: "user-1",
    songsByDayAndWeather: {
      [DayOfWeek.LUNDI]: {
        [Weather.SOLEIL]: "Here Comes the Sun",
        [Weather.PLUIE]: "Singin' in the Rain",
      },
      [DayOfWeek.MARDI]: {
        [Weather.PLUIE]: "Rainy Day Women",
      },
      [DayOfWeek.SAMEDI]: {
        [Weather.NEIGE]: "Let It Snow",
      },
    },
    fallbackSong: "Lovely Day",
    preferredChannel: NotificationChannel.EMAIL,
    contact: { email: "user1@example.com", phoneNumber: "+33600000001" },
  },
  "user-2": {
    userId: "user-2",
    songsByDayAndWeather: {
      [DayOfWeek.MERCREDI]: {
        [Weather.SOLEIL]: "Sunny",
      },
      [DayOfWeek.JEUDI]: {
        [Weather.NUAGEUX]: "Both Sides Now",
      },
    },
    fallbackSong: "Good Morning",
    preferredChannel: NotificationChannel.SMS,
    contact: { phoneNumber: "+33600000002" },
  },
};

/**
 * Mock du service interne de préférences.
 * Comme les autres fournisseurs, il est accédé via une interface et
 * enregistré dans le container IoC : le vrai service pourra le
 * remplacer sans toucher au métier.
 */
export class StubUserPreferencesService implements UserPreferencesService {
  constructor(
    private readonly store: Record<string, UserPreferences> = DEFAULTS,
    private readonly defaultPreferences?: UserPreferences,
  ) {}

  async getPreferences(userId: string): Promise<UserPreferences> {
    const prefs = this.store[userId] ?? this.defaultPreferences;
    if (!prefs) {
      throw new Error(`Utilisateur inconnu : ${userId}`);
    }
    return prefs;
  }
}
