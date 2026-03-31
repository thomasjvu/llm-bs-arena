import { PlayTurnResponse, ChallengeResponse, Card, Turn, Rank, TokenUsage, RANKS } from '../types/game.js';
import { FeatherlessClient } from './featherless-api.js';
import { ChutesClient } from './chutes-api.js';
import { NimClient } from './nim-api.js';
import {
  buildSystemPrompt,
  buildPlayPrompt,
  buildChallengePrompt,
  buildRetryPrompt,
} from './prompt-builder.js';
import {
  parsePlayResponse,
  parseChallengeResponse,
} from './response-parser.js';
import { LLMAdapter } from '../engine/turn-manager.js';
import { MAX_CARDS_PER_PLAY } from '../engine/play-rules.js';

interface VisibleState {
  hand: Card[];
  currentRank: Rank;
  pileSize: number;
  otherPlayersCounts: Record<string, number>;
  recentTurns: Turn[];
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResult {
  content: string;
  tokenUsage: TokenUsage;
  responseTimeMs: number;
  finishReason: string;
}

interface OpenAICompatibleClient {
  chatCompletion(modelId: string, messages: ChatMessage[], maxTokens?: number): Promise<ChatCompletionResult>;
  chatCompletionStream(
    modelId: string,
    messages: ChatMessage[],
    onToken: (text: string) => void,
    maxTokens?: number
  ): Promise<ChatCompletionResult>;
}

type ParsedDecision = {
  responseTimeMs?: number;
  tokenUsage?: TokenUsage;
};

type ResponseParser<T extends ParsedDecision> = (response: string) => T | null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PLAY_MAX_TOKENS = parsePositiveInt(process.env.LLM_PLAY_MAX_TOKENS, 8192);
const CHALLENGE_MAX_TOKENS = parsePositiveInt(process.env.LLM_CHALLENGE_MAX_TOKENS, 4096);

class BaseLLMAdapter implements LLMAdapter {
  private client: OpenAICompatibleClient;
  private maxRetries: number;

  constructor(client: OpenAICompatibleClient, maxRetries: number = 4) {
    this.client = client;
    this.maxRetries = maxRetries;
  }

  async getPlayDecision(
    playerId: string,
    modelId: string,
    visibleState: VisibleState,
    experimentId: number,
    onToken?: (text: string) => void
  ): Promise<PlayTurnResponse> {
    const systemPrompt = buildSystemPrompt(experimentId as 0 | 1 | 2 | 3);
    const userPrompt = buildPlayPrompt(
      visibleState.hand,
      visibleState.currentRank,
      visibleState.pileSize,
      visibleState.otherPlayersCounts,
      visibleState.recentTurns
    );

    return this.requestStructuredResponse(
      modelId,
      systemPrompt,
      userPrompt,
      parsePlayResponse,
      onToken,
      PLAY_MAX_TOKENS
    );
  }

  async getChallengeDecision(
    challengerId: string,
    modelId: string,
    visibleState: VisibleState,
    lastPlay: { playerId: string; claimedCount: number; claimedRank: string },
    experimentId: number,
    onToken?: (text: string) => void
  ): Promise<ChallengeResponse> {
    const systemPrompt = buildSystemPrompt(experimentId as 0 | 1 | 2 | 3);
    const userPrompt = buildChallengePrompt(
      visibleState.hand,
      visibleState.currentRank,
      visibleState.pileSize,
      visibleState.otherPlayersCounts,
      lastPlay,
      visibleState.recentTurns
    );

    return this.requestStructuredResponse(
      modelId,
      systemPrompt,
      userPrompt,
      parseChallengeResponse,
      onToken,
      CHALLENGE_MAX_TOKENS
    );
  }

  private async requestStructuredResponse<T extends ParsedDecision>(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    parser: ResponseParser<T>,
    onToken?: (text: string) => void,
    maxTokens: number = PLAY_MAX_TOKENS
  ): Promise<T> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = onToken
      ? await this.client.chatCompletionStream(modelId, messages, onToken, maxTokens)
      : await this.client.chatCompletion(modelId, messages, maxTokens);

    let lastResponse = result.content;
    let lastTruncated = result.finishReason === 'length';
    const parsed = parser(result.content);

    if (parsed) {
      parsed.responseTimeMs = result.responseTimeMs;
      parsed.tokenUsage = result.tokenUsage;
      return parsed;
    }

