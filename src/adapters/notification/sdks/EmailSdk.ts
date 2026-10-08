/**
 * Mock d'un SDK d'envoi d'emails.
 * Interface volontairement spécifique : retourne un booléen de
 * succès au lieu de lever une erreur. Aucun envoi réel : les
 * messages partent dans un « outbox » observable (console incluse).
 */
export class EmailSdk {
  readonly outbox: Array<{ to: string; subject: string; body: string }> = [];

  constructor(private readonly options: { alwaysFail?: boolean } = {}) {}

  async sendMail(to: string, subject: string, body: string): Promise<boolean> {
    if (this.options.alwaysFail) return false;
    this.outbox.push({ to, subject, body });
    console.log(`[EMAIL] -> ${to} | ${subject} | ${body}`);
    return true;
  }
}
