import { DayOfWeek } from "./domain/DayOfWeek.js";
import { Weather } from "./domain/Weather.js";
import { buildContainer } from "./ioc/compositionRoot.js";
import { Tokens } from "./ioc/tokens.js";
import type { WakeUpService } from "./services/WakeUpService.js";

/**
 * Démonstration : l'ordonnancement n'est pas à coder, on simule
 * l'appel qui déclenche le réveil pour quelques utilisateurs.
 */
async function main() {
  const container = buildContainer();
  const wakeUp = container.resolve<WakeUpService>(Tokens.WakeUpService);

  const scenarios = [
    { userId: "user-1", day: DayOfWeek.LUNDI, weather: Weather.SOLEIL },
    { userId: "user-1", day: DayOfWeek.MARDI, weather: Weather.PLUIE },
    { userId: "user-2", day: DayOfWeek.MERCREDI, weather: Weather.NEIGE },
    { userId: "user-2", day: DayOfWeek.JEUDI, weather: Weather.NUAGEUX },
  ];

  for (const { userId, day, weather } of scenarios) {
    const report = await wakeUp.wakeUp(userId, day, weather);
    console.log(
      `[REPORT] ${report.userId} | ${report.day} ${report.weather} | ` +
        `morceau « ${report.song.title} » (${report.song.artist}) via ${report.musicSource} | ` +
        `canal ${report.channelUsed}${report.degraded ? " [DÉGRADÉ]" : ""}`,
    );
  }
}

main().catch((err) => {
  console.error("Échec du réveil :", err);
  process.exitCode = 1;
});
