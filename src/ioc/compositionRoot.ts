import { Container } from "./Container.js";
import { Tokens } from "./tokens.js";

import { ITunesMusicProvider } from "../adapters/music/ITunesMusicProvider.js";
import { MusicBrainzMusicProvider } from "../adapters/music/MusicBrainzMusicProvider.js";
import { LocalFallbackMusicProvider } from "../adapters/music/LocalFallbackMusicProvider.js";
import { CachedMusicProvider } from "../adapters/music/CachedMusicProvider.js";
import { ResilientMusicProvider } from "../adapters/music/ResilientMusicProvider.js";

import { EmailSdk } from "../adapters/notification/sdks/EmailSdk.js";
import { SmsSdk } from "../adapters/notification/sdks/SmsSdk.js";
import { PushSdk } from "../adapters/notification/sdks/PushSdk.js";
import { EmailNotifier } from "../adapters/notification/EmailNotifier.js";
import { SmsNotifier } from "../adapters/notification/SmsNotifier.js";
import { PushNotifier } from "../adapters/notification/PushNotifier.js";
import { LogNotifier } from "../adapters/notification/LogNotifier.js";

import { StubUserPreferencesService } from "../adapters/preferences/StubUserPreferencesService.js";

import { NotificationService } from "../services/NotificationService.js";
import { WakeUpService } from "../services/WakeUpService.js";

import type { MusicProvider } from "../ports/MusicProvider.js";
import type { Notifier } from "../ports/Notifier.js";
import type { UserPreferencesService } from "../ports/UserPreferencesService.js";

/**
 * Composition root : SEUL endroit du projet où des implémentations
 * concrètes sont instanciées (`new`). Changer de fournisseur de
 * musique ou ajouter un canal de notification se fait ici, sans
 * toucher au code métier.
 */
export function buildContainer(overrides?: (c: Container) => void): Container {
  const c = new Container();

  // --- Infrastructure ---
  c.registerInstance(Tokens.Fetch, fetch);

  // --- Préférences utilisateur (service interne mocké) ---
  c.register<UserPreferencesService>(
    Tokens.UserPreferencesService,
    () => new StubUserPreferencesService(),
  );

  // --- Fournisseurs de musique (adapters) ---
  c.register<MusicProvider>(
    Tokens.ITunesMusicProvider,
    (cc) => new ITunesMusicProvider(cc.resolve<typeof fetch>(Tokens.Fetch)),
  );
  c.register<MusicProvider>(
    Tokens.MusicBrainzMusicProvider,
    (cc) => new MusicBrainzMusicProvider(cc.resolve<typeof fetch>(Tokens.Fetch)),
  );
  c.register<MusicProvider>(
    Tokens.LocalFallbackMusicProvider,
    () => new LocalFallbackMusicProvider(),
  );

  // Port métier : chaîne résiliente = cache(iTunes) -> MusicBrainz -> local.
  // Pour changer de fournisseur principal, on modifie uniquement cette ligne.
  c.register<MusicProvider>(
    Tokens.MusicProvider,
    (cc) =>
      new ResilientMusicProvider([
        new CachedMusicProvider(cc.resolve<MusicProvider>(Tokens.ITunesMusicProvider)),
        cc.resolve<MusicProvider>(Tokens.MusicBrainzMusicProvider),
        cc.resolve<MusicProvider>(Tokens.LocalFallbackMusicProvider),
      ]),
  );

  // --- SDKs de notification (mocks, interfaces volontairement différentes) ---
  c.register(Tokens.EmailSdk, () => new EmailSdk());
  c.register(Tokens.SmsSdk, () => new SmsSdk());
  c.register(Tokens.PushSdk, () => new PushSdk());

  // --- Stratégies de notification (adapters vers le port commun) ---
  c.register<Notifier[]>(Tokens.Notifiers, (cc) => [
    new EmailNotifier(cc.resolve<EmailSdk>(Tokens.EmailSdk)),
    new SmsNotifier(cc.resolve<SmsSdk>(Tokens.SmsSdk)),
    new PushNotifier(cc.resolve<PushSdk>(Tokens.PushSdk)),
  ]);
  c.register(Tokens.LogNotifier, () => new LogNotifier());

  c.register(
    Tokens.NotificationService,
    (cc) =>
      new NotificationService(
        cc.resolve<Notifier[]>(Tokens.Notifiers),
        cc.resolve<LogNotifier>(Tokens.LogNotifier),
      ),
  );

  // --- Point d'entrée métier ---
  c.register(
    Tokens.WakeUpService,
    (cc) =>
      new WakeUpService(
        cc.resolve<UserPreferencesService>(Tokens.UserPreferencesService),
        cc.resolve<ResilientMusicProvider>(Tokens.MusicProvider),
        cc.resolve<NotificationService>(Tokens.NotificationService),
      ),
  );

  overrides?.(c);
  return c;
}
