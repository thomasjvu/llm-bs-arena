import { Matchup, TournamentConfig, MODELS, ExperimentId } from '../types/game.js';

export interface MatchupShard {
  start: number;
  end: number;
  count: number;
  label: string;
}

/**
 * Generates all C(n, k) combinations of items
 */
export function combinations<T>(items: T[], k: number): T[][] {
  if (k > items.length || k <= 0) {
    return [];
  }

  if (k === items.length) {
    return [items];
  }

  if (k === 1) {
    return items.map((item) => [item]);
  }

  const result: T[][] = [];

  for (let i = 0; i <= items.length - k; i++) {
    const head = items[i];
    const tailCombinations = combinations(items.slice(i + 1), k - 1);

    for (const tail of tailCombinations) {
      result.push([head, ...tail]);
    }
  }

  return result;
}

/**
 * Generates all matchups for a tournament
 * C(10, 4) = 210 unique 4-player combinations
 */
export function generateMatchups(models: string[], gamesPerMatchup: number): Matchup[] {
  const playerCombinations = combinations(models, 4);

  return playerCombinations.map((players) => ({
    players,
    games: gamesPerMatchup,
  }));
}

/**
 * Shuffles array to randomize player seating order
 */
export function shuffleSeating(players: string[], seed?: number): string[] {
  const shuffled = [...players];
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Creates a tournament configuration
 */
export function createTournamentConfig(
  experimentId: ExperimentId,
  gamesPerMatchup: number = 10,
  outputDir: string = 'logs',
  maxTurns?: number,
  matchupStart?: number,
  matchupEnd?: number
): TournamentConfig {
  if (maxTurns !== undefined && (!Number.isInteger(maxTurns) || maxTurns <= 0)) {
    throw new Error(`maxTurns must be a positive integer, got: ${maxTurns}`);
  }

  if (matchupStart !== undefined && (!Number.isInteger(matchupStart) || matchupStart < 0)) {
    throw new Error(`matchupStart must be a non-negative integer, got: ${matchupStart}`);
  }

  if (matchupEnd !== undefined && (!Number.isInteger(matchupEnd) || matchupEnd < 0)) {
    throw new Error(`matchupEnd must be a non-negative integer, got: ${matchupEnd}`);
  }

  return {
    experimentId,
    models: [...MODELS],
    gamesPerMatchup,
    outputDir,
    maxTurns,
    matchupStart,
    matchupEnd,
  };
}

export function resolveMatchupShard(
  totalMatchups: number,
  matchupStart?: number,
  matchupEnd?: number
): MatchupShard {
  if (!Number.isInteger(totalMatchups) || totalMatchups <= 0) {
    throw new Error(`totalMatchups must be a positive integer, got: ${totalMatchups}`);
  }

  const start = matchupStart ?? 0;
  const end = matchupEnd ?? totalMatchups - 1;

  if (!Number.isInteger(start) || start < 0 || start >= totalMatchups) {
    throw new Error(`matchupStart must be between 0 and ${totalMatchups - 1}, got: ${start}`);
  }

  if (!Number.isInteger(end) || end < start || end >= totalMatchups) {
    throw new Error(`matchupEnd must be between ${start} and ${totalMatchups - 1}, got: ${end}`);
  }

  return {
    start,
    end,
    count: end - start + 1,
    label: `${start}-${end}`,
  };
}

/**
 * Generates a unique game ID
 */
export function generateGameId(experimentId: number, matchupIndex: number, gameIndex: number): string {
  const timestamp = Date.now();
  return `exp${experimentId}_m${matchupIndex}_g${gameIndex}_${timestamp}`;
}

/**
 * Calculates total games in tournament
 */
export function calculateTotalGames(numModels: number, gamesPerMatchup: number): number {
  // C(n, 4) * gamesPerMatchup
  const numMatchups = factorial(numModels) / (factorial(4) * factorial(numModels - 4));
  return numMatchups * gamesPerMatchup;
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Gets progress info for a tournament
 */
export interface TournamentProgress {
  totalMatchups: number;
  completedMatchups: number;
  totalGames: number;
  completedGames: number;
  percentComplete: number;
}

export function calculateProgress(
  completedMatchups: number,
  gamesCompletedInCurrentMatchup: number,
  totalMatchups: number,
  gamesPerMatchup: number
): TournamentProgress {
  const totalGames = totalMatchups * gamesPerMatchup;
  const completedGames = completedMatchups * gamesPerMatchup + gamesCompletedInCurrentMatchup;

  return {
    totalMatchups,
    completedMatchups,
    totalGames,
    completedGames,
    percentComplete: (completedGames / totalGames) * 100,
  };
}
