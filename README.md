# Réveil musical

TP — service qui réveille chaque utilisateur avec un morceau choisi selon le jour
de la semaine et la météo du jour, puis le prévient sur le canal de son choix.

Point d'entrée : `WakeUpService.wakeUp(userId, day, weather)` — l'ordonnancement
n'est pas à coder, seul l'appel de déclenchement est implémenté.

## Exigences métier → traduction technique

| Exigence | Traduction |
|---|---|
| Changer de fournisseur de musique rapidement | Port `MusicProvider` + **pattern Adapter** (iTunes, MusicBrainz) + chaîne de fallback |
| Notifier sur plusieurs canaux (email, SMS, push, …) | Port `Notifier` + **pattern Strategy** (`NotificationService`), adaptateurs par SDK |
| Aucun `new` dans le métier | **IoC/DI** : container maison + *composition root* unique (`src/ioc/`) |
| Panne fournisseur/canal ≠ silence | `ResilientMusicProvider` (chaîne → fallback local codé en dur) ; `NotificationService` (canaux de repli → `LogNotifier`) |
| Vérifier licences/fraîcheur des dépendances | `scripts/license-scan.mjs` → section « Dépendances » ci-dessous |

## Architecture

```
src/
├── domain/          # Modèle métier pur (Song, Weather, UserPreferences…)
│                     # — aucun champ propre à un fournisseur (trackViewUrl ne fuit pas)
├── ports/           # Interfaces : MusicProvider, Notifier, UserPreferencesService
├── adapters/
│   ├── music/       # ITunesMusicProvider, MusicBrainzMusicProvider,
│   │                # LocalFallbackMusicProvider, CachedMusicProvider (Decorator, TTL
│   │                # pour la limite ~20 req/min d'iTunes), ResilientMusicProvider (chaîne)
│   ├── notification/
│   │   ├── sdks/    # Mocks email/SMS/push aux interfaces volontairement différentes
│   │   └── *.ts     # Adapters vers le port Notifier commun + LogNotifier (secours)
│   └── preferences/ # StubUserPreferencesService (mock du service interne)
├── services/        # WakeUpService (point d'entrée), NotificationService (stratégies)
└── ioc/             # Container, tokens, compositionRoot — SEUL fichier avec des `new`
```

**Chaîne de musique par défaut** : `cache(iTunes) → MusicBrainz → fallback local`.
Chaque maillon est essayé à tour de rôle ; le fallback local ne retourne jamais
`null`, un réveil produit donc toujours un morceau.

**Notifications** : le canal préféré de l'utilisateur est tenté en premier, puis
les autres canaux en repli, puis la journalisation en dernier recours. Le rapport
(`WakeUpReport`) expose `degraded: true` quand le canal préféré n'a pas pu servir.

### Changer de fournisseur de musique

Une seule ligne à modifier dans `src/ioc/compositionRoot.ts` (la chaîne passée à
`ResilientMusicProvider`), plus l'adapter écrit contre `MusicProvider`. Zéro
changement dans le métier.

### Ajouter un canal de notification

1. Écrire le mock/SDK du canal (interface libre).
2. Écrire l'adapter qui implémente `Notifier`.
3. L'enregistrer dans `Tokens.Notifiers` de la composition root.
4. Ajouter la valeur à `NotificationChannel` et à l'ordre de repli.

## Utilisation

```bash
npm install
npm test                # tests unitaires (vitest)
npm run test:coverage   # avec couverture
npm run typecheck       # tsc strict
npm run start           # démo : simule plusieurs réveils
npm run license:scan    # régénère licence.md
```

## Dépendances — licences et fraîcheur

Inventaire complet ci-dessous, régénéré par `npm run license:scan` (chaque
package : licence, version installée, dernière stable et permissivité).

<!-- LICENSE-SCAN:START -->

Dernière génération : 2026-10-08 — `npm run license:scan` (`scripts/license-scan.mjs`).
51 packages analysés (4 directs, le reste transitifs).

