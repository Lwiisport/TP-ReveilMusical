import { describe, expect, it, vi } from "vitest";

import { DayOfWeek } from "../src/domain/DayOfWeek.js";
import { MusicProviderError } from "../src/domain/errors.js";
import { NotificationChannel } from "../src/domain/NotificationChannel.js";
import { Weather } from "../src/domain/Weather.js";
import type { UserPreferences } from "../src/domain/UserPreferences.js";
import type { Notification } from "../src/domain/Notification.js";
import type { Song } from "../src/domain/Song.js";
import type { MusicProvider } from "../src/ports/MusicProvider.js";
import type { Notifier } from "../src/ports/Notifier.js";
import type { UserPreferencesService } from "../src/ports/UserPreferencesService.js";
import { NotificationService } from "../src/services/NotificationService.js";
import { WakeUpService } from "../src/services/WakeUpService.js";
import { LogNotifier } from "../src/adapters/notification/LogNotifier.js";

const prefs: UserPreferences = {
  userId: "u1",
  songsByDayAndWeather: {
    [DayOfWeek.LUNDI]: { [Weather.SOLEIL]: "Here Comes the Sun" },
  },
  fallbackSong: "Lovely Day",
  preferredChannel: NotificationChannel.EMAIL,
  contact: { email: "u1@example.com" },
};

function prefsService(p: UserPreferences = prefs): UserPreferencesService {
  return { getPreferences: async () => p };
}

function music(
  song: Song | null = { title: "Here Comes the Sun", artist: "The Beatles" },
): MusicProvider {
  return { name: "stub", findSong: async () => song };
}

function recordingNotifier(channel: NotificationChannel, fail = false) {
  const calls: Notification[] = [];
  const notifier: Notifier = {
    channel,
    async send(n) {
      if (fail) throw new Error("panne");
      calls.push(n);
    },
  };
  return { notifier, calls };
}

describe("WakeUpService", () => {
  it("réveille avec le morceau du couple jour×météo et notifie sur le canal préféré", async () => {
    const { notifier, calls } = recordingNotifier(NotificationChannel.EMAIL);
    const service = new WakeUpService(
      prefsService(),
      music(),
      new NotificationService([notifier], new LogNotifier()),
    );

    const report = await service.wakeUp("u1", DayOfWeek.LUNDI, Weather.SOLEIL);

    expect(report.song).toEqual({ title: "Here Comes the Sun", artist: "The Beatles" });
    expect(report.requestedSong).toBe("Here Comes the Sun");
    expect(report.channelUsed).toBe(NotificationChannel.EMAIL);
    expect(report.degraded).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.contact.email).toBe("u1@example.com");
    expect(calls[0]!.body).toContain("Here Comes the Sun");
    expect(calls[0]!.subject).toContain("LUNDI");
  });

  it("utilise le morceau de secours quand la combinaison jour×météo n'est pas couverte", async () => {
    const findSong = vi.fn(async () => ({ title: "Lovely Day", artist: "Bill Withers" }));
    const provider: MusicProvider = { name: "stub", findSong };
    const { notifier } = recordingNotifier(NotificationChannel.EMAIL);
    const service = new WakeUpService(
      prefsService(),
      provider,
      new NotificationService([notifier], new LogNotifier()),
    );

    // Même météo SOLEIL mais autre jour → combinaison non couverte.
    const report = await service.wakeUp("u1", DayOfWeek.MARDI, Weather.SOLEIL);
    expect(findSong).toHaveBeenCalledWith("Lovely Day");
    expect(report.requestedSong).toBe("Lovely Day");

    // Autre météo le même jour → combinaison non couverte.
    const report2 = await service.wakeUp("u1", DayOfWeek.LUNDI, Weather.NEIGE);
    expect(report2.requestedSong).toBe("Lovely Day");
  });

  it("distingue deux jours différents pour la même météo", async () => {
    const multiDay: UserPreferences = {
      ...prefs,
      songsByDayAndWeather: {
        [DayOfWeek.LUNDI]: { [Weather.PLUIE]: "Rainy Monday" },
        [DayOfWeek.VENDREDI]: { [Weather.PLUIE]: "Rainy Friday" },
      },
    };
    const findSong = vi.fn(async (q: string) => ({ title: q, artist: "A" }));
    const service = new WakeUpService(
      prefsService(multiDay),
      { name: "stub", findSong },
      new NotificationService(
        [recordingNotifier(NotificationChannel.EMAIL).notifier],
        new LogNotifier(),
      ),
    );

    await service.wakeUp("u1", DayOfWeek.LUNDI, Weather.PLUIE);
    await service.wakeUp("u1", DayOfWeek.VENDREDI, Weather.PLUIE);
    expect(findSong).toHaveBeenNthCalledWith(1, "Rainy Monday");
    expect(findSong).toHaveBeenNthCalledWith(2, "Rainy Friday");
  });

  it("lève MusicProviderError si le fournisseur renvoie null (panne)", async () => {
    const service = new WakeUpService(
      prefsService(),
      music(null),
      new NotificationService([], new LogNotifier()),
    );

    await expect(
      service.wakeUp("u1", DayOfWeek.LUNDI, Weather.SOLEIL),
    ).rejects.toThrow(MusicProviderError);
  });

  it("propage l'erreur si le fournisseur lui-même lève une exception", async () => {
    const service = new WakeUpService(
      prefsService(),
      {
        name: "down",
        findSong: async () => {
          throw new MusicProviderError("fournisseur injoignable");
        },
      },
      new NotificationService([], new LogNotifier()),
    );

    await expect(
      service.wakeUp("u1", DayOfWeek.LUNDI, Weather.SOLEIL),
    ).rejects.toThrow("injoignable");
  });

  it("notifie sur un canal de repli si le préféré tombe (pas de silence)", async () => {
    const email = recordingNotifier(NotificationChannel.EMAIL, true);
    const sms = recordingNotifier(NotificationChannel.SMS);
    const service = new WakeUpService(
      prefsService(),
      music(),
      new NotificationService([email.notifier, sms.notifier], new LogNotifier()),
    );

    const report = await service.wakeUp("u1", DayOfWeek.LUNDI, Weather.SOLEIL);

    expect(report.channelUsed).toBe(NotificationChannel.SMS);
    expect(report.degraded).toBe(true);
    expect(sms.calls).toHaveLength(1);
  });

  it("journalise si tous les canaux tombent (dernier recours)", async () => {
    const sink = vi.fn();
    const service = new WakeUpService(
      prefsService(),
      music(),
      new NotificationService(
        [recordingNotifier(NotificationChannel.EMAIL, true).notifier],
        new LogNotifier(sink),
      ),
    );

    const report = await service.wakeUp("u1", DayOfWeek.LUNDI, Weather.SOLEIL);

    expect(report.channelUsed).toBe("LOG");
    expect(report.degraded).toBe(true);
    expect(sink).toHaveBeenCalled();
  });

  it("propage l'erreur si l'utilisateur est inconnu", async () => {
    const service = new WakeUpService(
      { getPreferences: async () => Promise.reject(new Error("inconnu")) },
      music(),
      new NotificationService([], new LogNotifier()),
    );

    await expect(service.wakeUp("?", DayOfWeek.LUNDI, Weather.SOLEIL)).rejects.toThrow("inconnu");
  });
});
