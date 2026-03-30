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
} from './matchup-generator.js';

interface Checkpoint {
  experimentId: ExperimentId;
  gamesPerMatchup: number;
  matchupStart: number;
  matchupEnd: number;
  matchupIndex: number;
  gameIndex: number;
  completedGames: string[];
  timestamp: string;
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
  private runMetadata?: RunMetadata;
  private checkpointPrefix: string;

  constructor(config: TournamentConfig, llmAdapter: LLMAdapter, runMetadata?: RunMetadata) {
    this.config = config;
    this.llmAdapter = llmAdapter;
    this.runMetadata = runMetadata;
    this.turnManager = new TurnManager({ maxTurns: config.maxTurns });
    this.logsDir = path.join(config.outputDir, 'games');
    this.checkpointPrefix = `checkpoint_exp${config.experimentId}`;
    this.checkpointPath = path.join(config.outputDir, `${this.checkpointPrefix}.json`);

    // Ensure directories exist
    fs.mkdirSync(this.logsDir, { recursive: true });
  }

  /**
   * Runs the full tournament with checkpoint/resume support
   */
  async run(onProgress?: (progress: TournamentProgress) => void): Promise<void> {
    const matchups = generateMatchups(this.config.models, this.config.gamesPerMatchup);
    const shard = resolveMatchupShard(matchups.length, this.config.matchupStart, this.config.matchupEnd);
    this.checkpointPath = path.join(
      this.config.outputDir,
      `${this.checkpointPrefix}_m${shard.label}.json`
    );
    const checkpoint = this.loadCheckpoint();

    let startMatchup = checkpoint?.matchupIndex ?? shard.start;
    let startGame = checkpoint?.gameIndex || 0;
    const completedGames = [...(checkpoint?.completedGames || [])];

    console.log(`Starting experiment ${this.config.experimentId}`);
    console.log(`Total matchups in experiment: ${matchups.length}`);
    console.log(`Shard matchups: ${shard.start}-${shard.end} (${shard.count} matchups)`);
    console.log(`Games per matchup: ${this.config.gamesPerMatchup}`);
    console.log(`Total games in shard: ${shard.count * this.config.gamesPerMatchup}`);

    if (checkpoint) {
      console.log(`Resuming from matchup ${startMatchup}, game ${startGame}`);
    }

    for (let m = startMatchup; m <= shard.end; m++) {
      const matchup = matchups[m];
      const gameStart = m === startMatchup ? startGame : 0;

      for (let g = gameStart; g < matchup.games; g++) {
        const gameId = generateGameId(this.config.experimentId, m, g);
        const seed = hashString(`${this.config.experimentId}:${m}:${g}`);

        try {
          const gameLog = await this.runSingleGame(matchup, gameId, seed);
          this.saveGameLog(gameLog);
          completedGames.push(gameId);

          // Update checkpoint
          this.saveCheckpoint({
            experimentId: this.config.experimentId,
            gamesPerMatchup: this.config.gamesPerMatchup,
            matchupStart: shard.start,
            matchupEnd: shard.end,
            matchupIndex: m,
            gameIndex: g + 1,
            completedGames,
            timestamp: new Date().toISOString(),
          });

          // Report progress
          if (onProgress) {
            const progress = calculateProgress(
              m - shard.start,
              g + 1,
              shard.count,
              this.config.gamesPerMatchup
            );
            onProgress(progress);
          }

          console.log(
            formatTournamentGameCompletion(
              gameLog,
              ((m - shard.start) * matchup.games + g + 1) / (shard.count * matchup.games) * 100
            )
          );
        } catch (error) {
          console.error(`Error in game ${gameId}:`, error);
          // Continue to next game
        }
      }
    }

    console.log(`Experiment ${this.config.experimentId} completed!`);
  }

  /**
   * Runs a single game
   */
  async runSingleGame(matchup: Matchup, gameId: string, seed: number): Promise<GameLog> {
    // Randomize seating order
    const players = shuffleSeating(matchup.players, seed);

    // Create game state
    const state = createGameState(gameId, this.config.experimentId, players, seed);
    state.metadata = this.runMetadata;

    // Run the game
    const startTime = Date.now();
    const finalState = await this.turnManager.runGame(state, this.llmAdapter);
    const endTime = Date.now();

    // Convert to log format
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

      const matchesConfig =
        checkpoint.experimentId === this.config.experimentId &&
        checkpoint.gamesPerMatchup === this.config.gamesPerMatchup &&
        checkpoint.matchupStart === shard.start &&
        checkpoint.matchupEnd === shard.end;

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
