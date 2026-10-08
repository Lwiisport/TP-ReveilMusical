import { describe, expect, it, vi, type Mock } from "vitest";

import { ITunesMusicProvider } from "../src/adapters/music/ITunesMusicProvider.js";
import { MusicBrainzMusicProvider } from "../src/adapters/music/MusicBrainzMusicProvider.js";
import { LocalFallbackMusicProvider } from "../src/adapters/music/LocalFallbackMusicProvider.js";
import { CachedMusicProvider } from "../src/adapters/music/CachedMusicProvider.js";
import { ResilientMusicProvider } from "../src/adapters/music/ResilientMusicProvider.js";
import type { Song } from "../src/domain/Song.js";
import type { MusicProvider } from "../src/ports/MusicProvider.js";

function fakeFetch(body: unknown, status = 200): Mock {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

function failingFetch(): Mock {
  return vi.fn(async () => {
    throw new Error("réseau injoignable");
  });
}

function stubProvider(
  name: string,
  result: Song | null | Error,
): MusicProvider & { calls: number } {
  const provider = {
    name,
    calls: 0,
    async findSong(_query: string): Promise<Song | null> {
      provider.calls += 1;
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return provider;
}

const asFetch = (m: Mock) => m as unknown as typeof fetch;

describe("ITunesMusicProvider", () => {
  it("mappe le premier résultat vers le modèle métier", async () => {
    const http = fakeFetch({
      results: [
        {
          trackName: "Here Comes the Sun",
          artistName: "The Beatles",
          trackViewUrl: "https://music.apple.com/xxxx",
        },
      ],
    });
    const provider = new ITunesMusicProvider(asFetch(http));
    const song = await provider.findSong("here comes the sun");

    expect(song).toEqual({ title: "Here Comes the Sun", artist: "The Beatles" });
    // Le champ propre à iTunes ne doit pas fuiter dans le métier.
    expect(song).not.toHaveProperty("trackViewUrl");
  });

  it("encode la requête dans l'URL", async () => {
    const http = fakeFetch({ results: [] });
    const provider = new ITunesMusicProvider(asFetch(http));
    await provider.findSong("Singin' in the Rain");

    const url = http.mock.calls[0]![0] as string;
    expect(url).toContain("term=Singin'%20in%20the%20Rain");
    expect(url).toContain("media=music");
  });

  it("retourne null quand aucun résultat", async () => {
    const provider = new ITunesMusicProvider(asFetch(fakeFetch({ results: [] })));
    expect(await provider.findSong("zzz")).toBeNull();
  });

  it("lève une erreur sur réponse HTTP non-2xx", async () => {
    const provider = new ITunesMusicProvider(asFetch(fakeFetch({}, 503)));
    await expect(provider.findSong("x")).rejects.toThrow("503");
  });

  it("propage l'erreur réseau", async () => {
    const provider = new ITunesMusicProvider(asFetch(failingFetch()));
    await expect(provider.findSong("x")).rejects.toThrow("injoignable");
  });
});

describe("MusicBrainzMusicProvider", () => {
  const body = {
    recordings: [
      { title: "Let It Snow!", "artist-credit": [{ name: "Dean Martin" }] },
    ],
  };

  it("envoie un User-Agent identifiable (exigé par MusicBrainz)", async () => {
    const http = fakeFetch(body);
    const provider = new MusicBrainzMusicProvider(
      asFetch(http),
      "TestApp/1.0 (test@example.com)",
    );
    await provider.findSong("let it snow");

    const init = http.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(
      "TestApp/1.0 (test@example.com)",
    );
  });

  it("mappe title et artist-credit vers le modèle métier", async () => {
    const provider = new MusicBrainzMusicProvider(asFetch(fakeFetch(body)));
    expect(await provider.findSong("x")).toEqual({
      title: "Let It Snow!",
      artist: "Dean Martin",
    });
  });

  it("retourne null sans enregistrement", async () => {
    const provider = new MusicBrainzMusicProvider(
      asFetch(fakeFetch({ recordings: [] })),
    );
    expect(await provider.findSong("x")).toBeNull();
  });

  it("utilise « Artiste inconnu » si artist-credit absent", async () => {
    const provider = new MusicBrainzMusicProvider(
      asFetch(fakeFetch({ recordings: [{ title: "Solo" }] })),
    );
    expect(await provider.findSong("x")).toEqual({
      title: "Solo",
      artist: "Artiste inconnu",
    });
  });

  it("lève une erreur sur HTTP non-2xx", async () => {
    const provider = new MusicBrainzMusicProvider(asFetch(fakeFetch({}, 429)));
    await expect(provider.findSong("x")).rejects.toThrow("429");
  });
});

describe("LocalFallbackMusicProvider", () => {
  it("retourne toujours un morceau, quelle que soit la requête", async () => {
    const provider = new LocalFallbackMusicProvider();
    for (const q of ["a", "autre requête", "", "xyz"]) {
      const song = await provider.findSong(q);
      expect(song).not.toBeNull();
      expect(song!.title.length).toBeGreaterThan(0);
      expect(song!.artist.length).toBeGreaterThan(0);
    }
  });

  it("est déterministe pour une même requête", async () => {
    const provider = new LocalFallbackMusicProvider();
    expect(await provider.findSong("même requête")).toEqual(
      await provider.findSong("même requête"),
    );
  });
});

describe("CachedMusicProvider", () => {
  it("met en cache le résultat pendant le TTL", async () => {
    const inner = stubProvider("inner", { title: "T", artist: "A" });
    const cached = new CachedMusicProvider(inner, 60_000);

    await cached.findSong("Requête");
    await cached.findSong("requête"); // casse ignorée
    expect(inner.calls).toBe(1);
  });

  it("re-interroge le fournisseur après expiration du TTL", async () => {
    const inner = stubProvider("inner", { title: "T", artist: "A" });
    let now = 0;
    const cached = new CachedMusicProvider(inner, 100, () => now);

    await cached.findSong("q");
    now = 200;
    await cached.findSong("q");
    expect(inner.calls).toBe(2);
  });

  it("met aussi en cache les réponses null (limite iTunes ~20 req/min)", async () => {
    const inner = stubProvider("inner", null);
    const cached = new CachedMusicProvider(inner);
    await cached.findSong("q");
    await cached.findSong("q");
    expect(inner.calls).toBe(1);
  });
});

describe("ResilientMusicProvider", () => {
  it("retourne le premier résultat non nul de la chaîne", async () => {
    const a = stubProvider("a", null);
    const b = stubProvider("b", { title: "Trouvé", artist: "B" });
    const c = stubProvider("c", { title: "Autre", artist: "C" });
    const chain = new ResilientMusicProvider([a, b, c]);

    expect(await chain.findSong("q")).toEqual({ title: "Trouvé", artist: "B" });
    expect(chain.lastProviderName).toBe("b");
    expect(c.calls).toBe(0);
  });

  it("bascule sur le fournisseur suivant en cas de panne", async () => {
    const down = stubProvider("down", new Error("panne"));
    const local = new LocalFallbackMusicProvider();
    const chain = new ResilientMusicProvider([down, local]);

    const song = await chain.findSong("q");
    expect(song).not.toBeNull();
    expect(chain.lastProviderName).toBe("local-fallback");
  });

  it("garantit un morceau même si tous les fournisseurs distants tombent", async () => {
    const chain = new ResilientMusicProvider([
      new ITunesMusicProvider(asFetch(failingFetch())),
      new MusicBrainzMusicProvider(asFetch(failingFetch())),
      new LocalFallbackMusicProvider(),
    ]);
    const song = await chain.findSong("whatever");
    expect(song.title.length).toBeGreaterThan(0);
  });

  it("lève une erreur si la chaîne entière est vide de résultats", async () => {
    const chain = new ResilientMusicProvider([stubProvider("a", null)]);
    await expect(chain.findSong("q")).rejects.toThrow("Aucun fournisseur");
  });

  it("refuse une chaîne vide", () => {
    expect(() => new ResilientMusicProvider([])).toThrow();
  });
});
