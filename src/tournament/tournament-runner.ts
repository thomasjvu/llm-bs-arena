import * as fs from 'fs';
import * as path from 'path';
import { GameState, GameLog, TournamentConfig, ExperimentId, Matchup, RunMetadata } from '../types/game.js';
import { createGameState } from '../engine/game-state.js';
import { TurnManager, LLMAdapter } from '../engine/turn-manager.js';
import {
  generateMatchups,
  shuffleSeating,
  generateGameId,
  calculateProgress,
  TournamentProgress,
  resolveMatchupShard,
  resolveGameSlotShard,
} from './matchup-generator.js';


interface Checkpoint {
  experimentId: ExperimentId;
  gamesPerMatchup: number;
  matchupStart: number;
  matchupEnd: number;
  gameStart?: number;
  gameEnd?: number;
  matchupIndex: number;
  gameIndex: number;
  completedGames: string[];
  timestamp: string;
}

interface TournamentSlot {
  matchupIndex: number;
  gameIndex: number;
}

function formatFailureLimit(limit: number): string {
  return limit === 0 ? 'unlimited' : String(limit);
}

function isFatalTournamentError(error: unknown): boolean {
  return error instanceof Error && error.name === 'NonRetryableAPIError';
}

export function formatTournamentGameCompletion(gameLog: GameLog, percentComplete: number): string {
  const winnerPlayer = gameLog.players.find((player) => player.id === gameLog.winner);
  const winnerLabel = winnerPlayer?.modelId || gameLog.winner || 'none';

  return (
    `Game ${gameLog.gameId} completed. Winner: ${winnerLabel}. ` +
    `Turns: ${gameLog.totalTurns}. Progress: ${percentComplete.toFixed(1)}%`
  );
}

/**
 * Orchestrates tournament execution with checkpointing
 */
export class TournamentRunner {
  private config: TournamentConfig;
  private llmAdapter: LLMAdapter;
  private turnManager: TurnManager;
  private checkpointPath: string;
  private logsDir: string;
  private snapshotsDir: string;
  private runMetadata?: RunMetadata;
  private checkpointPrefix: string;
  private gameRetryDelayMs: number;
  private maxGameFailuresPerSlot: number;

  constructor(config: TournamentConfig, llmAdapter: LLMAdapter, runMetadata?: RunMetadata) {
    this.config = config;
    this.llmAdapter = llmAdapter;
    this.runMetadata = runMetadata;
    this.turnManager = new TurnManager({ maxTurns: config.maxTurns });
    this.logsDir = path.join(config.outputDir, 'games');
    this.snapshotsDir = path.join(config.outputDir, 'active');
    this.checkpointPrefix = `checkpoint_exp${config.experimentId}`;
    this.checkpointPath = path.join(config.outputDir, `${this.checkpointPrefix}.json`);
    this.gameRetryDelayMs = config.gameRetryDelayMs ?? 30_000;
    this.maxGameFailuresPerSlot = config.maxGameFailuresPerSlot ?? 10;

    fs.mkdirSync(this.logsDir, { recursive: true });
    fs.mkdirSync(this.snapshotsDir, { recursive: true });
  }