    if (lastTruncated) {
      console.warn(`[${modelId}] Response truncated, retrying with brevity hint...`);
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const retryPrompt = buildRetryPrompt(userPrompt, lastResponse, lastTruncated);
      const retryResult = await this.client.chatCompletion(modelId, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: retryPrompt },
      ], maxTokens);

      lastResponse = retryResult.content;
      lastTruncated = retryResult.finishReason === 'length';
      const retryParsed = parser(retryResult.content);

      if (retryParsed) {
        retryParsed.responseTimeMs = retryResult.responseTimeMs;
        retryParsed.tokenUsage = retryResult.tokenUsage;
        return retryParsed;
      }

      if (lastTruncated) {
        console.warn(`[${modelId}] Response truncated on retry, retrying again...`);
      }
    }

    throw new Error(`[${modelId}] Failed to parse response after ${this.maxRetries} retries`);
  }
}

export class FeatherlessLLMAdapter extends BaseLLMAdapter {
  constructor(client: FeatherlessClient, maxRetries: number = 4) {
    super(client, maxRetries);
  }
}

export class ChutesLLMAdapter extends BaseLLMAdapter {
  constructor(client: ChutesClient, maxRetries: number = 4) {
    super(client, maxRetries);
  }
}

export class NimLLMAdapter extends BaseLLMAdapter {
  constructor(client: NimClient, maxRetries: number = 4) {
    super(client, maxRetries);
  }
}

/**
 * Mock adapter for testing without API calls
 */
export class MockLLMAdapter implements LLMAdapter {
  private lieChance: number;
  private challengeChance: number;

  constructor(lieChance: number = 0.3, challengeChance: number = 0.2) {
    this.lieChance = lieChance;
    this.challengeChance = challengeChance;
  }

  private async randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    await new Promise(r => setTimeout(r, delay));
  }

  async getPlayDecision(
    playerId: string,
    modelId: string,
    visibleState: VisibleState,
    experimentId: number,
    onToken?: (text: string) => void
  ): Promise<PlayTurnResponse> {
    await this.randomDelay(1000, 2000);

    const hand = visibleState.hand;
    const requiredRank = visibleState.currentRank;

    const matchingCards = hand.filter((c) => c.rank === requiredRank);

    let cardsToPlay: string[];
    let wasLie = false;

    if (matchingCards.length > 0 && Math.random() > this.lieChance) {
      cardsToPlay = matchingCards.slice(0, Math.min(matchingCards.length, 2)).map((c) => `${c.rank}${c.suit}`);
    } else {
      const randomCard = hand[Math.floor(Math.random() * hand.length)];
      cardsToPlay = [`${randomCard.rank}${randomCard.suit}`];
      wasLie = randomCard.rank !== requiredRank;
    }

    const reasoning = wasLie
      ? `I notice that I don't have the required ${requiredRank} cards. To maintain my position, I'll play a bluff strategy, claiming to have cards I actually don't possess.`
      : `I have ${matchingCards.length} ${requiredRank} card${matchingCards.length > 1 ? 's' : ''} in my hand. I'll play honestly with ${cardsToPlay.length} of them.`;

    if (onToken) {
      const tokens = reasoning.split(' ');
      for (const token of tokens) {
        onToken(token + ' ');
        await this.randomDelay(30, 80);
      }
    }

    const responseTimeMs = 1000 + Math.random() * 1000;

    return {
      reasoning,
      cards_to_play: cardsToPlay,
      claim_count: cardsToPlay.length,
      responseTimeMs,
    };
  }

  async getChallengeDecision(
    challengerId: string,
    modelId: string,
    visibleState: VisibleState,
    lastPlay: { playerId: string; claimedCount: number; claimedRank: string },
    experimentId: number,
    onToken?: (text: string) => void
  ): Promise<ChallengeResponse> {
    await this.randomDelay(500, 1500);

    const adjustedChance = this.challengeChance + (lastPlay.claimedCount - 1) * 0.1;
    const shouldChallenge = Math.random() < adjustedChance;

    const reasoning = shouldChallenge
      ? `The last player claimed ${lastPlay.claimedCount} × ${lastPlay.claimedRank}, but this seems suspicious given the current game state. The probability of having exactly those cards is low, so I'll challenge.`
      : `The previous player's claim of ${lastPlay.claimedCount} × ${lastPlay.claimedRank} seems reasonable given the context. Challenging at this point would be risky, so I'll let it pass.`;

    if (onToken) {
      const tokens = reasoning.split(' ');
      for (const token of tokens) {
        onToken(token + ' ');
        await this.randomDelay(30, 80);
      }
    }

    const responseTimeMs = 500 + Math.random() * 1000;

    return {
      reasoning,
      challenge: shouldChallenge,
      responseTimeMs,
    };
  }
}

