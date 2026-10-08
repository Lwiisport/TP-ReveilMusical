import { NotificationChannel } from "../../domain/NotificationChannel.js";
import type { Notification } from "../../domain/Notification.js";
import type { Notifier } from "../../ports/Notifier.js";
import type { EmailSdk } from "./sdks/EmailSdk.js";

/** Adapter : EmailSdk -> port Notifier commun. */
export class EmailNotifier implements Notifier {
  readonly channel = NotificationChannel.EMAIL;

  constructor(private readonly sdk: EmailSdk) {}

  async send(notification: Notification): Promise<void> {
    const to = notification.contact.email;
    if (!to) {
      throw new Error("Canal EMAIL indisponible : adresse email manquante");
    }
    const ok = await this.sdk.sendMail(to, notification.subject, notification.body);
    if (!ok) {
      throw new Error("EmailSdk a retourné un échec d'envoi");
    }
  }
}