  /**
   * Runs the full tournament with checkpoint/resume support
   */
  async run(onProgress?: (progress: TournamentProgress) => void): Promise<void> {
    const matchups = generateMatchups(this.config.models, this.config.gamesPerMatchup);
    const shard = resolveMatchupShard(matchups.length, this.config.matchupStart, this.config.matchupEnd);
    const gameShard = this.config.gameStart !== undefined || this.config.gameEnd !== undefined
      ? resolveGameSlotShard(matchups.length * this.config.gamesPerMatchup, this.config.gameStart, this.config.gameEnd)
      : null;
    const slots = this.resolveTournamentSlots(matchups, shard, gameShard);
    if (slots.length === 0) {
      throw new Error('The requested matchup/game shard does not contain any tournament game slots');
    }
    this.checkpointPath = path.join(
      this.config.outputDir,
      `${this.checkpointPrefix}_m${shard.label}${gameShard ? `_s${gameShard.label}` : ''}.json`
    );
    const checkpoint = this.loadCheckpoint();

    const completedGames = [...(checkpoint?.completedGames || [])];
    const completedSlots = this.extractCompletedSlotKeys(completedGames);

    console.log(`Starting experiment ${this.config.experimentId}`);
    console.log(`Total matchups in experiment: ${matchups.length}`);
    console.log(`Shard matchups: ${shard.start}-${shard.end} (${shard.count} matchups)`);
    if (gameShard) {
      console.log(`Global game-slot shard: ${gameShard.start}-${gameShard.end} (${gameShard.count} slot(s))`);
    }
    console.log(`Games per matchup: ${this.config.gamesPerMatchup}`);
    console.log(`Total games in shard: ${slots.length}`);
    console.log(`Retry delay per failed game slot: ${Math.round(this.gameRetryDelayMs / 1000)}s`);
    console.log(`Max failed attempts per game slot before aborting shard: ${formatFailureLimit(this.maxGameFailuresPerSlot)}`);

    if (checkpoint) {
      const nextPending = this.findNextPendingSlot(slots, completedSlots);
      console.log(
        `Resuming shard with ${completedGames.length}/${slots.length} completed games` +
        (nextPending ? `; next pending slot is matchup ${nextPending.matchupIndex}, game ${nextPending.gameIndex}` : '; shard is complete')
      );
    }

    for (const slot of slots) {
      const m = slot.matchupIndex;
      const g = slot.gameIndex;
      const matchup = matchups[m];
      const slotKey = this.buildSlotKey(m, g);
      if (completedSlots.has(slotKey)) {
        continue;
      }

      let failuresForSlot = 0;
      while (true) {
        const seed = hashString(`${this.config.experimentId}:${m}:${g}`);

        try {
          const gameLog = await this.runSingleGame(matchup, m, g, seed);
          this.saveGameLog(gameLog);
          completedGames.push(gameLog.gameId);
          completedSlots.add(slotKey);
          this.deleteGameSnapshot(m, g);

          const nextPending = this.findNextPendingSlot(slots, completedSlots);

          this.saveCheckpoint({
            experimentId: this.config.experimentId,
            gamesPerMatchup: this.config.gamesPerMatchup,
            matchupStart: shard.start,
            matchupEnd: shard.end,
            gameStart: gameShard?.start,
            gameEnd: gameShard?.end,
            matchupIndex: nextPending?.matchupIndex ?? shard.end,
            gameIndex: nextPending?.gameIndex ?? this.config.gamesPerMatchup,
            completedGames,
            timestamp: new Date().toISOString(),
          });

          if (onProgress) {
            onProgress(this.buildProgress(slots, completedSlots));
          }

          console.log(
            formatTournamentGameCompletion(
              gameLog,
              (completedSlots.size / slots.length) * 100
            )
          );
          break;
        } catch (error) {
          if (isFatalTournamentError(error)) {
            const slotLabel = this.buildSlotKey(m, g);
            console.error(`[tournament] Fatal non-transient error in game slot ${slotLabel}; aborting shard without retry:`, error);
            throw error;
          }

          failuresForSlot++;
          const slotLabel = this.buildSlotKey(m, g);
          console.error(
            `[tournament] Error in game slot ${slotLabel}, attempt ${failuresForSlot}/${formatFailureLimit(this.maxGameFailuresPerSlot)}:`,
            error
          );

          if (this.maxGameFailuresPerSlot !== 0 && failuresForSlot >= this.maxGameFailuresPerSlot) {
            throw new Error(
              `Aborting shard after ${failuresForSlot} failed attempt(s) for ${slotLabel}. ` +
              `Fix the underlying issue, then rerun the same shard command to resume.`
            );
          }

          console.log(
            `[tournament] Waiting ${(this.gameRetryDelayMs / 1000).toFixed(1)}s before retrying ${slotLabel}...`
          );
          await this.sleep(this.gameRetryDelayMs);
        }
      }
    }

    console.log(`Experiment ${this.config.experimentId} completed!`);
  }

