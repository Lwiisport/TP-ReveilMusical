/**
 * Mock d'un SDK SMS.
 * Interface volontairement différente de l'email : un objet
 * `SmsStatus` est retourné plutôt qu'un booléen.
 */
export interface SmsStatus {
  status: "SENT" | "FAILED";
  messageId?: string;
}

export class SmsSdk {
  readonly sentMessages: Array<{ msisdn: string; text: string }> = [];

  constructor(private readonly options: { alwaysFail?: boolean } = {}) {}

  async sendText(msisdn: string, text: string): Promise<SmsStatus> {
    if (this.options.alwaysFail) return { status: "FAILED" };
    this.sentMessages.push({ msisdn, text });
    const messageId = `sms-${this.sentMessages.length}`;
    console.log(`[SMS] -> ${msisdn} | ${text} (${messageId})`);
    return { status: "SENT", messageId };
  }
}
