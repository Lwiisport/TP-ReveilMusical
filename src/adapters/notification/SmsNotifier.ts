import { NotificationChannel } from "../../domain/NotificationChannel.js";
import type { Notification } from "../../domain/Notification.js";
import type { Notifier } from "../../ports/Notifier.js";
import type { SmsSdk } from "./sdks/SmsSdk.js";

/** Adapter : SmsSdk -> port Notifier commun. */
export class SmsNotifier implements Notifier {
  readonly channel = NotificationChannel.SMS;

  constructor(private readonly sdk: SmsSdk) {}

  async send(notification: Notification): Promise<void> {
    const msisdn = notification.contact.phoneNumber;
    if (!msisdn) {
      throw new Error("Canal SMS indisponible : numéro de téléphone manquant");
    }
    const text = `${notification.subject} — ${notification.body}`;
    const result = await this.sdk.sendText(msisdn, text);
    if (result.status !== "SENT") {
      throw new Error("SmsSdk a retourné un statut FAILED");
    }
  }
}
