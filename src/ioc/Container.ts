type Factory<T> = (container: Container) => T;

/**
 * Container IoC minimaliste : chaque dépendance est enregistrée
 * sous un token via une factory, et résolue en singleton.
 * Les classes métier ne connaissent que les interfaces qu'elles
 * reçoivent par leur constructeur — aucun `new` hors de la
 * composition root.
 */
export class Container {
  private readonly factories = new Map<symbol, Factory<unknown>>();
  private readonly instances = new Map<symbol, unknown>();

  register<T>(token: symbol, factory: Factory<T>): this {
    this.factories.set(token, factory as Factory<unknown>);
    this.instances.delete(token);
    return this;
  }

  registerInstance<T>(token: symbol, instance: T): this {
    this.factories.set(token, () => instance);
    this.instances.set(token, instance);
    return this;
  }

  resolve<T>(token: symbol): T {
    if (!this.instances.has(token)) {
      const factory = this.factories.get(token);
      if (!factory) {
        throw new Error(`Aucune dépendance enregistrée pour ${String(token)}`);
      }
      this.instances.set(token, factory(this));
    }
    return this.instances.get(token) as T;
  }
}
