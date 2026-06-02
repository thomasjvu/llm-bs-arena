import { GameState, Turn, Card, PlayTurnResponse, ChallengeResponse, InvalidDecisionRecord } from '../types/game.js';
import {
  getCurrentPlayer,
  getOtherPlayers,
  processPlay,
  processChallenge,
  advanceTurn,
  checkWinner,
  finalizeGame,
  getVisibleState,
  getVisibleStateWithPileSize,
} from './game-state.js';
import { normalizePlaySelection } from './play-rules.js';
import { ContextLimitError } from '../llm/context-budget.js';

export interface LLMAdapter {
  getPlayDecision(
    playerId: string,
    modelId: string,
    visibleState: ReturnType<typeof getVisibleState>,
    experimentId: number,
    onToken?: (text: string) => void
  ): Promise<PlayTurnResponse>;

  getChallengeDecision(
    challengerId: string,
    modelId: string,
    visibleState: ReturnType<typeof getVisibleState>,
    lastPlay: {
      playerId: string;
      claimedCount: number;
      claimedRank: string;
      actingPlayerId?: string;
      decisionOrder?: number;
    },
    experimentId: number,
    onToken?: (text: string) => void
  ): Promise<ChallengeResponse>;
}

export interface TurnManagerConfig {
  maxTurns?: number; // Optional safety cap for debugging/recovery runs
  challengeOrder: 'sequential' | 'random';
}

const DEFAULT_CONFIG: TurnManagerConfig = {
  challengeOrder: 'sequential',
};

function invalidDecisionFromContextLimit(error: ContextLimitError, state: GameState): InvalidDecisionRecord {
  const details = error.details;
  const latestTurn = state.turns[state.turns.length - 1];
  const turnNumber = details.decisionType === 'challenge'
    ? latestTurn?.turnNumber ?? state.turns.length + 1
    : state.turns.length + 1;

  return {
    terminationReason: 'context_limit',
    decisionType: details.decisionType,
    turnNumber,
    playerId: details.playerId,
    modelId: details.modelId,
    actingPlayerId: details.actingPlayerId,
    actingModelId: details.actingModelId,
    decisionOrder: details.decisionOrder,
    systemPrompt: details.systemPrompt,
    userPrompt: details.userPrompt,
    visibleContext: details.visibleContext,
    visibleContextHash: details.visibleContextHash,
    estimatedPromptTokens: details.estimatedPromptTokens,
    promptBudgetTokens: details.promptBudgetTokens,
    contextLimitExceeded: true,
    errorMessage: error.message,
  };
}

/**
 * Manages the turn flow of a Bullshit game
 */
export class TurnManager {
  private config: TurnManagerConfig;

  constructor(config: Partial<TurnManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (
      this.config.maxTurns !== undefined &&
      (!Number.isInteger(this.config.maxTurns) || this.config.maxTurns <= 0)
    ) {
      throw new Error(`TurnManager maxTurns must be a positive integer, got: ${this.config.maxTurns}`);
    }
  }

  /**
   * Runs a complete game until someone wins or an optional safety cap is reached.
   */
  async runGame(state: GameState, llm: LLMAdapter): Promise<GameState> {
    return this.runGameWithCallback(state, llm);
  }

  async runGameWithCallback(
    state: GameState,
    llm: LLMAdapter,
    onTurnComplete?: (state: GameState) => void | Promise<void>
  ): Promise<GameState> {
    state.maxTurns = this.config.maxTurns;

    while (!state.winner && (this.config.maxTurns === undefined || state.turns.length < this.config.maxTurns)) {
      try {
        await this.executeTurn(state, llm);
      } catch (error) {
        if (error instanceof ContextLimitError) {
          state.winner = null;
          state.terminationReason = 'context_limit';
          state.invalidDecision = invalidDecisionFromContextLimit(error, state);
          state.endTime = new Date();
          if (onTurnComplete) {
            await onTurnComplete(state);
          }
          return state;
        }
        throw error;
      }
      if (onTurnComplete) {
        await onTurnComplete(state);
      }

      const winner = checkWinner(state);
      if (winner) {
        finalizeGame(state, winner);
        break;
      }
    }

    if (
      !state.winner &&
      this.config.maxTurns !== undefined &&
      state.turns.length >= this.config.maxTurns
    ) {
      // Capped games are explicitly incomplete/censored, not heuristic wins.
      state.winner = null;
      state.terminationReason = 'turn_cap';
      state.endTime = new Date();
    }

    return state;
  }

