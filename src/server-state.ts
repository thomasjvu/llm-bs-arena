import { getCurrentPlayer } from './engine/game-state.js';
import { Card, GameState, Turn } from './types/game.js';

export interface ServerGameSnapshot {
  state: GameState;
  phase: 'waiting' | 'playing' | 'challenging' | 'finished';
  pendingTurn: Turn | null;
  challengeQueue: string[];
  humanPlayerId: string | null;
  hidePrivateState: boolean;
  provider: string;
}

export interface AwaitingHumanAction {
  type: 'play' | 'challenge';
  playerId: string;
  playerName: string;
  currentRank?: string;
  pendingPlay?: {
    playerId: string;
    modelId: string;
    displayName?: string;
    claimedCount: number;
    claimedRank: string;
  };
}

const MAX_CLIENT_TURNS = 100;

function formatCard(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function getPlayerLabel(player: { displayName?: string; modelId: string }): string {
  return player.displayName || player.modelId;
}

function getVisibleHand(game: ServerGameSnapshot, playerId: string, hand: Card[]): string[] {
  if (!game.hidePrivateState || game.humanPlayerId === playerId) {
    return hand.map(formatCard);
  }
  return [];
}

function sanitizeReasoning(game: ServerGameSnapshot, actorId: string | undefined, reasoning: string | undefined): string {
  if (!reasoning) {
    return '';
  }

  if (!game.hidePrivateState || !actorId || actorId === game.humanPlayerId) {
    return reasoning;
  }

  return '';
}

function sanitizeTurnForClient(game: ServerGameSnapshot, turn: Turn, allowPrivateCards: boolean): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    turnNumber: turn.turnNumber,
    playerId: turn.playerId,
    claimedRank: turn.claimedRank,
    claimedCount: turn.claimedCount,
    challenged: turn.challenged,
    challengerId: turn.challengerId,
    challengeCorrect: turn.challengeCorrect,
    reasoning: sanitizeReasoning(game, turn.playerId, turn.reasoning),
    challengeReasoning: sanitizeReasoning(game, turn.challengerId, turn.challengeReasoning),
    pileAfterTurn: turn.pileAfterTurn,
    handSizesAfterTurn: turn.handSizesAfterTurn,
    playResponseTimeMs: turn.playResponseTimeMs,
    playTokenUsage: turn.playTokenUsage,
    challengeResponseTimeMs: turn.challengeResponseTimeMs,
    challengeTokenUsage: turn.challengeTokenUsage,
    challengeOfferedTo: turn.challengeOfferedTo,
  };

  if (!game.hidePrivateState || turn.challenged || allowPrivateCards) {
    sanitized.actualCards = turn.actualCards;
    sanitized.wasLie = turn.wasLie;
  } else {
    sanitized.actualCards = [];
  }

  return sanitized;
}

export function getAwaitingHumanAction(game: ServerGameSnapshot): AwaitingHumanAction | null {
  if (!game.humanPlayerId) {
    return null;
  }

  const humanPlayer = game.state.players.find((player) => player.id === game.humanPlayerId);
  if (!humanPlayer) {
    return null;
  }

  if (game.phase === 'waiting' && getCurrentPlayer(game.state).id === humanPlayer.id) {
    return {
      type: 'play',
      playerId: humanPlayer.id,
      playerName: getPlayerLabel(humanPlayer),
      currentRank: game.state.currentRank,
    };
  }

  if (game.phase === 'challenging' && game.pendingTurn && game.challengeQueue[0] === humanPlayer.id) {
    const pendingPlayer = game.state.players.find((player) => player.id === game.pendingTurn?.playerId);
    return {
      type: 'challenge',
      playerId: humanPlayer.id,
      playerName: getPlayerLabel(humanPlayer),
      pendingPlay: {
        playerId: game.pendingTurn.playerId,
        modelId: pendingPlayer?.modelId || game.pendingTurn.playerId,
        displayName: pendingPlayer?.displayName,
        claimedCount: game.pendingTurn.claimedCount,
        claimedRank: game.pendingTurn.claimedRank,
      },
    };
  }

  return null;
}

export function buildClientGameState(game: ServerGameSnapshot) {
  const state = game.state;
  const awaitingHumanAction = getAwaitingHumanAction(game);

  let thinkingPlayerId: string | null = null;
  if (awaitingHumanAction) {
    thinkingPlayerId = null;
  } else if (game.phase === 'waiting') {
    thinkingPlayerId = getCurrentPlayer(state).id;
  } else if (game.phase === 'challenging' && game.challengeQueue.length > 0) {
    thinkingPlayerId = game.challengeQueue[0];
  }

  const totalTurns = state.turns.length;
  const recentTurns = totalTurns > MAX_CLIENT_TURNS
    ? state.turns.slice(totalTurns - MAX_CLIENT_TURNS)
    : state.turns;

  return {
    gameId: state.gameId,
    experimentId: state.experimentId,
    phase: game.phase,
    players: state.players.map((player, index) => ({
      id: player.id,
      modelId: player.modelId,
      displayName: player.displayName,
      role: player.role ?? 'model',
      hand: getVisibleHand(game, player.id, player.hand),
      handVisible: !game.hidePrivateState || game.humanPlayerId === player.id,
      handSize: player.hand.length,
      isActive: index === state.currentPlayerIndex,
      isEliminated: player.isEliminated,
    })),
    currentPlayerIndex: state.currentPlayerIndex,
    currentRank: state.currentRank,
    pile: state.pile.map(formatCard),
    pileSize: state.pile.length,
    turns: recentTurns.map((turn) => sanitizeTurnForClient(game, turn, false)),
    totalTurns,
    pendingTurn: game.pendingTurn
      ? sanitizeTurnForClient(game, game.pendingTurn, game.pendingTurn.playerId === game.humanPlayerId)
      : null,
    winner: state.winner,
    winnerName: state.winner
      ? getPlayerLabel(state.players.find((player) => player.id === state.winner) || { modelId: state.winner })
      : null,
    winnerModel: state.winner ? state.players.find((player) => player.id === state.winner)?.modelId : null,
    provider: game.provider,
    interactive: game.hidePrivateState,
    humanPlayerId: game.humanPlayerId,
    awaitingHumanAction,
    thinkingPlayerId,
  };
}
