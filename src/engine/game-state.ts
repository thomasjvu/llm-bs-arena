import { Card, GameState, Player, Rank, Turn, ExperimentId, RANKS, PlayerSeatConfig } from '../types/game.js';
import { createDeck, shuffleDeck, dealCards } from './deck.js';
import { MAX_CARDS_PER_PLAY, MIN_CARDS_PER_PLAY } from './play-rules.js';

type PlayerSeatInput = string | PlayerSeatConfig;

function normalizePlayerSeat(seat: PlayerSeatInput): PlayerSeatConfig {
  if (typeof seat === 'string') {
    return { modelId: seat, role: 'model' };
  }

  return {
    modelId: seat.modelId,
    displayName: seat.displayName,
    role: seat.role ?? 'model',
  };
}

/**
 * Creates a new game state with dealt hands
 */
export function createGameState(
  gameId: string,
  experimentId: ExperimentId,
  seats: PlayerSeatInput[],
  seed?: number
): GameState {
  if (seats.length !== 4) {
    throw new Error('Bullshit requires exactly 4 players');
  }

  const deck = shuffleDeck(createDeck(), seed);
  const hands = dealCards(deck, 4);
  const normalizedSeats = seats.map(normalizePlayerSeat);

  const players: Player[] = normalizedSeats.map((seat, index) => ({
    id: `player_${index}`,
    modelId: seat.modelId,
    displayName: seat.displayName,
    role: seat.role ?? 'model',
    hand: hands[index],
    isEliminated: false,
  }));

  const startingPlayerIndex = players.findIndex((player) =>
    player.hand.some((card) => card.rank === 'A' && card.suit === 'S')
  );

  return {
    gameId,
    experimentId,
    players,
    seatingOrder: normalizedSeats.map((seat) => seat.modelId),
    seed,
    currentPlayerIndex: startingPlayerIndex >= 0 ? startingPlayerIndex : 0,
    currentRank: 'A',
    pile: [],
    turns: [],
    winner: null,
    startTime: new Date(),
  };
}

/**
 * Gets the next rank in sequence (K wraps to A)
 */
export function getNextRank(currentRank: Rank): Rank {
  const index = RANKS.indexOf(currentRank);
  return RANKS[(index + 1) % RANKS.length];
}

/**
 * Gets the current player
 */
export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

/**
 * Gets all players except the current one (for challenge window)
 */
export function getOtherPlayers(state: GameState): Player[] {
  return state.players.filter((_, i) => i !== state.currentPlayerIndex && !state.players[i].isEliminated);
}

/**
 * Removes cards from a player's hand
 */
export function removeCardsFromHand(player: Player, cards: Card[]): void {
  for (const card of cards) {
    const index = player.hand.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
    if (index !== -1) {
      player.hand.splice(index, 1);
    }
  }
}

/**
 * Adds cards to a player's hand
 */
export function addCardsToHand(player: Player, cards: Card[]): void {
  player.hand.push(...cards);
}

/**
 * Processes a play action (before challenge window)
 */
export function processPlay(
  state: GameState,
  playerId: string,
  actualCards: Card[],
  claimedCount: number,
  reasoning: string
): Turn {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player ${playerId} not found`);
  }

  if (actualCards.length < MIN_CARDS_PER_PLAY || actualCards.length > MAX_CARDS_PER_PLAY) {
    throw new Error(
      `Players must place between ${MIN_CARDS_PER_PLAY} and ${MAX_CARDS_PER_PLAY} cards, got: ${actualCards.length}`
    );
  }

  if (claimedCount !== actualCards.length) {
    throw new Error(`Claimed count must match the number of face-down cards, got ${claimedCount} for ${actualCards.length} card(s)`);
  }

  for (const card of actualCards) {
    const hasCard = player.hand.some((c) => c.rank === card.rank && c.suit === card.suit);
    if (!hasCard) {
      throw new Error(`Player ${playerId} does not have card ${card.rank}${card.suit}`);
    }
  }

  const wasLie = actualCards.some((card) => card.rank !== state.currentRank);

  removeCardsFromHand(player, actualCards);
  state.pile.push(...actualCards);

  const turn: Turn = {
    turnNumber: state.turns.length + 1,
    playerId,
    claimedRank: state.currentRank,
    claimedCount,
    actualCards,
    wasLie,
    challengeOfferedTo: [],
    challengeDecisions: [],
    challenged: false,
    reasoning,
    pileAfterTurn: state.pile.length,
    handSizesAfterTurn: Object.fromEntries(state.players.map((p) => [p.id, p.hand.length])),
  };

  return turn;
}

/**
 * Processes a challenge
 */
export function processChallenge(
  state: GameState,
  turn: Turn,
  challengerId: string,
  challengeReasoning: string
): void {
  const challenger = state.players.find((p) => p.id === challengerId);
  const playedBy = state.players.find((p) => p.id === turn.playerId);

  if (!challenger || !playedBy) {
    throw new Error('Invalid challenger or player');
  }

  turn.challenged = true;
  turn.challengerId = challengerId;
  turn.challengeReasoning = challengeReasoning;

  turn.challengeCorrect = turn.wasLie;

  if (turn.wasLie) {
    addCardsToHand(playedBy, state.pile);
  } else {
    addCardsToHand(challenger, state.pile);
  }

  state.pile = [];

  turn.handSizesAfterTurn = Object.fromEntries(state.players.map((p) => [p.id, p.hand.length]));
}

/**
 * Advances to the next turn
 */
export function advanceTurn(state: GameState, turn: Turn): void {
  state.turns.push(turn);
  state.currentRank = getNextRank(state.currentRank);

  do {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  } while (state.players[state.currentPlayerIndex].isEliminated);
}

/**
 * Checks if the game is over (someone has empty hand)
 */
export function checkWinner(state: GameState): string | null {
  for (const player of state.players) {
    if (player.hand.length === 0 && !player.isEliminated) {
      return player.id;
    }
  }
  return null;
}

/**
 * Finalizes the game
 */
export function finalizeGame(state: GameState, winnerId: string): void {
  state.winner = winnerId;
  state.terminationReason = 'winner';
  state.endTime = new Date();
}

/**
 * Gets visible game info for a player (hides other hands)
 */
export function getVisibleState(state: GameState, playerId: string): {
  hand: Card[];
  currentRank: Rank;
  pileSize: number;
  otherPlayersCounts: Record<string, number>;
  recentTurns: Turn[];
} {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player ${playerId} not found`);
  }

  const otherPlayersCounts: Record<string, number> = {};
  for (const p of state.players) {
    if (p.id !== playerId && !p.isEliminated) {
      otherPlayersCounts[p.modelId] = p.hand.length;
    }
  }

  const recentTurns = state.turns.slice(-5);

  return {
    hand: player.hand,
    currentRank: state.currentRank,
    pileSize: state.pile.length,
    otherPlayersCounts,
    recentTurns,
  };
}
