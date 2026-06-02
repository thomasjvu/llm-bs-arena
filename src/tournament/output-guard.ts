import * as fs from 'fs';
import * as path from 'path';
import { GameLogger } from '../logging/game-logger.js';
import { RunMetadata } from '../types/game.js';

export interface OutputCohortGuardOptions {
  allowMixedOutput?: boolean;
}

export function assertOutputCohortCompatible(
  outputDir: string,
  runMetadata: RunMetadata,
  options: OutputCohortGuardOptions = {}
): void {
  if (options.allowMixedOutput) {
    return;
  }

  const gamesDir = path.join(outputDir, 'games');
  if (!fs.existsSync(gamesDir)) {
    return;
  }

  const logger = new GameLogger(gamesDir);
  const logs = logger.loadAllLogs();
  const incompatible = logs.filter((log) =>
    log.metadata?.logSchemaVersion !== runMetadata.logSchemaVersion ||
    log.metadata?.provider !== runMetadata.provider ||
    log.metadata?.promptVersion !== runMetadata.promptVersion ||
    log.metadata?.promptHash !== runMetadata.promptHash ||
    log.metadata?.contextBudgetTokens !== runMetadata.contextBudgetTokens ||
    log.metadata?.playMaxTokens !== runMetadata.playMaxTokens ||
    log.metadata?.challengeMaxTokens !== runMetadata.challengeMaxTokens
  );

  if (incompatible.length === 0) {
    return;
  }

  throw new Error(
    `Output directory "${outputDir}" already contains ${incompatible.length} game log(s) from a different ` +
    'schema/provider/prompt/context-budget/token-cap cohort. Use a fresh output directory such as logs-v3-smoke or logs-v3, ' +
    'or pass --allow-mixed-output if you intentionally want to mix cohorts.'
  );
}
