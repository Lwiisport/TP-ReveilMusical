import { describe, expect, it } from "vitest";

import { NotificationService } from "../src/services/NotificationService.js";
import { LogNotifier } from "../src/adapters/notification/LogNotifier.js";
import { NotificationChannel } from "../src/domain/NotificationChannel.js";
import type { Notification } from "../src/domain/Notification.js";
import type { Notifier } from "../src/ports/Notifier.js";

function notifier(channel: NotificationChannel, fail: boolean): Notifier & { sent: number } {
  const n = {
    channel,
    sent: 0,
    async send(_notification: Notification) {
      n.sent += 1;
      if (fail) throw new Error(`${channel} en panne`);
    },
  };
  return n as Notifier & { sent: number };
}

const notification: Notification = {
  contact: { email: "a@b.c" },
  subject: "S",
  body: "B",
};

describe("NotificationService (strategy + fallback)", () => {
  it("utilise le canal préféré quand il fonctionne", async () => {
    const email = notifier(NotificationChannel.EMAIL, false);
    const sms = notifier(NotificationChannel.SMS, false);
    const service = new NotificationService([email, sms], new LogNotifier());

    const result = await service.notify(notification, NotificationChannel.EMAIL);

    expect(result).toEqual({ channelUsed: NotificationChannel.EMAIL, degraded: false });
    expect(email.sent).toBe(1);
    expect(sms.sent).toBe(0);
  });

  it("bascule sur un autre canal si le préféré échoue (mode dégradé)", async () => {
    const email = notifier(NotificationChannel.EMAIL, true);
    const sms = notifier(NotificationChannel.SMS, false);
    const service = new NotificationService([email, sms], new LogNotifier());

    const result = await service.notify(notification, NotificationChannel.EMAIL);

    expect(result).toEqual({ channelUsed: NotificationChannel.SMS, degraded: true });
  });

  it("journalise en dernier recours si tous les canaux échouent", async () => {
    const log = new LogNotifier();
    const service = new NotificationService(
      [
        notifier(NotificationChannel.EMAIL, true),
        notifier(NotificationChannel.SMS, true),
        notifier(NotificationChannel.PUSH, true),
      ],
      log,
    );

    const result = await service.notify(notification, NotificationChannel.PUSH);

    expect(result).toEqual({ channelUsed: "LOG", degraded: true });
    expect(log.journal).toHaveLength(1);
  });

  it("ignore les canaux sans stratégie enregistrée", async () => {
    const push = notifier(NotificationChannel.PUSH, false);
    const service = new NotificationService([push], new LogNotifier());

    const result = await service.notify(notification, NotificationChannel.SMS);

    expect(result.channelUsed).toBe(NotificationChannel.PUSH);
    expect(result.degraded).toBe(true);
  });
});