  /**
   * Executes a single turn including challenge window
   */
  async executeTurn(state: GameState, llm: LLMAdapter): Promise<Turn> {
    const currentPlayer = getCurrentPlayer(state);
    const visibleState = getVisibleState(state, currentPlayer.id);

    const playResponse = await llm.getPlayDecision(
      currentPlayer.id,
      currentPlayer.modelId,
      visibleState,
      state.experimentId
    );

    const normalizedPlay = normalizePlaySelection(
      playResponse.cards_to_play,
      currentPlayer.hand,
      playResponse.claim_count
    );
    for (const note of normalizedPlay.notes) {
      console.warn(`[turn] ${currentPlayer.modelId}: ${note}`);
    }

    const turn = processPlay(
      state,
      currentPlayer.id,
      normalizedPlay.actualCards,
      normalizedPlay.claimedCount,
      playResponse.reasoning
    );
    turn.playResponseTimeMs = playResponse.responseTimeMs;
    turn.playTokenUsage = playResponse.tokenUsage;
    turn.playTokenUsageIncomplete = playResponse.tokenUsageIncomplete;
    turn.playDecisionTrace = playResponse.decisionTrace;

    const otherPlayers = getOtherPlayers(state);
    const challengeOrder =
      this.config.challengeOrder === 'random' ? this.shuffleArray(otherPlayers) : otherPlayers;

    for (const [decisionIndex, challenger] of challengeOrder.entries()) {
      turn.challengeOfferedTo?.push(challenger.id);
      const challengerVisibleState = getVisibleStateWithPileSize(
        state,
        challenger.id,
        state.pile.length - turn.actualCards.length
      );

      let challengeResponse: ChallengeResponse;
      try {
        challengeResponse = await llm.getChallengeDecision(
          challenger.id,
          challenger.modelId,
          challengerVisibleState,
          {
            playerId: currentPlayer.modelId,
            actingPlayerId: currentPlayer.id,
            claimedCount: turn.claimedCount,
            claimedRank: turn.claimedRank,
            decisionOrder: decisionIndex,
          },
          state.experimentId
        );
      } catch (error) {
        if (error instanceof ContextLimitError && !state.turns.includes(turn)) {
          state.turns.push(turn);
        }
        throw error;
      }
      turn.challengeDecisions ??= [];
      turn.challengeDecisions.push({
        playerId: challenger.id,
        modelId: challenger.modelId,
        challenge: challengeResponse.challenge,
        reasoning: challengeResponse.reasoning,
        decisionOrder: decisionIndex,
        responseTimeMs: challengeResponse.responseTimeMs,
        tokenUsage: challengeResponse.tokenUsage,
        tokenUsageIncomplete: challengeResponse.tokenUsageIncomplete,
        decisionTrace: challengeResponse.decisionTrace,
      });

      if (challengeResponse.challenge) {
        turn.challengeResponseTimeMs = challengeResponse.responseTimeMs;
        turn.challengeTokenUsage = challengeResponse.tokenUsage;
        turn.challengeTokenUsageIncomplete = challengeResponse.tokenUsageIncomplete;
        processChallenge(state, turn, challenger.id, challengeResponse.reasoning);
        break; // Only one challenge per turn
      }
    }

    advanceTurn(state, turn);
    return turn;
  }
  /**
   * Fisher-Yates shuffle for challenge order randomization
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
