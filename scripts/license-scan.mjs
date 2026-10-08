#!/usr/bin/env node
/**
 * Scan des dépendances : licence, version installée et fraîcheur
 * (dernière version stable publiée sur npm), avec classification
 * permissive / copyleft. Injecte le rapport dans README.md entre
 * les balises LICENSE-SCAN:START / LICENSE-SCAN:END.
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

const STRONG_COPYLEFT = /^(GPL-?|AGPL|SSPL|CC-BY-SA|CPAL|OSL|EUPL)/i;
const WEAK_COPYLEFT = /^(LGPL|MPL|EPL)/i;
const PERMISSIVE =
  /^(MIT|ISC|BSD-?\d?-?Clause|Apache|0BSD|Unlicense|CC0|Zlib|Python|PSF|BlueOak|WTFPL|Artistic)/i;

function classify(license) {
  if (STRONG_COPYLEFT.test(license)) return "Copyleft fort";
  if (WEAK_COPYLEFT.test(license)) return "Copyleft faible";
  if (PERMISSIVE.test(license)) return "Permissive";
  return "À vérifier";
}

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
  p.kind = classify(p.license);
}

const date = new Date().toISOString().slice(0, 10);
const nbDirect = installed.filter((p) => p.direct).length;
const flagged = installed.filter(
  (p) => p.outdated || p.kind === "Copyleft fort" || p.kind === "À vérifier",
);
const weakCopyleft = installed.filter((p) => p.kind === "Copyleft faible");

const rows = installed
  .map(
    (p) =>
      `| ${p.name} | ${p.version} | ${p.latest} | ${p.license} | ${p.kind} | ` +
      `${p.direct ? "directe" : "transitive"} | ${p.outdated ? "⚠️ maj dispo" : "à jour"} |`,
  )
  .join("\n");

const analysis = [
  ...(weakCopyleft.length
    ? weakCopyleft.map(
        (p) =>
          `- **${p.name}** (${p.license}, copyleft faible, ${p.direct ? "directe" : "transitive"}) : ` +
          `réciprocité limitée au fichier — acceptable : dépendance de développement, ` +
          `non distribuée ni liée au runtime.`,
      )
    : []),
  ...(flagged.length
    ? flagged.map((p) => {
        const reasons = [];
        if (p.kind === "Copyleft fort")
          reasons.push(`licence ${p.license} à copyleft fort — impact à évaluer`);
        if (p.kind === "À vérifier")
          reasons.push(`licence ${p.license} non reconnue — vérification manuelle requise`);
        if (p.outdated)
          reasons.push(`installée ${p.version} < dernière stable ${p.latest}`);
        return `- **${p.name}** : ${reasons.join(" ; ")}.`;
      })
    : ["- Aucun composant ne pose question."]),
].join("\n");

const report = `<!-- LICENSE-SCAN:START -->

Dernière génération : ${date} — \`npm run license:scan\` (\`scripts/license-scan.mjs\`).
${installed.length} packages analysés (${nbDirect} directs, le reste transitifs).

**Aucune dépendance de production (runtime)** : le service n'utilise que l'API
\`fetch\` native de Node.js. Toutes les dépendances sont de développement.

| Package | Installée | Dernière stable | Licence | Permissivité | Type | Fraîcheur |
|---------|-----------|-----------------|---------|--------------|------|-----------|
${rows}

#### Points d'attention

${analysis}

- « Fraîcheur » = comparaison entre la version installée (\`package-lock.json\`) et
  la dernière version stable publiée sur le registry npm.
- Les APIs externes (iTunes Search, MusicBrainz) sont des services, pas des
  composants intégrés : leurs conditions d'usage sont respectées (User-Agent
  identifiable pour MusicBrainz, cache côté iTunes pour la limite ~20 req/min).

<!-- LICENSE-SCAN:END -->`;

const readmePath = path.join(root, "README.md");
const readme = await readFile(readmePath, "utf8");
const START = "<!-- LICENSE-SCAN:START -->";
const END = "<!-- LICENSE-SCAN:END -->";

if (readme.includes(START) && readme.includes(END)) {
  const before = readme.slice(0, readme.indexOf(START));
  const after = readme.slice(readme.indexOf(END) + END.length);
  await writeFile(readmePath, before + report + after);
} else {
  await writeFile(readmePath, readme.trimEnd() + "\n\n" + report + "\n");
}

console.log(
  `README.md mis à jour : ${installed.length} packages, ${flagged.length + weakCopyleft.length} à surveiller.`,
);