  /**
   * Runs a single game
   */
  async runSingleGame(matchup: Matchup, matchupIndex: number, gameIndex: number, seed: number): Promise<GameLog> {
    const snapshotState = this.loadGameSnapshot(matchupIndex, gameIndex);
    const state = snapshotState ?? (() => {
      const gameId = generateGameId(this.config.experimentId, matchupIndex, gameIndex);
      const players = shuffleSeating(matchup.players, seed);
      const freshState = createGameState(gameId, this.config.experimentId, players, seed);
      freshState.metadata = this.runMetadata;
      this.saveGameSnapshot(matchupIndex, gameIndex, freshState);
      return freshState;
    })();

    const startTime = state.startTime.getTime();
    const finalState = await this.turnManager.runGameWithCallback(
      state,
      this.llmAdapter,
      async (updatedState) => this.saveGameSnapshot(matchupIndex, gameIndex, updatedState)
    );
    const endTime = finalState.endTime?.getTime() ?? Date.now();

    return this.stateToLog(finalState, startTime, endTime);
  }

  /**
   * Converts game state to log format
   */
  private stateToLog(state: GameState, startTime: number, endTime: number): GameLog {
    return {
      gameId: state.gameId,
      experimentId: state.experimentId,
      players: state.players.map((p) => ({ id: p.id, modelId: p.modelId })),
      metadata: state.metadata,
      seatingOrder: state.seatingOrder,
      seed: state.seed,
      maxTurns: state.maxTurns,
      turns: state.turns,
      winner: state.winner,
      terminationReason: state.terminationReason,
      invalidDecision: state.invalidDecision,
      totalTurns: state.turns.length,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      durationMs: endTime - startTime,
    };
  }

  /**
   * Saves a game log to disk
   */
  private saveGameLog(log: GameLog): void {
    const filename = `${log.gameId}.json`;
    const filepath = path.join(this.logsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(log, null, 2));
  }

