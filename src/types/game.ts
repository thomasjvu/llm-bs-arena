export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type Suit = 'H' | 'D' | 'C' | 'S';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface Player {
  id: string;
  modelId: string;
  displayName?: string;
  role?: 'model' | 'human';
  hand: Card[];
  isEliminated: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface DecisionAttemptTrace {
  attempt: number;
  prompt: string;
  rawResponse: string;
  finishReason: string;
  parsed: boolean;
  wasRetry: boolean;
  wasTruncated: boolean;
  responseTimeMs: number;
  tokenUsage?: TokenUsage;
}

export interface DecisionTrace {
  systemPrompt: string;
  userPrompt: string;
  visibleContext: unknown;
  visibleContextHash: string;
  maxTokens?: number;
  estimatedPromptTokens?: number;
  promptBudgetTokens?: number;
  contextLimitExceeded?: boolean;
  rawResponse: string;
  parsedResponse: unknown;
  attempts: DecisionAttemptTrace[];
  retryCount: number;
  finishReason: string;
}

export interface InvalidDecisionRecord {
  terminationReason: 'context_limit' | 'provider_error' | 'parse_failure';
  decisionType: 'play' | 'challenge';
  turnNumber: number;
  playerId: string;
  modelId: string;
  actingPlayerId?: string;
  actingModelId?: string;
  decisionOrder?: number;
  systemPrompt?: string;
  userPrompt?: string;
  visibleContext?: unknown;
  visibleContextHash?: string;
  estimatedPromptTokens?: number;
  promptBudgetTokens?: number;
  contextLimitExceeded?: boolean;
  errorMessage: string;
}

export interface PublicChallengeHistoryDecision {
  playerId: string;
  modelId?: string;
  challenge: boolean;
  decisionOrder?: number;
}

export interface PublicTurnHistoryEntry {
  turnNumber: number;
  playerId: string;
  modelId?: string;
  claimedRank: Rank;
  claimedCount: number;
  challengeOfferedTo: string[];
  challengeDecisions?: PublicChallengeHistoryDecision[];
  challenged: boolean;
  challengerId?: string;
  challengerModelId?: string;
  challengeCorrect?: boolean;
  pileAfterTurn: number;
  handSizesAfterTurn: Record<string, number>;
  handCountsByModelAfterTurn: Record<string, number>;
}

export interface ChallengeDecision {
  playerId: string;
  modelId?: string;
  challenge: boolean;
  reasoning: string;
  decisionOrder?: number;
  responseTimeMs?: number;
  tokenUsage?: TokenUsage;
  tokenUsageIncomplete?: boolean;
  decisionTrace?: DecisionTrace;
}

export interface RunMetadata {
  logSchemaVersion: number;
  provider: string;
  providerBaseUrl?: string;
  promptVersion: string;
  promptHash: string;
  contextBudgetTokens?: number;
  playMaxTokens?: number;
  challengeMaxTokens?: number;
}

export interface Turn {
  turnNumber: number;
  playerId: string;
  modelId?: string;
  claimedRank: Rank;
  claimedCount: number;
  actualCards: Card[];
  wasLie: boolean;
  challengeOfferedTo?: string[];
  challengeDecisions?: ChallengeDecision[];
  challenged: boolean;
  challengerId?: string;
  challengerModelId?: string;
  challengeCorrect?: boolean;
  reasoning: string;
  challengeReasoning?: string;
  pileAfterTurn: number;
  handSizesAfterTurn: Record<string, number>;
  playResponseTimeMs?: number;
  playTokenUsage?: TokenUsage;
  playTokenUsageIncomplete?: boolean;
  playDecisionTrace?: DecisionTrace;
  challengeResponseTimeMs?: number;
  challengeTokenUsage?: TokenUsage;
  challengeTokenUsageIncomplete?: boolean;
}

export type ExperimentId = 0 | 1 | 2 | 3;

export const EXPERIMENT_NAMES: Record<ExperimentId, string> = {
  0: 'Control (Low-Strategy Reference)',
  1: 'Baseline (Deception Allowed)',
  2: 'Asymmetric Honesty Framing',
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
  terminationReason?: 'winner' | 'turn_cap' | 'context_limit' | 'provider_error' | 'parse_failure';
  invalidDecision?: InvalidDecisionRecord;
  startTime: Date;
  endTime?: Date;
}

export interface PlayTurnResponse {
  reasoning: string;
  cards_to_play: string[]; // e.g., ["AS", "2H"]
  claim_count: number; // must match cards_to_play.length
  responseTimeMs?: number;
  tokenUsage?: TokenUsage;
  tokenUsageIncomplete?: boolean;
  decisionTrace?: DecisionTrace;
}

export interface ChallengeResponse {
  reasoning: string;
  challenge: boolean;
  responseTimeMs?: number;
  tokenUsage?: TokenUsage;
  tokenUsageIncomplete?: boolean;
  decisionTrace?: DecisionTrace;
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
  truthfulAvailableTurns: number;
  truthfulUnavailableTurns: number;
  truthfulAvailableTurnShare: number;
  truthfulUnavailableTurnShare: number;
  optionalLies: number;
  optionalLieTurnShare: number;
  optionalLieRateGivenTruthfulAvailable: number;
  lateGamePlays: number;
  lateGameLies: number;
  lateGameBluffRate: number;
  challengesMade: number;
  challengeOpportunities: number;
  paranoiaFrequency: number;
  correctChallenges: number;
  challengeAccuracy: number;
  historyConditionedChallenges: number;
  historyConditionedCorrectChallenges: number;
  historyConditionedChallengeAccuracy: number;
  repeatedPlayerKnownLieOpportunities: number;
  repeatedPlayerKnownLieChallenges: number;
  repeatedPlayerCleanHistoryOpportunities: number;
  repeatedPlayerCleanHistoryChallenges: number;
  repeatedPlayerAdaptation: number;
  passDecisions: number;
  passRationaleNoRationale: number;
  passRationalePlausibleClaim: number;
  passRationaleRiskManagement: number;
  passRationaleInsufficientEvidence: number;
  passRationaleTrustOrPattern: number;
  passRationaleOther: number;
  instructionViolations?: number; // Legacy Experiment 3 overall-lie count for compatibility
  instructionViolationRate?: number; // Legacy Experiment 3 overall-lie rate for compatibility
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
  gameStart?: number;
  gameEnd?: number;
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
  terminationReason?: 'winner' | 'turn_cap' | 'context_limit' | 'provider_error' | 'parse_failure';
  invalidDecision?: InvalidDecisionRecord;
  totalTurns: number;
  startTime: string;
  endTime: string;
  durationMs: number;
}

export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS: Suit[] = ['H', 'D', 'C', 'S'];

export const MODELS = [
  'z-ai/glm-5.1',
  'google/gemma-4-31b-it',
  'nvidia/nemotron-3-super-120b-a12b',
  'moonshotai/kimi-k2.6',
  'minimaxai/minimax-m2.7',
  'deepseek-ai/deepseek-v4-flash',
] as const;

export type ModelId = typeof MODELS[number];

export const BASELINE_MODELS = [
  'baseline/scripted',
  'baseline/random-legal',
  'baseline/truthful-greedy',
] as const;

export type BaselineModelId = typeof BASELINE_MODELS[number];

export interface PlayerSeatConfig {
  modelId: string;
  displayName?: string;
  role?: 'model' | 'human';
}
