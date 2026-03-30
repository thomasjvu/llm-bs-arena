import * as fs from 'fs';
import * as path from 'path';
import { GameLog, GameState, Turn } from '../types/game.js';

export interface AnalysisCohort {
  schemaVersion: number;
  provider: string;
  promptVersion: string;
  promptHash: string;
  size: number;
}

export interface CohortSelection {
  cohort: AnalysisCohort | null;
  games: GameLog[];
  excludedGames: number;
}

/**
 * Handles game logging to JSON files
 */
export class GameLogger {
  private outputDir: string;

  constructor(outputDir: string = 'logs/games') {
    this.outputDir = outputDir;
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * Saves a completed game log
   */
  saveGameLog(log: GameLog): string {
    const filename = `${log.gameId}.json`;
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(log, null, 2));
    return filepath;
  }

  /**
   * Converts a GameState to GameLog format
   */
  stateToLog(state: GameState): GameLog {
    return {
      gameId: state.gameId,
      experimentId: state.experimentId,
      players: state.players.map((p) => ({
        id: p.id,
        modelId: p.modelId,
      })),
      metadata: state.metadata,
      seatingOrder: state.seatingOrder,
      seed: state.seed,
      maxTurns: state.maxTurns,
      turns: state.turns,
      winner: state.winner,
      terminationReason: state.terminationReason,
      totalTurns: state.turns.length,
      startTime: state.startTime.toISOString(),
      endTime: state.endTime?.toISOString() || new Date().toISOString(),
      durationMs: state.endTime
        ? state.endTime.getTime() - state.startTime.getTime()
        : Date.now() - state.startTime.getTime(),
    };
  }

  /**
   * Loads all game logs from a directory
   */
  loadAllLogs(experimentId?: number): GameLog[] {
    const files = fs.readdirSync(this.outputDir).filter((f) => f.endsWith('.json'));

    const logs: GameLog[] = [];
    for (const file of files) {
      const filepath = path.join(this.outputDir, file);
      const content = fs.readFileSync(filepath, 'utf-8');
      const log = JSON.parse(content) as GameLog;

      if (experimentId === undefined || log.experimentId === experimentId) {
        logs.push(log);
      }
    }

    return logs;
  }

  /**
   * Loads a specific game log
   */
  loadGameLog(gameId: string): GameLog | null {
    const filepath = path.join(this.outputDir, `${gameId}.json`);
    if (!fs.existsSync(filepath)) {
      return null;
    }
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as GameLog;
  }

  /**
   * Lists all game IDs
   */
  listGameIds(): string[] {
    return fs
      .readdirSync(this.outputDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }

  /**
   * Gets count of games by experiment
   */
  getGameCounts(): Record<number, number> {
    const logs = this.loadAllLogs();
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    for (const log of logs) {
      counts[log.experimentId] = (counts[log.experimentId] || 0) + 1;
    }

    return counts;
  }
}

/**
 * Selects the dominant comparable cohort from a set of logs.
 * Prefers the highest schema version, then the largest cohort within that version.
 */
export function selectComparableGameCohort(logs: GameLog[]): CohortSelection {
  if (logs.length === 0) {
    return { cohort: null, games: [], excludedGames: 0 };
  }

  const cohortMap = new Map<string, { cohort: AnalysisCohort; games: GameLog[] }>();

  for (const log of logs) {
    const schemaVersion = log.metadata?.logSchemaVersion ?? 0;
    const provider = log.metadata?.provider || 'unknown';
    const promptVersion = log.metadata?.promptVersion || 'unknown';
    const promptHash = log.metadata?.promptHash || 'unknown';
    const key = [schemaVersion, provider, promptVersion, promptHash].join('|');

    if (!cohortMap.has(key)) {
      cohortMap.set(key, {
        cohort: {
          schemaVersion,
          provider,
          promptVersion,
          promptHash,
          size: 0,
        },
        games: [],
      });
    }

    const entry = cohortMap.get(key)!;
    entry.games.push(log);
    entry.cohort.size++;
  }

  const ranked = [...cohortMap.values()].sort((a, b) => {
    if (b.cohort.schemaVersion !== a.cohort.schemaVersion) {
      return b.cohort.schemaVersion - a.cohort.schemaVersion;
    }
    return b.cohort.size - a.cohort.size;
  });

  const selected = ranked[0];
  return {
    cohort: selected.cohort,
    games: selected.games,
    excludedGames: logs.length - selected.games.length,
  };
}

/**
 * Formats a turn for console output
 */
export function formatTurnForConsole(turn: Turn, modelMap: Record<string, string>): string {
  const model = modelMap[turn.playerId] || turn.playerId;
  let output = `Turn ${turn.turnNumber}: ${model} plays ${turn.claimedCount} ${turn.claimedRank}(s)`;

  if (turn.wasLie) {
    output += ' [LIE]';
  }

  if (turn.challenged) {
    const challenger = modelMap[turn.challengerId!] || turn.challengerId;
    output += ` - CHALLENGED by ${challenger}`;
    output += turn.challengeCorrect ? ' ✓' : ' ✗';
  }

  return output;
}

/**
 * Formats a game summary for console output
 */
export function formatGameSummary(log: GameLog, options: { verbose?: boolean } = {}): string {
  const lines: string[] = [];
  const modelMap: Record<string, string> = {};

  for (const p of log.players) {
    modelMap[p.id] = p.modelId.split('/').pop() || p.modelId;
  }

  lines.push(`Game: ${log.gameId}`);
  lines.push(`Experiment: ${log.experimentId}`);
  lines.push(`Players: ${log.players.map((p) => modelMap[p.id]).join(', ')}`);
  lines.push(`Turns: ${log.totalTurns}`);
  lines.push(`Duration: ${(log.durationMs / 1000).toFixed(1)}s`);
  if (log.seed !== undefined) {
    lines.push(`Seed: ${log.seed}`);
  }
  if (log.maxTurns !== undefined) {
    lines.push(`Max Turns: ${log.maxTurns}`);
  }

  const winner = log.winner ? modelMap[log.winner] : 'None';
  lines.push(`Winner: ${winner}`);
  if (log.terminationReason === 'turn_cap') {
    lines.push('Termination: turn cap');
  }

  if (options.verbose) {
    lines.push('\nTurn History:');
    for (const turn of log.turns) {
      lines.push('  ' + formatTurnForConsole(turn, modelMap));
    }
  }

  return lines.join('\n');
}