**Aucune dépendance de production (runtime)** : le service n'utilise que l'API
`fetch` native de Node.js. Toutes les dépendances sont de développement.

| Package | Installée | Dernière stable | Licence | Permissivité | Type | Fraîcheur |
|---------|-----------|-----------------|---------|--------------|------|-----------|
| @babel/helper-string-parser | 7.29.7 | 8.0.6 | MIT | Permissive | transitive | ⚠️ maj dispo |
| @babel/helper-validator-identifier | 7.29.7 | 8.0.6 | MIT | Permissive | transitive | ⚠️ maj dispo |
| @babel/parser | 7.29.9 | 8.0.7 | MIT | Permissive | transitive | ⚠️ maj dispo |
| @babel/types | 7.29.8 | 8.0.6 | MIT | Permissive | transitive | ⚠️ maj dispo |
| @bcoe/v8-coverage | 1.0.2 | 1.0.2 | MIT | Permissive | transitive | à jour |
| @jridgewell/resolve-uri | 3.1.2 | 3.1.2 | MIT | Permissive | transitive | à jour |
| @jridgewell/sourcemap-codec | 1.6.0 | 1.6.0 | MIT | Permissive | transitive | à jour |
| @jridgewell/trace-mapping | 0.3.31 | 0.3.31 | MIT | Permissive | transitive | à jour |
| @oxc-project/types | 0.153.0 | 0.153.0 | MIT | Permissive | transitive | à jour |
| @rolldown/binding-linux-x64-gnu | 1.2.13 | 1.2.13 | MIT | Permissive | transitive | à jour |
| @rolldown/pluginutils | 1.0.1 | 1.0.1 | MIT | Permissive | transitive | à jour |
| @types/chai | 5.2.3 | 5.2.3 | MIT | Permissive | transitive | à jour |
| @types/deep-eql | 4.0.2 | 4.0.2 | MIT | Permissive | transitive | à jour |
| @types/estree | 1.0.9 | 1.0.9 | MIT | Permissive | transitive | à jour |
| @types/node | 26.6.4 | 26.6.4 | MIT | Permissive | directe | à jour |
| @typescript/typescript-linux-x64 | 7.0.2 | 7.0.2 | Apache-2.0 | Permissive | transitive | à jour |
| @vitest/coverage-v8 | 5.0.3 | 5.0.3 | MIT | Permissive | directe | à jour |
| @vitest/istanbul-lib-coverage | 1.0.2 | 1.0.2 | MIT | Permissive | transitive | à jour |
| @vitest/istanbul-lib-report | 1.0.2 | 1.0.2 | MIT | Permissive | transitive | à jour |
| @vitest/mocker | 5.0.3 | 5.0.3 | MIT | Permissive | transitive | à jour |
| @vitest/spy | 5.0.3 | 5.0.3 | MIT | Permissive | transitive | à jour |
| assertion-error | 2.0.1 | 2.0.1 | MIT | Permissive | transitive | à jour |
| ast-v8-to-istanbul | 1.0.7 | 1.0.7 | MIT | Permissive | transitive | à jour |
| chai | 6.3.0 | 6.3.0 | MIT | Permissive | transitive | à jour |
| detect-libc | 2.1.2 | 2.1.2 | Apache-2.0 | Permissive | transitive | à jour |
| es-module-lexer | 2.3.2 | 3.0.3 | MIT | Permissive | transitive | ⚠️ maj dispo |
| estree-walker | 3.0.3 | 3.0.3 | MIT | Permissive | transitive | à jour |
| expect-type | 1.4.0 | 1.4.0 | Apache-2.0 | Permissive | transitive | à jour |
| fdir | 6.5.0 | 6.5.0 | MIT | Permissive | transitive | à jour |
| js-tokens | 10.0.0 | 10.0.0 | MIT | Permissive | transitive | à jour |
| lightningcss | 1.33.0 | 1.33.0 | MPL-2.0 | Copyleft faible | transitive | à jour |
| lightningcss-linux-x64-gnu | 1.33.0 | 1.33.0 | MPL-2.0 | Copyleft faible | transitive | à jour |
| magic-string | 1.4.3 | 1.4.3 | MIT | Permissive | transitive | à jour |
| magicast | 0.5.5 | 0.5.5 | MIT | Permissive | transitive | à jour |
| nanoid | 3.3.20 | 6.0.2 | MIT | Permissive | transitive | ⚠️ maj dispo |
| obug | 2.2.1 | 3.0.0 | MIT | Permissive | transitive | ⚠️ maj dispo |
| picocolors | 1.1.1 | 1.1.1 | ISC | Permissive | transitive | à jour |
| picomatch | 4.0.7 | 4.0.7 | MIT | Permissive | transitive | à jour |
| postcss | 8.5.29 | 8.5.29 | MIT | Permissive | transitive | à jour |
| rolldown | 1.2.13 | 1.2.13 | MIT | Permissive | transitive | à jour |
| source-map-js | 1.2.2 | 1.2.2 | BSD-3-Clause | Permissive | transitive | à jour |
| std-env | 4.3.0 | 4.3.0 | MIT | Permissive | transitive | à jour |
| tinybench | 6.2.1 | 6.2.1 | MIT | Permissive | transitive | à jour |
| tinyexec | 1.3.1 | 1.3.1 | MIT | Permissive | transitive | à jour |
| tinyglobby | 0.2.17 | 0.2.17 | MIT | Permissive | transitive | à jour |
| tinyrainbow | 3.2.0 | 3.2.0 | MIT | Permissive | transitive | à jour |
| typescript | 7.0.2 | 7.0.2 | Apache-2.0 | Permissive | directe | à jour |
| undici-types | 8.9.0 | 8.11.2 | MIT | Permissive | transitive | ⚠️ maj dispo |
| vite | 8.3.3 | 8.3.3 | MIT | Permissive | transitive | à jour |
| vitest | 5.0.3 | 5.0.3 | MIT | Permissive | directe | à jour |
| why-is-node-running | 3.2.1 | 3.2.2 | MIT | Permissive | transitive | ⚠️ maj dispo |

