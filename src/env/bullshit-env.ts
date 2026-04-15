import { cardToString, parseCard } from '../engine/deck.js';
import {
  advanceTurn,
  checkWinner,
  createGameState,
  finalizeGame,
  getCurrentPlayer,
  getOtherPlayers,
  processChallenge,
  processPlay,
} from '../engine/game-state.js';
import { Card, GameState, Turn } from '../types/game.js';
import {
  BullshitEnv,
  BullshitEnvConfig,
  ChallengeAction,
  EnvAction,
  EnvEvent,
  EnvPhase,
  EnvResult,
  PendingPlaySummary,
  PlayerObservation,
  PublicPlayerState,
  PublicState,
  ResetOptions,
  ResetResult,
  StepResult,
  TurnSummary,
} from './types.js';

function buildGameId(experimentId: number): string {
  return `env_exp${experimentId}_${Date.now()}`;
}

function summarizeTurn(state: GameState, turn: Turn): TurnSummary {
  const player = state.players.find((entry) => entry.id === turn.playerId);
  const challenger = turn.challengerId
    ? state.players.find((entry) => entry.id === turn.challengerId)
    : undefined;

  return {
    turnNumber: turn.turnNumber,
    playerId: turn.playerId,
    modelId: player?.modelId || turn.playerId,
    claimedRank: turn.claimedRank,
    claimedCount: turn.claimedCount,
    challenged: turn.challenged,
    challengerId: turn.challengerId,
    challengerModelId: challenger?.modelId,
    challengeCorrect: turn.challengeCorrect,
    pileAfterTurn: turn.pileAfterTurn,
    handSizesAfterTurn: { ...turn.handSizesAfterTurn },
  };
}

function summarizePendingPlay(state: GameState, turn: Turn, challengeQueue: string[]): PendingPlaySummary {
  const player = state.players.find((entry) => entry.id === turn.playerId);
  return {
    playerId: turn.playerId,
    modelId: player?.modelId || turn.playerId,
    claimedRank: turn.claimedRank,
    claimedCount: turn.claimedCount,
    challengeOfferedTo: [...(turn.challengeOfferedTo || [])],
    challengeRemaining: [...challengeQueue],
  };
}

function strictParseCards(cardStrings: string[], hand: Card[]): Card[] {
  const selected: Card[] = [];

  for (const cardString of cardStrings) {
    const parsed = parseCard(cardString);
    if (!parsed) {
      throw new Error(`Invalid card string: ${cardString}`);
    }

    const handIndex = hand.findIndex(
      (card) =>
        card.rank === parsed.rank &&
        card.suit === parsed.suit &&
        !selected.some((chosen) => chosen.rank === parsed.rank && chosen.suit === parsed.suit)
    );

    if (handIndex === -1) {
      throw new Error(`Card ${cardString} is not available in the acting player's hand`);
    }

    selected.push(parsed);
  }

  return selected;
}

export class BullshitEnvController implements BullshitEnv {
  private state: GameState | null = null;
  private phase: EnvPhase = 'finished';
  private pendingTurn: Turn | null = null;
  private challengeQueue: string[] = [];

  constructor(private readonly config: BullshitEnvConfig) {
    if (config.players.length !== 4) {
      throw new Error(`BullshitEnv requires exactly 4 players, got ${config.players.length}`);
    }

    if (config.challengeOrder && config.challengeOrder !== 'sequential') {
      throw new Error(`BullshitEnv only supports sequential challenge order, got ${config.challengeOrder}`);
    }
  }

  reset(resetOptions: ResetOptions = {}): ResetResult {
    const seed = resetOptions.seed ?? this.config.seed;
    const gameId = resetOptions.gameId || this.config.gameId || buildGameId(this.config.experimentId);
    const state = createGameState(gameId, this.config.experimentId, [...this.config.players], seed);
    state.maxTurns = this.config.maxTurns;
    state.metadata = resetOptions.metadata ?? this.config.metadata;

    this.state = state;
    this.phase = 'play';
    this.pendingTurn = null;
    this.challengeQueue = [];

    return {
      publicState: this.publicState(),
      expectedActorId: this.expectedActorId(),
      phase: this.phase,
    };
  }

  observation(playerId: string): PlayerObservation {
    const state = this.requireState();
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) {
      throw new Error(`Unknown player: ${playerId}`);
    }

