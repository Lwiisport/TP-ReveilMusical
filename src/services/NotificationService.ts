import { NotificationChannel } from "../domain/NotificationChannel.js";
import type { Notification } from "../domain/Notification.js";
import type { Notifier } from "../ports/Notifier.js";

interface LastResort {
  send(notification: Notification): Promise<void>;
}

export interface NotificationResult {
  /** Canal effectivement utilisé, ou "LOG" si tous ont échoué. */
  channelUsed: NotificationChannel | "LOG";
  /** Vrai si le canal préféré n'a pas pu être utilisé. */
  degraded: boolean;
}

const ALL_CHANNELS = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
] as const;

/**
 * Strategy : sélectionne le notifier adapté au canal préféré de
 * l'utilisateur, puis bascule sur les autres canaux en cas d'échec.
 * Une panne de canal ne doit jamais empêcher l'envoi : en dernier
 * recours, la notification est journalisée.
 */
export class NotificationService {
  private readonly strategies = new Map<NotificationChannel, Notifier>();

  constructor(notifiers: readonly Notifier[], private readonly lastResort: LastResort) {
    for (const notifier of notifiers) {
      this.strategies.set(notifier.channel, notifier);
    }
  }

  async notify(
    notification: Notification,
    preferredChannel: NotificationChannel,
  ): Promise<NotificationResult> {
    const order = [
      preferredChannel,
      ...ALL_CHANNELS.filter((c) => c !== preferredChannel),
    ];

    for (const channel of order) {
      const notifier = this.strategies.get(channel);
      if (!notifier) continue;
      try {
        await notifier.send(notification);
        return { channelUsed: channel, degraded: channel !== preferredChannel };
      } catch {
        // Canal en panne ou coordonnées manquantes : on tente le suivant.
      }
    }

    await this.lastResort.send(notification);
    return { channelUsed: "LOG", degraded: true };
  }
}