const RANK_ORDER = new Map(RANKS.map((rank, index) => [rank, index]));
const SUIT_ORDER = new Map(['C', 'D', 'H', 'S'].map((suit, index) => [suit, index]));

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const rankDelta = (RANK_ORDER.get(a.rank) ?? 0) - (RANK_ORDER.get(b.rank) ?? 0);
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return (SUIT_ORDER.get(a.suit) ?? 0) - (SUIT_ORDER.get(b.suit) ?? 0);
  });
}

function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function countRankInHand(hand: Card[], rank: string): number {
  return hand.filter((card) => card.rank === rank).length;
}

export class ScriptedBaselineAdapter implements LLMAdapter {
  async getPlayDecision(
    _playerId: string,
    _modelId: string,
    visibleState: VisibleState,
    _experimentId: number
  ): Promise<PlayTurnResponse> {
    const hand = sortCards(visibleState.hand);
    const truthfulCards = hand.filter((card) => card.rank === visibleState.currentRank);

    if (truthfulCards.length > 0) {
      const cardsToPlay =
        hand.length <= MAX_CARDS_PER_PLAY
          ? truthfulCards.slice(0, Math.min(truthfulCards.length, MAX_CARDS_PER_PLAY))
          : truthfulCards.slice(0, Math.min(truthfulCards.length, 2));

      return {
        reasoning:
          `I have ${truthfulCards.length} ${visibleState.currentRank}(s), so I play truthfully ` +
          `with ${cardsToPlay.length} card${cardsToPlay.length === 1 ? '' : 's'}.`,
        cards_to_play: cardsToPlay.map(cardToString),
        claim_count: cardsToPlay.length,
      };
    }

    const rankCounts = new Map<string, number>();
    for (const card of hand) {
      rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
    }

    const bluffCard = [...hand].sort((a, b) => {
      const countDelta = (rankCounts.get(a.rank) ?? 0) - (rankCounts.get(b.rank) ?? 0);
      if (countDelta !== 0) {
        return countDelta;
      }
      const rankDelta = (RANK_ORDER.get(a.rank) ?? 0) - (RANK_ORDER.get(b.rank) ?? 0);
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return (SUIT_ORDER.get(a.suit) ?? 0) - (SUIT_ORDER.get(b.suit) ?? 0);
    })[0];

    return {
      reasoning:
        `I have no ${visibleState.currentRank}s, so I make the smallest legal bluff: one face-down card ` +
        `claimed as ${visibleState.currentRank}.`,
      cards_to_play: [cardToString(bluffCard)],
      claim_count: 1,
    };
  }

  async getChallengeDecision(
    _challengerId: string,
    _modelId: string,
    visibleState: VisibleState,
    lastPlay: { playerId: string; claimedCount: number; claimedRank: string },
    _experimentId: number
  ): Promise<ChallengeResponse> {
    const heldCount = countRankInHand(visibleState.hand, lastPlay.claimedRank);
    const accusedHandCount = visibleState.otherPlayersCounts[lastPlay.playerId];
    const mathematicallyImpossible = heldCount + lastPlay.claimedCount > 4;
    const aboutToWin = accusedHandCount !== undefined && accusedHandCount <= lastPlay.claimedCount;
    const largeClaim = lastPlay.claimedCount >= 3 && heldCount > 0;
    const riskyCloseout = aboutToWin && heldCount > 0;

    const shouldChallenge = mathematicallyImpossible || riskyCloseout || largeClaim;

    if (shouldChallenge) {
      return {
        reasoning:
          mathematicallyImpossible
            ? `I hold ${heldCount} ${lastPlay.claimedRank}(s), so a claim of ${lastPlay.claimedCount} is impossible.`
            : `The player is close to going out and the ${lastPlay.claimedCount}-card ${lastPlay.claimedRank} claim is risky enough to challenge.`,
        challenge: true,
      };
    }

    return {
      reasoning:
        `I cannot prove the ${lastPlay.claimedCount}-card ${lastPlay.claimedRank} claim is false, so I pass.`,
      challenge: false,
    };
  }
}
