import { Card } from '../types/game.js';
import { parseCard } from './deck.js';

export const MIN_CARDS_PER_PLAY = 1;
export const MAX_CARDS_PER_PLAY = 4;

export interface NormalizedPlaySelection {
  actualCards: Card[];
  claimedCount: number;
  notes: string[];
}

export function parsePlayableCards(cardStrings: string[], hand: Card[]): Card[] {
  const cards: Card[] = [];

  for (const cardStr of cardStrings) {
    const parsed = parseCard(cardStr);
    if (!parsed) {
      continue;
    }

    const handIndex = hand.findIndex(
      (card) =>
        card.rank === parsed.rank &&
        card.suit === parsed.suit &&
        !cards.some((used) => used.rank === card.rank && used.suit === card.suit)
    );

    if (handIndex !== -1) {
      cards.push(parsed);
    }
  }

  return cards;
}

export function normalizePlaySelection(
  cardStrings: string[],
  hand: Card[],
  requestedClaimCount?: number
): NormalizedPlaySelection {
  const notes: string[] = [];
  let actualCards = parsePlayableCards(cardStrings, hand);

  if (actualCards.length === 0 && hand.length > 0) {
    actualCards = [hand[0]];
    notes.push('No valid cards were returned, so the engine used the first card in hand.');
  }

  if (actualCards.length > MAX_CARDS_PER_PLAY) {
    actualCards = actualCards.slice(0, MAX_CARDS_PER_PLAY);
    notes.push(`The model tried to play more than ${MAX_CARDS_PER_PLAY} cards, so the play was truncated.`);
  }

  const claimedCount = actualCards.length;
  if (requestedClaimCount !== undefined && requestedClaimCount !== claimedCount) {
    notes.push('The claimed count did not match the number of face-down cards, so the engine used the actual card count.');
  }

  return { actualCards, claimedCount, notes };
}
