import { describe, expect, it, vi } from "vitest";

import { EmailSdk } from "../src/adapters/notification/sdks/EmailSdk.js";
import { SmsSdk } from "../src/adapters/notification/sdks/SmsSdk.js";
import { PushSdk } from "../src/adapters/notification/sdks/PushSdk.js";
import { EmailNotifier } from "../src/adapters/notification/EmailNotifier.js";
import { SmsNotifier } from "../src/adapters/notification/SmsNotifier.js";
import { PushNotifier } from "../src/adapters/notification/PushNotifier.js";
import { LogNotifier } from "../src/adapters/notification/LogNotifier.js";
import { NotificationChannel } from "../src/domain/NotificationChannel.js";
import type { Notification } from "../src/domain/Notification.js";

function makeNotification(contact: Notification["contact"]): Notification {
  return { contact, subject: "Réveil", body: "Debout !" };
}

describe("EmailNotifier", () => {
  it("envoie via le SDK email avec l'adresse du contact", async () => {
    const sdk = new EmailSdk();
    const notifier = new EmailNotifier(sdk);
    await notifier.send(makeNotification({ email: "a@b.c" }));

    expect(sdk.outbox).toEqual([
      { to: "a@b.c", subject: "Réveil", body: "Debout !" },
    ]);
    expect(notifier.channel).toBe(NotificationChannel.EMAIL);
  });

  it("lève une erreur si le SDK renvoie false", async () => {
    const notifier = new EmailNotifier(new EmailSdk({ alwaysFail: true }));
    await expect(
      notifier.send(makeNotification({ email: "a@b.c" })),
    ).rejects.toThrow();
  });

  it("lève une erreur si le contact n'a pas d'email", async () => {
    const notifier = new EmailNotifier(new EmailSdk());
    await expect(notifier.send(makeNotification({}))).rejects.toThrow("email");
  });
});

describe("SmsNotifier", () => {
  it("envoie un texte via le SDK SMS", async () => {
    const sdk = new SmsSdk();
    const notifier = new SmsNotifier(sdk);
    await notifier.send(makeNotification({ phoneNumber: "+33601020304" }));

    expect(sdk.sentMessages).toHaveLength(1);
    expect(sdk.sentMessages[0]!.msisdn).toBe("+33601020304");
    expect(sdk.sentMessages[0]!.text).toContain("Debout !");
  });

  it("lève une erreur sur statut FAILED", async () => {
    const notifier = new SmsNotifier(new SmsSdk({ alwaysFail: true }));
    await expect(
      notifier.send(makeNotification({ phoneNumber: "+336" })),
    ).rejects.toThrow();
  });

  it("lève une erreur si le contact n'a pas de numéro", async () => {
    const notifier = new SmsNotifier(new SmsSdk());
    await expect(notifier.send(makeNotification({}))).rejects.toThrow();
  });
});

describe("PushNotifier", () => {
  it("pousse une notification via le device token", async () => {
    const sdk = new PushSdk();
    const notifier = new PushNotifier(sdk);
    await notifier.send(makeNotification({ deviceToken: "tok-123" }));

    expect(sdk.pushed).toHaveLength(1);
    expect(sdk.pushed[0]!.deviceToken).toBe("tok-123");
    expect(sdk.pushed[0]!.title).toBe("Réveil");
  });

  it("propage l'erreur du SDK", async () => {
    const notifier = new PushNotifier(new PushSdk({ alwaysFail: true }));
    await expect(
      notifier.send(makeNotification({ deviceToken: "t" })),
    ).rejects.toThrow();
  });

  it("lève une erreur si le contact n'a pas de device token", async () => {
    const notifier = new PushNotifier(new PushSdk());
    await expect(notifier.send(makeNotification({}))).rejects.toThrow();
  });
});

describe("LogNotifier (dernier recours)", () => {
  it("journalise la notification sans jamais lever d'erreur", async () => {
    const sink = vi.fn();
    const log = new LogNotifier(sink);
    await log.send(makeNotification({}));

    expect(sink).toHaveBeenCalledOnce();
    expect(log.journal[0]).toContain("Réveil");
  });
});
