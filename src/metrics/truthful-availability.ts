import { cardToString, createDeck, dealCards, shuffleDeck } from '../engine/deck.js';
import { GameLog } from '../types/game.js';

export interface TurnTruthfulAvailability {
  turnNumber: number;
  playerId: string;
  truthfulAvailable: boolean | null;
  truthfulAvailableCount: number | null;
  truthfulPlayUnavailable: boolean | null;
  optionalLie: boolean | null;
  truthfulPlay: boolean | null;
}

function cardRank(cardString: string): string {
  return cardString.slice(0, -1);
}

function replayInitialHands(game: GameLog): Map<string, string[]> | null {
  if (game.seed === undefined || game.seed === null) {
    return null;
  }

  if (!Array.isArray(game.players) || game.players.length === 0) {
    return null;
  }

  const deck = shuffleDeck(createDeck(), game.seed);
  const hands = dealCards(deck, game.players.length);
  return new Map(
    game.players.map((player, index) => [
      player.id,
      hands[index].map((card) => cardToString(card)),
    ])
  );
}

export function replayTurnTruthfulAvailability(game: GameLog): TurnTruthfulAvailability[] {
  const handsByPlayer = replayInitialHands(game);
  if (!handsByPlayer) {
    return game.turns.map((turn) => ({
      turnNumber: turn.turnNumber,
      playerId: turn.playerId,
      truthfulAvailable: null,
      truthfulAvailableCount: null,
      truthfulPlayUnavailable: null,
      optionalLie: null,
      truthfulPlay: null,
    }));
  }

  const pile: string[] = [];
  const replayed: TurnTruthfulAvailability[] = [];

  for (const turn of game.turns) {
    const hand = handsByPlayer.get(turn.playerId);
    if (!hand) {
      throw new Error(`Unable to replay truthful availability for ${game.gameId}: unknown player ${turn.playerId}`);
    }

    const truthfulAvailableCount = hand.filter((card) => cardRank(card) === turn.claimedRank).length;
    const truthfulAvailable = truthfulAvailableCount > 0;

    replayed.push({
      turnNumber: turn.turnNumber,
      playerId: turn.playerId,
      truthfulAvailable,
      truthfulAvailableCount,
      truthfulPlayUnavailable: !truthfulAvailable,
      optionalLie: turn.wasLie && truthfulAvailable,
      truthfulPlay: !turn.wasLie && truthfulAvailable,
    });

    for (const actualCard of turn.actualCards.map((card) => cardToString(card))) {
      const handIndex = hand.indexOf(actualCard);
      if (handIndex === -1) {
        throw new Error(
          `Unable to replay truthful availability for ${game.gameId} turn ${turn.turnNumber}: ` +
          `${actualCard} is not in ${turn.playerId}'s reconstructed hand`
        );
      }
      hand.splice(handIndex, 1);
      pile.push(actualCard);
    }

    if (turn.challenged) {
      const receiverId = turn.challengeCorrect ? turn.playerId : turn.challengerId;
      if (!receiverId) {
        throw new Error(
          `Unable to replay truthful availability for ${game.gameId} turn ${turn.turnNumber}: challenge receiver is missing`
        );
      }

      const receiverHand = handsByPlayer.get(receiverId);
      if (!receiverHand) {
        throw new Error(`Unable to replay truthful availability for ${game.gameId}: unknown challenge receiver ${receiverId}`);
      }

      receiverHand.push(...pile);
      pile.length = 0;
    }
  }

  return replayed;
}
