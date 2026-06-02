import { ExperimentId, GameState, Rank, RunMetadata } from '../types/game.js';

export type EnvPhase = 'play' | 'challenge' | 'finished';
export type EnvTerminationReason = NonNullable<GameState['terminationReason']>;

export interface BullshitEnvConfig {
  experimentId: ExperimentId;
  players: string[];
  seed?: number;
  maxTurns?: number;
  challengeOrder?: 'sequential';
  gameId?: string;
  metadata?: RunMetadata;
}

export interface ResetOptions {
  seed?: number;
  gameId?: string;
  metadata?: RunMetadata;
}

export interface PublicPlayerState {
  playerId: string;
  modelId: string;
  handSize: number;
  isCurrentPlayer: boolean;
  isExpectedActor: boolean;
}

export interface TurnSummary {
  turnNumber: number;
  playerId: string;
  modelId: string;
  claimedRank: Rank;
  claimedCount: number;
  challenged: boolean;
  challengerId?: string;
  challengerModelId?: string;
  challengeCorrect?: boolean;
  pileAfterTurn: number;
  handSizesAfterTurn: Record<string, number>;
}

export interface PendingPlaySummary {
  playerId: string;
  modelId: string;
  claimedRank: Rank;
  claimedCount: number;
  challengeOfferedTo: string[];
  challengeRemaining: string[];
}

export interface PublicState {
  gameId: string;
  experimentId: ExperimentId;
  seed?: number;
  maxTurns?: number;
  currentPlayerId: string;
  currentPlayerModelId: string;
  currentRank: Rank;
  pileSize: number;
  players: PublicPlayerState[];
  phase: EnvPhase;
  expectedActorId: string | null;
  expectedActorModelId: string | null;
  pendingPlay?: PendingPlaySummary;
  lastTurn?: TurnSummary;
  totalTurns: number;
  done: boolean;
  winnerId?: string | null;
  winnerModelId?: string | null;
  terminationReason?: EnvTerminationReason;
}

export interface OtherPlayerObservation {
  playerId: string;
  modelId: string;
  handSize: number;
}

export interface PlayerObservation {
  playerId: string;
  modelId: string;
  hand: string[];
  currentRank: Rank;
  pileSize: number;
  otherPlayers: OtherPlayerObservation[];
  recentTurns: TurnSummary[];
  phase: EnvPhase;
  expectedActorId: string | null;
  expectedActorModelId: string | null;
  pendingPlay?: PendingPlaySummary;
  isActingPlayer: boolean;
}

export interface PlayAction {
  type: 'play';
  playerId: string;
  cards: string[];
  claimCount: number;
  reasoning?: string;
}

export interface ChallengeAction {
  type: 'challenge';
  playerId: string;
  challenge: boolean;
  reasoning?: string;
}

export type EnvAction = PlayAction | ChallengeAction;

export interface EnvEvent {
  type: 'play_submitted' | 'challenge_declined' | 'challenge_made' | 'turn_resolved' | 'game_finished';
  actorId: string;
  pendingPlay?: PendingPlaySummary;
  turn?: TurnSummary;
  winnerId?: string | null;
  winnerModelId?: string | null;
  terminationReason?: EnvTerminationReason;
}

export interface ResetResult {
  publicState: PublicState;
  expectedActorId: string | null;
  phase: EnvPhase;
}

export interface StepResult {
  publicState: PublicState;
  event?: EnvEvent;
  advancedPhase: boolean;
  turnCompleted: boolean;
  done: boolean;
  winnerId?: string | null;
  winnerModelId?: string | null;
  terminationReason?: EnvTerminationReason;
}

export interface EnvResult {
  winnerId: string | null;
  winnerModelId: string | null;
  terminationReason: EnvTerminationReason | null;
  totalTurns: number;
  finalHandSizes: Record<string, number>;
  seed?: number;
  metadata?: RunMetadata;
}

export interface BullshitEnv {
  reset(resetOptions?: ResetOptions): ResetResult;
  observation(playerId: string): PlayerObservation;
  publicState(): PublicState;
  step(action: EnvAction): StepResult;
  done(): boolean;
  result(): EnvResult | null;
}

export interface PolicyAdapter {
  act(observation: PlayerObservation, publicState: PublicState): EnvAction;
}
