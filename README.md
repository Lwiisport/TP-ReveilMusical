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
| Vérifier licences/fraîcheur des dépendances | `scripts/license-scan.mjs` → [`licence.md`](licence.md) |

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

Inventaire complet (51 packages, transitifs inclus) dans [`licence.md`](licence.md),
régénérable via `npm run license:scan`.

**Aucune dépendance de production** : le service n'utilise que `fetch` natif
(Node ≥ 22.6). Dépendances directes de développement :

| Package | Installée | Dernière stable | Licence | Justification |
|---------|-----------|-----------------|---------|----------------|
| typescript | 7.0.2 | 7.0.2 | Apache-2.0 | Permissive, à jour |
| vitest | 5.0.3 | 5.0.3 | MIT | Permissive, à jour |
| @vitest/coverage-v8 | 5.0.3 | 5.0.3 | MIT | Permissive, à jour |
| @types/node | 26.6.4 | 26.6.4 | MIT | Permissive, à jour |

Points d'attention relevés par le scan (tous sur des transitives de dev, non
distribuées) : `lightningcss` sous **MPL-2.0** (copyleft faible, acceptable pour
un outil de build non livré) ; quelques transitives (`@babel/*`, `nanoid`,
`es-module-lexer`…) ont une version stable plus récente — détail dans `licence.md`.
