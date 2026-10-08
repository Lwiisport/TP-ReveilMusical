import type { NotificationChannel } from "../domain/NotificationChannel.js";
import type { Notification } from "../domain/Notification.js";

/**
 * Port métier vers un canal de notification (Strategy).
 * Chaque implémentation adapte un SDK/canal concret derrière
 * cette interface commune ; une implémentation doit lever une
 * erreur si l'envoi échoue, afin que le service puisse basculer
 * sur un autre canal.
 */
export interface Notifier {
  readonly channel: NotificationChannel;
  send(notification: Notification): Promise<void>;
}
