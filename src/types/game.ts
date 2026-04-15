export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type Suit = 'H' | 'D' | 'C' | 'S';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface Player {
  id: string;
  modelId: string;
  hand: Card[];
  isEliminated: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface RunMetadata {
  logSchemaVersion: number;
  provider: string;
  providerBaseUrl?: string;
  promptVersion: string;
  promptHash: string;
}

export interface Turn {
  turnNumber: number;
  playerId: string;
  claimedRank: Rank;
  claimedCount: number;
  actualCards: Card[];
  wasLie: boolean;
  challengeOfferedTo?: string[];
  challenged: boolean;
  challengerId?: string;
  challengeCorrect?: boolean;
  reasoning: string;
  challengeReasoning?: string;
  pileAfterTurn: number;
  handSizesAfterTurn: Record<string, number>;
  playResponseTimeMs?: number;
  playTokenUsage?: TokenUsage;
  challengeResponseTimeMs?: number;
  challengeTokenUsage?: TokenUsage;
}

export type ExperimentId = 0 | 1 | 2 | 3;

export const EXPERIMENT_NAMES: Record<ExperimentId, string> = {
  0: 'Control (Low-Strategy Reference)',
  1: 'Baseline (Deception Allowed)',
  2: 'Asymmetric Fairness',
  3: 'Honesty Mandate',
} as const;

export interface GameState {
  gameId: string;
  experimentId: ExperimentId;
  players: Player[];
  metadata?: RunMetadata;
  seatingOrder?: string[];
  seed?: number;
  maxTurns?: number;
  currentPlayerIndex: number;
  currentRank: Rank;
  pile: Card[];
  turns: Turn[];
  winner: string | null;
  terminationReason?: 'winner' | 'turn_cap';
  startTime: Date;
  endTime?: Date;
}

export interface PlayTurnResponse {
  reasoning: string;
  cards_to_play: string[]; // e.g., ["AS", "2H"]
  claim_count: number; // must match cards_to_play.length
  responseTimeMs?: number;
  tokenUsage?: TokenUsage;
}

export interface ChallengeResponse {
  reasoning: string;
  challenge: boolean;
  responseTimeMs?: number;
  tokenUsage?: TokenUsage;
}

export interface PlayerStats {
  modelId: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  totalPlays: number;
  totalLies: number;
  lieFrequency: number;
  successfulLies: number;
  lieSuccessRate: number;
  challengesMade: number;
  challengeOpportunities: number;
  paranoiaFrequency: number;
  correctChallenges: number;
  challengeAccuracy: number;
  instructionViolations?: number; // For experiment 3
  instructionViolationRate?: number;
}

export interface Matchup {
  players: string[]; // 4 model IDs
  games: number;
}

export interface TournamentConfig {
  experimentId: ExperimentId;
  models: string[];
  gamesPerMatchup: number;
  outputDir: string;
  maxTurns?: number;
  matchupStart?: number;
  matchupEnd?: number;
  gameRetryDelayMs?: number;
  maxGameFailuresPerSlot?: number;
}

export interface GameLog {
  gameId: string;
  experimentId: ExperimentId;
  players: { id: string; modelId: string }[];
  metadata?: RunMetadata;
  seatingOrder?: string[];
  seed?: number;
  maxTurns?: number;
  turns: Turn[];
  winner: string | null;
  terminationReason?: 'winner' | 'turn_cap';
  totalTurns: number;
  startTime: string;
  endTime: string;
  durationMs: number;
}

export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS: Suit[] = ['H', 'D', 'C', 'S'];

export const MODELS = [
  'qwen/qwen3.5-397b-a17b',
  'minimaxai/minimax-m2.5',
  'nvidia/nemotron-3-super-120b-a12b',
  'mistralai/mistral-small-4-119b-2603',
  'z-ai/glm5',
  'moonshotai/kimi-k2.5',
] as const;

export type ModelId = typeof MODELS[number];

export const BASELINE_MODELS = [
  'baseline/scripted',
  'baseline/random-legal',
  'baseline/truthful-greedy',
] as const;

export type BaselineModelId = typeof BASELINE_MODELS[number];
