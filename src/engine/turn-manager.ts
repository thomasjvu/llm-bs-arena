import { GameState, Turn, Card, PlayTurnResponse, ChallengeResponse } from '../types/game.js';
import {
  getCurrentPlayer,
  getOtherPlayers,
  processPlay,
  processChallenge,
  advanceTurn,
  checkWinner,
  finalizeGame,
  getVisibleState,
} from './game-state.js';
import { normalizePlaySelection } from './play-rules.js';

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
    lastPlay: { playerId: string; claimedCount: number; claimedRank: string },
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
    state.maxTurns = this.config.maxTurns;

    while (!state.winner && (this.config.maxTurns === undefined || state.turns.length < this.config.maxTurns)) {
      await this.executeTurn(state, llm);

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

    // Get play decision from LLM
    const playResponse = await llm.getPlayDecision(
      currentPlayer.id,
      currentPlayer.modelId,
      visibleState,
      state.experimentId
    );

    // Parse cards from response
    const normalizedPlay = normalizePlaySelection(
      playResponse.cards_to_play,
      currentPlayer.hand,
      playResponse.claim_count
    );
    for (const note of normalizedPlay.notes) {
      console.warn(`[turn] ${currentPlayer.modelId}: ${note}`);
    }

    // Create turn
    const turn = processPlay(
      state,
      currentPlayer.id,
      normalizedPlay.actualCards,
      normalizedPlay.claimedCount,
      playResponse.reasoning
    );

    // Challenge window - each other player gets a chance
    const otherPlayers = getOtherPlayers(state);
    const challengeOrder =
      this.config.challengeOrder === 'random' ? this.shuffleArray(otherPlayers) : otherPlayers;

    for (const challenger of challengeOrder) {
      turn.challengeOfferedTo?.push(challenger.id);
      const challengerVisibleState = getVisibleState(state, challenger.id);

      const challengeResponse = await llm.getChallengeDecision(
        challenger.id,
        challenger.modelId,
        challengerVisibleState,
        {
          playerId: currentPlayer.modelId,
          claimedCount: turn.claimedCount,
          claimedRank: turn.claimedRank,
        },
        state.experimentId
      );

      if (challengeResponse.challenge) {
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
