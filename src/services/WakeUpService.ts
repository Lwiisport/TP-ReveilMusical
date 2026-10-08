import type { DayOfWeek } from "../domain/DayOfWeek.js";
import { MusicProviderError } from "../domain/errors.js";
import type { WakeUpReport } from "../domain/WakeUpReport.js";
import type { Weather } from "../domain/Weather.js";
import type { MusicProvider } from "../ports/MusicProvider.js";
import type { NotificationService } from "./NotificationService.js";
import type { UserPreferencesService } from "../ports/UserPreferencesService.js";

interface NamedMusicProvider extends MusicProvider {
  readonly lastProviderName?: string | null;
}

/**
 * Point d'entrée du TP : déclenche le réveil d'un utilisateur.
 * Toutes les dépendances arrivent par le constructeur sous forme
 * d'interfaces (IoC/DI) : aucun `new`, aucun détail technique de
 * fournisseur ou de canal ne transparaît ici.
 */
export class WakeUpService {
  constructor(
    private readonly preferences: UserPreferencesService,
    private readonly music: NamedMusicProvider,
    private readonly notifications: NotificationService,
  ) {}

  async wakeUp(
    userId: string,
    day: DayOfWeek,
    weather: Weather,
  ): Promise<WakeUpReport> {
    const prefs = await this.preferences.getPreferences(userId);
    // Le choix du morceau dépend de la combinaison jour × météo ;
    // le morceau de secours couvre les combinaisons non configurées.
    const requestedSong =
      prefs.songsByDayAndWeather[day]?.[weather] ?? prefs.fallbackSong;

    // Un `null` du fournisseur signifie qu'aucun morceau n'a pu être
    // produit : c'est une panne, pas une absence de résultat — on lève
    // une exception explicite plutôt que de fabriquer un faux morceau.
    const song = await this.music.findSong(requestedSong);
    if (!song) {
      throw new MusicProviderError(
        `Le fournisseur « ${this.music.name} » n'a retourné aucun morceau pour « ${requestedSong} »`,
      );
    }

    const subject = `Réveil musical — ${day}`;
    const body = `Bonjour ! Il est l'heure de se lever. ` +
      `Votre morceau du jour : « ${song.title} » de ${song.artist}.`;

    const result = await this.notifications.notify(
      { contact: prefs.contact, subject, body },
      prefs.preferredChannel,
    );

    return {
      userId,
      day,
      weather,
      requestedSong,
      song,
      musicSource: this.music.lastProviderName ?? this.music.name,
      channelUsed: result.channelUsed,
      degraded: result.degraded,
    };
  }
}