    return {
      playerId: player.id,
      modelId: player.modelId,
      hand: player.hand.map(cardToString),
      currentRank: state.currentRank,
      pileSize: state.pile.length,
      otherPlayers: state.players
        .filter((entry) => entry.id !== playerId)
        .map((entry) => ({
          playerId: entry.id,
          modelId: entry.modelId,
          handSize: entry.hand.length,
        })),
      recentTurns: state.turns.slice(-5).map((turn) => summarizeTurn(state, turn)),
      phase: this.phase,
      expectedActorId: this.expectedActorId(),
      expectedActorModelId: this.expectedActorModelId(),
      pendingPlay: this.pendingTurn ? summarizePendingPlay(state, this.pendingTurn, this.challengeQueue) : undefined,
      isActingPlayer: this.expectedActorId() === playerId,
    };
  }

  publicState(): PublicState {
    const state = this.requireState();
    const currentPlayer = getCurrentPlayer(state);
    const expectedActorId = this.expectedActorId();

    return {
      gameId: state.gameId,
      experimentId: state.experimentId,
      seed: state.seed,
      maxTurns: state.maxTurns,
      currentPlayerId: currentPlayer.id,
      currentPlayerModelId: currentPlayer.modelId,
      currentRank: state.currentRank,
      pileSize: state.pile.length,
      players: state.players.map((player, index): PublicPlayerState => ({
        playerId: player.id,
        modelId: player.modelId,
        handSize: player.hand.length,
        isCurrentPlayer: index === state.currentPlayerIndex,
        isExpectedActor: player.id === expectedActorId,
      })),
      phase: this.phase,
      expectedActorId,
      expectedActorModelId: this.expectedActorModelId(),
      pendingPlay: this.pendingTurn ? summarizePendingPlay(state, this.pendingTurn, this.challengeQueue) : undefined,
      lastTurn: state.turns.length > 0 ? summarizeTurn(state, state.turns[state.turns.length - 1]) : undefined,
      totalTurns: state.turns.length,
      done: this.done(),
      winnerId: state.winner,
      winnerModelId: state.winner ? state.players.find((player) => player.id === state.winner)?.modelId || null : null,
      terminationReason: state.terminationReason,
    };
  }

  step(action: EnvAction): StepResult {
    const state = this.requireState();
    if (this.phase === 'finished') {
      throw new Error('Cannot step a finished environment; call reset() to start a new game');
    }

    const expectedActorId = this.expectedActorId();
    if (!expectedActorId) {
      throw new Error(`No actor is available for phase ${this.phase}`);
    }

    if (action.playerId !== expectedActorId) {
      throw new Error(
        `Action player ${action.playerId} does not match the expected actor ${expectedActorId} for phase ${this.phase}`
      );
    }

    if (this.phase === 'play') {
      return this.stepPlay(action);
    }

    return this.stepChallenge(action as ChallengeAction);
  }

  done(): boolean {
    return this.phase === 'finished';
  }

  result(): EnvResult | null {
    const state = this.requireState();
    if (!this.done()) {
      return null;
    }

    const winnerModelId =
      state.winner ? state.players.find((player) => player.id === state.winner)?.modelId || null : null;

    return {
      winnerId: state.winner,
      winnerModelId,
      terminationReason: state.terminationReason || null,
      totalTurns: state.turns.length,
      finalHandSizes: Object.fromEntries(state.players.map((player) => [player.id, player.hand.length])),
      seed: state.seed,
      metadata: state.metadata,
    };
  }

  private stepPlay(action: EnvAction): StepResult {
    const state = this.requireState();

    if (action.type !== 'play') {
      throw new Error(`Expected a play action during play phase, got ${action.type}`);
    }

    const player = state.players.find((entry) => entry.id === action.playerId);
    if (!player) {
      throw new Error(`Unknown player for play action: ${action.playerId}`);
    }

    const actualCards = strictParseCards(action.cards, player.hand);
    const turn = processPlay(state, action.playerId, actualCards, action.claimCount, action.reasoning ?? '');
    turn.challengeOfferedTo = getOtherPlayers(state).map((entry) => entry.id);

    this.pendingTurn = turn;
    this.challengeQueue = [...(turn.challengeOfferedTo || [])];
    this.phase = 'challenge';

    const pendingPlay = summarizePendingPlay(state, turn, this.challengeQueue);
    return this.buildStepResult(
      {
        type: 'play_submitted',
        actorId: action.playerId,
        pendingPlay,
      },
      true,
      false
    );
  }

  private stepChallenge(action: ChallengeAction): StepResult {
    const state = this.requireState();
    const pendingTurn = this.requirePendingTurn();

    if (action.type !== 'challenge') {
      throw new Error(`Expected a challenge action during challenge phase, got ${action.type}`);
    }

    if (this.challengeQueue.length === 0) {
      throw new Error('Challenge phase has no remaining challengers');
    }

    const actingChallenger = this.challengeQueue.shift()!;
    if (action.playerId !== actingChallenger) {
      throw new Error(`Challenge action player ${action.playerId} does not match queued challenger ${actingChallenger}`);
    }

    if (action.challenge) {
      processChallenge(state, pendingTurn, action.playerId, action.reasoning ?? '');
      return this.resolveTurn({
        type: 'challenge_made',
        actorId: action.playerId,
        pendingPlay: summarizePendingPlay(state, pendingTurn, this.challengeQueue),
      });
    }

    if (this.challengeQueue.length > 0) {
      return this.buildStepResult(
        {
          type: 'challenge_declined',
          actorId: action.playerId,
          pendingPlay: summarizePendingPlay(state, pendingTurn, this.challengeQueue),
        },
        true,
        false
      );
    }

    return this.resolveTurn({
      type: 'challenge_declined',
      actorId: action.playerId,
      pendingPlay: summarizePendingPlay(state, pendingTurn, this.challengeQueue),
    });
  }

  private resolveTurn(event: EnvEvent): StepResult {
    const state = this.requireState();
    const turn = this.requirePendingTurn();

    advanceTurn(state, turn);
    const winner = checkWinner(state);

    if (winner) {
      finalizeGame(state, winner);
      this.phase = 'finished';
    } else if (state.maxTurns !== undefined && state.turns.length >= state.maxTurns) {
      state.winner = null;
      state.terminationReason = 'turn_cap';
      state.endTime = new Date();
      this.phase = 'finished';
    } else {
      this.phase = 'play';
    }

    this.pendingTurn = null;
    this.challengeQueue = [];

    const resolvedTurn = summarizeTurn(state, turn);
    const resolvedEvent: EnvEvent = {
      ...(this.done()
        ? {
            type: 'game_finished',
            actorId: event.actorId,
            turn: resolvedTurn,
            winnerId: state.winner,
            winnerModelId: state.winner
              ? state.players.find((player) => player.id === state.winner)?.modelId || null
              : null,
            terminationReason: state.terminationReason,
          }
        : {
            type: 'turn_resolved',
            actorId: event.actorId,
            turn: resolvedTurn,
          }),
    };

    return this.buildStepResult(resolvedEvent, true, true);
  }

  private buildStepResult(event: EnvEvent, advancedPhase: boolean, turnCompleted: boolean): StepResult {
    const state = this.requireState();
    return {
      publicState: this.publicState(),
      event,
      advancedPhase,
      turnCompleted,
      done: this.done(),
      winnerId: state.winner,
      winnerModelId: state.winner ? state.players.find((player) => player.id === state.winner)?.modelId || null : null,
      terminationReason: state.terminationReason,
    };
  }

  private expectedActorId(): string | null {
    const state = this.requireState();
    if (this.phase === 'play') {
      return getCurrentPlayer(state).id;
    }
    if (this.phase === 'challenge') {
      return this.challengeQueue[0] ?? null;
    }
    return null;
  }

  private expectedActorModelId(): string | null {
    const state = this.requireState();
    const actorId = this.expectedActorId();
    if (!actorId) {
      return null;
    }
    return state.players.find((player) => player.id === actorId)?.modelId || null;
  }

  private requireState(): GameState {
    if (!this.state) {
      throw new Error('Environment is not initialized; call reset() before using it');
    }
    return this.state;
  }

  private requirePendingTurn(): Turn {
    if (!this.pendingTurn) {
      throw new Error('No pending turn is available');
    }
    return this.pendingTurn;
  }
}

export function createBullshitEnv(config: BullshitEnvConfig): BullshitEnv {
  return new BullshitEnvController(config);
}
