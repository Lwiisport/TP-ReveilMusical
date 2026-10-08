import { describe, expect, it, vi } from "vitest";

import { DayOfWeek } from "../src/domain/DayOfWeek.js";
import { NotificationChannel } from "../src/domain/NotificationChannel.js";
import { Weather } from "../src/domain/Weather.js";
import type { UserPreferences } from "../src/domain/UserPreferences.js";
import type { Notification } from "../src/domain/Notification.js";
import type { MusicProvider } from "../src/ports/MusicProvider.js";
import type { Notifier } from "../src/ports/Notifier.js";
import type { UserPreferencesService } from "../src/ports/UserPreferencesService.js";
import { NotificationService } from "../src/services/NotificationService.js";
import { WakeUpService } from "../src/services/WakeUpService.js";
import { LogNotifier } from "../src/adapters/notification/LogNotifier.js";

const prefs: UserPreferences = {
  userId: "u1",
  songsByWeather: { [Weather.SOLEIL]: "Here Comes the Sun" },
  fallbackSong: "Lovely Day",
  preferredChannel: NotificationChannel.EMAIL,
  contact: { email: "u1@example.com" },
};

function prefsService(p: UserPreferences = prefs): UserPreferencesService {
  return { getPreferences: async () => p };
}

function music(song = { title: "Here Comes the Sun", artist: "The Beatles" }): MusicProvider {
  return { name: "stub", lastProviderName: "stub", findSong: async () => song } as MusicProvider;
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
  it("réveille avec le morceau de la météo et notifie sur le canal préféré", async () => {
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

  it("utilise le morceau de secours pour une météo non couverte", async () => {
    const findSong = vi.fn(async () => ({ title: "Lovely Day", artist: "Bill Withers" }));
    const provider: MusicProvider = { name: "stub", findSong };
    const { notifier } = recordingNotifier(NotificationChannel.EMAIL);
    const service = new WakeUpService(
      prefsService(),
      provider,
      new NotificationService([notifier], new LogNotifier()),
    );

    const report = await service.wakeUp("u1", DayOfWeek.MARDI, Weather.NEIGE);

    expect(findSong).toHaveBeenCalledWith("Lovely Day");
    expect(report.requestedSong).toBe("Lovely Day");
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
