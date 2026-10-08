/** Tokens du container IoC : un symbole par abstraction enregistrée. */
export const Tokens = {
  Fetch: Symbol("Fetch"),
  UserPreferencesService: Symbol("UserPreferencesService"),

  ITunesMusicProvider: Symbol("ITunesMusicProvider"),
  MusicBrainzMusicProvider: Symbol("MusicBrainzMusicProvider"),
  LocalFallbackMusicProvider: Symbol("LocalFallbackMusicProvider"),
  /** Port métier : la chaîne résiliente complète (cache -> iTunes -> MusicBrainz -> local). */
  MusicProvider: Symbol("MusicProvider"),

  EmailSdk: Symbol("EmailSdk"),
  SmsSdk: Symbol("SmsSdk"),
  PushSdk: Symbol("PushSdk"),
  Notifiers: Symbol("Notifiers"),
  LogNotifier: Symbol("LogNotifier"),
  NotificationService: Symbol("NotificationService"),

  WakeUpService: Symbol("WakeUpService"),
} as const;
