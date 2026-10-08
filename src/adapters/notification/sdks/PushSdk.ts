/**
 * Mock d'un SDK de notifications push.
 * Troisième style d'interface : un payload structuré, un identifiant
 * retourné en cas de succès, et une exception en cas d'échec.
 */
export class PushSdk {
  readonly pushed: Array<{
    deviceToken: string;
    title: string;
    payload: Record<string, unknown>;
  }> = [];

  constructor(private readonly options: { alwaysFail?: boolean } = {}) {}

  async push(
    deviceToken: string,
    title: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    if (this.options.alwaysFail) {
      throw new Error("PushSdk: envoi refusé par la passerelle");
    }
    this.pushed.push({ deviceToken, title, payload });
    console.log(`[PUSH] -> ${deviceToken} | ${title} | ${JSON.stringify(payload)}`);
    return `push-${this.pushed.length}`;
  }
}