#### Points d'attention

- **lightningcss** (MPL-2.0, copyleft faible, transitive) : réciprocité limitée au fichier — acceptable : dépendance de développement, non distribuée ni liée au runtime.
- **lightningcss-linux-x64-gnu** (MPL-2.0, copyleft faible, transitive) : réciprocité limitée au fichier — acceptable : dépendance de développement, non distribuée ni liée au runtime.
- **@babel/helper-string-parser** : installée 7.29.7 < dernière stable 8.0.6.
- **@babel/helper-validator-identifier** : installée 7.29.7 < dernière stable 8.0.6.
- **@babel/parser** : installée 7.29.9 < dernière stable 8.0.7.
- **@babel/types** : installée 7.29.8 < dernière stable 8.0.6.
- **es-module-lexer** : installée 2.3.2 < dernière stable 3.0.3.
- **nanoid** : installée 3.3.20 < dernière stable 6.0.2.
- **obug** : installée 2.2.1 < dernière stable 3.0.0.
- **undici-types** : installée 8.9.0 < dernière stable 8.11.2.
- **why-is-node-running** : installée 3.2.1 < dernière stable 3.2.2.

- « Fraîcheur » = comparaison entre la version installée (`package-lock.json`) et
  la dernière version stable publiée sur le registry npm.
- Les APIs externes (iTunes Search, MusicBrainz) sont des services, pas des
  composants intégrés : leurs conditions d'usage sont respectées (User-Agent
  identifiable pour MusicBrainz, cache côté iTunes pour la limite ~20 req/min).

<!-- LICENSE-SCAN:END -->
