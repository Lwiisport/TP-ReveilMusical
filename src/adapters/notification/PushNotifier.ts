import { NotificationChannel } from "../../domain/NotificationChannel.js";
import type { Notification } from "../../domain/Notification.js";
import type { Notifier } from "../../ports/Notifier.js";
import type { PushSdk } from "./sdks/PushSdk.js";

/** Adapter : PushSdk -> port Notifier commun. */
export class PushNotifier implements Notifier {
  readonly channel = NotificationChannel.PUSH;

  constructor(private readonly sdk: PushSdk) {}

  async send(notification: Notification): Promise<void> {
    const deviceToken = notification.contact.deviceToken;
    if (!deviceToken) {
      throw new Error("Canal PUSH indisponible : device token manquant");
    }
    await this.sdk.push(deviceToken, notification.subject, {
      body: notification.body,
    });
  }
}
