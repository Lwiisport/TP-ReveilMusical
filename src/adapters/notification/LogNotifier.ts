import type { Notification } from "../../domain/Notification.js";

/**
 * Notifier de dernier recours : journalise la notification au lieu
 * de l'envoyer et ne lève jamais d'erreur. Ce n'est volontairement
 * pas une stratégie de canal (pas de `channel`) : il n'est jamais
 * choisi directement, seulement invoqué quand tous les canaux ont
 * échoué — une panne ne doit jamais se traduire par un silence.
 */
export class LogNotifier {
  readonly journal: string[] = [];

  constructor(private readonly sink: (line: string) => void = console.warn) {}

  async send(notification: Notification): Promise<void> {
    const line =
      `[LOG-FALLBACK] notification non envoyée sur les canaux classiques | ` +
      `${notification.subject} | ${notification.body}`;
    this.journal.push(line);
    this.sink(line);
  }
}