  /**
   * Loads checkpoint if it exists
   */
  private loadCheckpoint(): Checkpoint | null {
    if (fs.existsSync(this.checkpointPath)) {
      const data = fs.readFileSync(this.checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(data) as Checkpoint;

      const shard = resolveMatchupShard(
        generateMatchups(this.config.models, this.config.gamesPerMatchup).length,
        this.config.matchupStart,
        this.config.matchupEnd
      );
      const totalGameSlots = generateMatchups(this.config.models, this.config.gamesPerMatchup).length * this.config.gamesPerMatchup;
      const gameShard = this.config.gameStart !== undefined || this.config.gameEnd !== undefined
        ? resolveGameSlotShard(totalGameSlots, this.config.gameStart, this.config.gameEnd)
        : null;

      const matchesConfig =
        checkpoint.experimentId === this.config.experimentId &&
        checkpoint.gamesPerMatchup === this.config.gamesPerMatchup &&
        checkpoint.matchupStart === shard.start &&
        checkpoint.matchupEnd === shard.end &&
        checkpoint.gameStart === gameShard?.start &&
        checkpoint.gameEnd === gameShard?.end;

      if (!matchesConfig) {
        console.warn(`[tournament] Ignoring incompatible checkpoint at ${this.checkpointPath}`);
        return null;
      }

      return checkpoint;
    }
    return null;
  }

  /**
   * Saves checkpoint to disk
   */
  private saveCheckpoint(checkpoint: Checkpoint): void {
    fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  private buildSlotKey(matchupIndex: number, gameIndex: number): string {
    return `exp${this.config.experimentId}_m${matchupIndex}_g${gameIndex}`;
  }

  private extractCompletedSlotKeys(gameIds: string[]): Set<string> {
    const slots = new Set<string>();

    for (const gameId of gameIds) {
      const match = gameId.match(/^exp(\d+)_m(\d+)_g(\d+)_/);
      if (!match) {
        continue;
      }

      const [, experimentId, matchupIndex, gameIndex] = match;
      if (Number.parseInt(experimentId, 10) !== this.config.experimentId) {
        continue;
      }

      slots.add(`exp${experimentId}_m${matchupIndex}_g${gameIndex}`);
    }

    return slots;
  }

  private resolveTournamentSlots(
    matchups: Matchup[],
    matchupShard: ReturnType<typeof resolveMatchupShard>,
    gameShard: ReturnType<typeof resolveGameSlotShard> | null
  ): TournamentSlot[] {
    const slots: TournamentSlot[] = [];
    if (gameShard) {
      for (let slotIndex = gameShard.start; slotIndex <= gameShard.end; slotIndex++) {
        const matchupIndex = Math.floor(slotIndex / this.config.gamesPerMatchup);
        const gameIndex = slotIndex % this.config.gamesPerMatchup;
        if (matchupIndex >= matchupShard.start && matchupIndex <= matchupShard.end) {
          slots.push({ matchupIndex, gameIndex });
        }
      }
      return slots;
    }

    for (let matchupIndex = matchupShard.start; matchupIndex <= matchupShard.end; matchupIndex++) {
      for (let gameIndex = 0; gameIndex < matchups[matchupIndex].games; gameIndex++) {
        slots.push({ matchupIndex, gameIndex });
      }
    }

    return slots;
  }

  private findNextPendingSlot(
    slots: TournamentSlot[],
    completedSlots: Set<string>
  ): TournamentSlot | null {
    for (const slot of slots) {
      if (!completedSlots.has(this.buildSlotKey(slot.matchupIndex, slot.gameIndex))) {
        return slot;
      }
    }

    return null;
  }

  private buildProgress(
    slots: TournamentSlot[],
    completedSlots: Set<string>
  ): TournamentProgress {
    const matchupIndexes = [...new Set(slots.map((slot) => slot.matchupIndex))];
    const completedMatchups = matchupIndexes.filter((matchupIndex) =>
      slots
        .filter((slot) => slot.matchupIndex === matchupIndex)
        .every((slot) => completedSlots.has(this.buildSlotKey(slot.matchupIndex, slot.gameIndex)))
    ).length;

    const totalGames = slots.length;
    const completedGames = completedSlots.size;

    return {
      totalMatchups: matchupIndexes.length,
      completedMatchups,
      totalGames,
      completedGames,
      percentComplete: totalGames > 0 ? (completedGames / totalGames) * 100 : 0,
    };
  }

  private getSnapshotPath(matchupIndex: number, gameIndex: number): string {
    return path.join(this.snapshotsDir, `${this.buildSlotKey(matchupIndex, gameIndex)}.snapshot.json`);
  }

  private saveGameSnapshot(matchupIndex: number, gameIndex: number, state: GameState): void {
    const filepath = this.getSnapshotPath(matchupIndex, gameIndex);
    const payload = {
      ...state,
      startTime: state.startTime.toISOString(),
      endTime: state.endTime?.toISOString(),
    };
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
  }

  private loadGameSnapshot(matchupIndex: number, gameIndex: number): GameState | null {
    const filepath = this.getSnapshotPath(matchupIndex, gameIndex);
    if (!fs.existsSync(filepath)) {
      return null;
    }

    const raw = JSON.parse(fs.readFileSync(filepath, 'utf-8')) as GameState & {
      startTime: string;
      endTime?: string;
    };

    return {
      ...raw,
      startTime: new Date(raw.startTime),
      endTime: raw.endTime ? new Date(raw.endTime) : undefined,
    };
  }

  private deleteGameSnapshot(matchupIndex: number, gameIndex: number): void {
    const filepath = this.getSnapshotPath(matchupIndex, gameIndex);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Simple hash function for seeding
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
