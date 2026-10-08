import { describe, expect, it } from "vitest";

import { Container } from "../src/ioc/Container.js";
import { Tokens } from "../src/ioc/tokens.js";
import { buildContainer } from "../src/ioc/compositionRoot.js";
import { DayOfWeek } from "../src/domain/DayOfWeek.js";
import { NotificationChannel } from "../src/domain/NotificationChannel.js";
import { Weather } from "../src/domain/Weather.js";
import type { MusicProvider } from "../src/ports/MusicProvider.js";
import type { Notification } from "../src/domain/Notification.js";
import type { Notifier } from "../src/ports/Notifier.js";
import { NotificationService } from "../src/services/NotificationService.js";
import { ResilientMusicProvider } from "../src/adapters/music/ResilientMusicProvider.js";
import type { WakeUpService } from "../src/services/WakeUpService.js";

describe("Container IoC", () => {
  it("résout les dépendances en singleton", () => {
    const c = new Container();
    let built = 0;
    c.register(Tokens.EmailSdk, () => ({ id: ++built }));

    const a = c.resolve<{ id: number }>(Tokens.EmailSdk);
    const b = c.resolve<{ id: number }>(Tokens.EmailSdk);

    expect(a).toBe(b);
    expect(built).toBe(1);
  });

  it("lève une erreur explicite pour un token non enregistré", () => {
    const c = new Container();
    expect(() => c.resolve(Tokens.SmsSdk)).toThrow("Aucune dépendance");
  });
});

describe("Composition root", () => {
  it("fournit un graphe d'objets complet et fonctionnel", async () => {
    const sent: Notification[] = [];
    const fakeMusic: MusicProvider = {
      name: "fake",
      findSong: async () => ({ title: "X", artist: "Y" }),
    };
    const fakeNotifier: Notifier = {
      channel: NotificationChannel.EMAIL,
      send: async (n) => void sent.push(n),
    };

    // L'override montre qu'on peut changer de fournisseur/canal
    // sans toucher au code métier.
    const container = buildContainer((c) => {
      c.registerInstance(Tokens.MusicProvider, fakeMusic);
      c.register(
        Tokens.NotificationService,
        () => new NotificationService([fakeNotifier], { send: async () => {} }),
      );
    });

    const wakeUp = container.resolve<WakeUpService>(Tokens.WakeUpService);
    const report = await wakeUp.wakeUp("user-1", DayOfWeek.LUNDI, Weather.SOLEIL);

    expect(report.song).toEqual({ title: "X", artist: "Y" });
    expect(report.channelUsed).toBe(NotificationChannel.EMAIL);
    expect(sent).toHaveLength(1);
  });

  it("la chaîne de musique par défaut est résiliente (fallback local en bout)", () => {
    const container = buildContainer();
    const provider = container.resolve<ResilientMusicProvider>(Tokens.MusicProvider);
    expect(provider).toBeInstanceOf(ResilientMusicProvider);
  });
});
