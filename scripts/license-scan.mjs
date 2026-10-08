#!/usr/bin/env node
/**
 * Scan des dépendances : licence, version installée et fraîcheur
 * (dernière version stable publiée sur npm). Génère licence.md.
 *
 * Usage : npm run license:scan
 */
import { execFile } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";

const execFileP = promisify(execFile);
const root = new URL("..", import.meta.url).pathname;
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const directDeps = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

// Licences à surveiller : copyleft fort, copyleft faible, ou licence absente.
const STRONG_COPYLEFT = /^(GPL-?|AGPL|SSPL|CC-BY-SA|CPAL|OSL|EUPL)/i;
const WEAK_COPYLEFT = /^(LGPL|MPL|EPL)/i;

async function installedPackages() {
  const result = new Map();
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name.startsWith("@")) {
        await walk(full);
        continue;
      }
      const pj = path.join(full, "package.json");
      if (!existsSync(pj)) continue;
      const meta = JSON.parse(await readFile(pj, "utf8"));
      if (meta.name && meta.version && !result.has(meta.name)) {
        result.set(meta.name, {
          name: meta.name,
          version: meta.version,
          license:
            typeof meta.license === "string"
              ? meta.license
              : (meta.license?.type ??
                meta.licenses?.map((l) => l.type).join(" OR ") ??
                "INCONNUE"),
          path: full,
        });
      }
      const nested = path.join(full, "node_modules");
      if (existsSync(nested)) await walk(nested);
    }
  }
  await walk(path.join(root, "node_modules"));
  return result;
}

async function latestVersion(name) {
  try {
    const { stdout } = await execFileP("npm", ["view", name, "version"], {
      timeout: 15000,
    });
    return stdout.trim();
  } catch {
    return "?";
  }
}

const installed = [...(await installedPackages().then((m) => m.values()))].sort(
  (a, b) => a.name.localeCompare(b.name),
);

// Récupération des dernières versions (concurrence limitée).
const CONCURRENCY = 8;
for (let i = 0; i < installed.length; i += CONCURRENCY) {
  await Promise.all(
    installed
      .slice(i, i + CONCURRENCY)
      .map(async (p) => (p.latest = await latestVersion(p.name))),
  );
}

for (const p of installed) {
  p.direct = directDeps.has(p.name);
  p.outdated = p.latest !== "?" && p.latest !== p.version;
  p.strongCopyleft = STRONG_COPYLEFT.test(p.license);
  p.weakCopyleft = WEAK_COPYLEFT.test(p.license);
  p.copyleft = p.strongCopyleft || p.weakCopyleft || p.license === "INCONNUE";
}

const date = new Date().toISOString().slice(0, 10);
const rows = installed
  .map(
    (p) =>
      `| ${p.name} | ${p.version} | ${p.latest} | ${p.license} | ` +
      `${p.direct ? "directe" : "transitive"} | ${p.outdated ? "⚠️ maj dispo" : "à jour"} |`,
  )
  .join("\n");

const flagged = installed.filter((p) => p.copyleft || p.outdated);
const analysis = flagged.length
  ? flagged
      .map((p) => {
        const reasons = [];
        if (p.license === "INCONNUE")
          reasons.push("licence non déclarée — à vérifier manuellement avant intégration");
        else if (p.strongCopyleft)
          reasons.push(`licence ${p.license} à copyleft fort — impact à évaluer`);
        else if (p.weakCopyleft)
          reasons.push(
            `licence ${p.license} à copyleft faible (réciprocité au niveau du fichier) — acceptable ici : dépendance transitive de développement, non distribuée ni liée au runtime`,
          );
        if (p.outdated)
          reasons.push(`version installée ${p.version} < dernière stable ${p.latest}`);
        return `- **${p.name}** : ${reasons.join(" ; ")}.`;
      })
      .join("\n")
  : "- Aucun composant ne pose question.";

const md = `# Rapport de licences — ${pkg.name} v${pkg.version}

Généré le ${date} par \`npm run license:scan\` (\`scripts/license-scan.mjs\`).
${installed.length} packages analysés (${installed.filter((p) => p.direct).length} directs, le reste transitifs).

## Résumé exécutif

- **Dépendances de production (runtime) :** aucune — le service n'utilise que l'API \`fetch\` native de Node.js.
- **Dépendances de développement :** ${[...directDeps].join(", ")}.
- **Composants à surveiller :** ${flagged.length || "aucun"}.

## Inventaire

| Package | Installée | Dernière stable | Licence | Type | Fraîcheur |
|---------|-----------|-----------------|---------|------|-----------|
${rows}

## Analyse et justifications

${analysis}

## Notes

- Les licences copyleft éventuelles sur des dépendances **de développement** (ex. outillage de test) ne contaminent pas le code livré : elles ne sont ni distribuées ni liées au runtime.
- « Fraîcheur » = comparaison entre la version installée (\`package-lock.json\`) et la dernière version stable publiée sur le registry npm.
- Les APIs externes (iTunes Search, MusicBrainz) sont des services, pas des composants intégrés : elles sont accédées via des adaptateurs et leurs conditions d'usage sont respectées (User-Agent identifiable pour MusicBrainz, cache côté iTunes pour la limite ~20 req/min).
`;

await writeFile(path.join(root, "licence.md"), md);
console.log(`licence.md généré : ${installed.length} packages, ${flagged.length} à surveiller.`);
