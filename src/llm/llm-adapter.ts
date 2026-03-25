import { PlayTurnResponse, ChallengeResponse, Card } from '../types/game.js';
import { FeatherlessClient } from './featherless-api.js';
import { ChutesClient } from './chutes-api.js';
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
import { Turn, Rank } from '../types/game.js';

interface VisibleState {
  hand: Card[];
  currentRank: Rank;
  pileSize: number;
  otherPlayersCounts: Record<string, number>;
  recentTurns: Turn[];
}

/**
 * Adapter that connects the game engine to the Featherless API.
 * Uses streaming for the first attempt when onToken is provided,
 * falls back to non-streaming for retries.
 */
export class FeatherlessLLMAdapter implements LLMAdapter {
  private client: FeatherlessClient;
  private maxRetries: number;

  constructor(client: FeatherlessClient, maxRetries: number = 4) {
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
    const systemPrompt = buildSystemPrompt(experimentId as 1 | 2 | 3);
    const userPrompt = buildPlayPrompt(
      visibleState.hand,
      visibleState.currentRank,
      visibleState.pileSize,
      visibleState.otherPlayersCounts,
      visibleState.recentTurns
    );

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    // First attempt: streaming if onToken provided
    const result = onToken
      ? await this.client.chatCompletionStream(modelId, messages, onToken)
      : await this.client.chatCompletion(modelId, messages);

    let lastResponse = result.content;
    let lastTruncated = result.finishReason === 'length';
    const parsed = parsePlayResponse(result.content);

    if (parsed) {
      parsed.responseTimeMs = result.responseTimeMs;
      parsed.tokenUsage = result.tokenUsage;
      return parsed;
    }

    if (lastTruncated) {
      console.warn(`[${modelId}] Response truncated, retrying with brevity hint...`);
    }

    // Retries: always non-streaming (to avoid double-streaming confusion)
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const retryPrompt = buildRetryPrompt(userPrompt, lastResponse, lastTruncated);
      const retryResult = await this.client.chatCompletion(modelId, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: retryPrompt },
      ]);

      lastResponse = retryResult.content;
      lastTruncated = retryResult.finishReason === 'length';
      const retryParsed = parsePlayResponse(retryResult.content);

      if (retryParsed) {
        retryParsed.responseTimeMs = retryResult.responseTimeMs;
        retryParsed.tokenUsage = retryResult.tokenUsage;
        return retryParsed;
      }

      if (lastTruncated) {
        console.warn(`[${modelId}] Response truncated on retry, retrying again...`);
      }
    }

    throw new Error(`[${modelId}] Failed to parse play response after ${this.maxRetries} retries`);
  }

  async getChallengeDecision(
    challengerId: string,
    modelId: string,
    visibleState: VisibleState,
    lastPlay: { playerId: string; claimedCount: number; claimedRank: string },
    experimentId: number,
    onToken?: (text: string) => void
  ): Promise<ChallengeResponse> {
    const systemPrompt = buildSystemPrompt(experimentId as 1 | 2 | 3);
    const userPrompt = buildChallengePrompt(
      visibleState.hand,
      visibleState.currentRank,
      visibleState.pileSize,
      visibleState.otherPlayersCounts,
      lastPlay,
      visibleState.recentTurns
    );

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    // First attempt: streaming if onToken provided
    const result = onToken
      ? await this.client.chatCompletionStream(modelId, messages, onToken)
      : await this.client.chatCompletion(modelId, messages);

    let lastResponse = result.content;
    let lastTruncated = result.finishReason === 'length';
    const parsed = parseChallengeResponse(result.content);

    if (parsed) {
      parsed.responseTimeMs = result.responseTimeMs;
      parsed.tokenUsage = result.tokenUsage;
      return parsed;
    }

    if (lastTruncated) {
      console.warn(`[${modelId}] Response truncated, retrying with brevity hint...`);
    }

    // Retries: always non-streaming
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const retryPrompt = buildRetryPrompt(userPrompt, lastResponse, lastTruncated);
      const retryResult = await this.client.chatCompletion(modelId, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: retryPrompt },
      ]);

      lastResponse = retryResult.content;
      lastTruncated = retryResult.finishReason === 'length';
      const retryParsed = parseChallengeResponse(retryResult.content);

      if (retryParsed) {
        retryParsed.responseTimeMs = retryResult.responseTimeMs;
        retryParsed.tokenUsage = retryResult.tokenUsage;
        return retryParsed;
      }
    }

    throw new Error(`[${modelId}] Failed to parse challenge response after ${this.maxRetries} retries`);
  }
}

export class ChutesLLMAdapter implements LLMAdapter {
  private client: ChutesClient;
  private maxRetries: number;

  constructor(client: ChutesClient, maxRetries: number = 4) {
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
    const systemPrompt = buildSystemPrompt(experimentId as 1 | 2 | 3);
    const userPrompt = buildPlayPrompt(
      visibleState.hand,
      visibleState.currentRank,
      visibleState.pileSize,
      visibleState.otherPlayersCounts,
      visibleState.recentTurns
    );

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const result = onToken
      ? await this.client.chatCompletionStream(modelId, messages, onToken)
      : await this.client.chatCompletion(modelId, messages);

    let lastResponse = result.content;
    let lastTruncated = result.finishReason === 'length';
    const parsed = parsePlayResponse(result.content);

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
      ]);

      lastResponse = retryResult.content;
      lastTruncated = retryResult.finishReason === 'length';
      const retryParsed = parsePlayResponse(retryResult.content);

      if (retryParsed) {
        retryParsed.responseTimeMs = retryResult.responseTimeMs;
        retryParsed.tokenUsage = retryResult.tokenUsage;
        return retryParsed;
      }

      if (lastTruncated) {
        console.warn(`[${modelId}] Response truncated on retry, retrying again...`);
      }
    }

    throw new Error(`[${modelId}] Failed to parse play response after ${this.maxRetries} retries`);
  }

  async getChallengeDecision(
    challengerId: string,
    modelId: string,
    visibleState: VisibleState,
    lastPlay: { playerId: string; claimedCount: number; claimedRank: string },
    experimentId: number,
    onToken?: (text: string) => void
  ): Promise<ChallengeResponse> {
    const systemPrompt = buildSystemPrompt(experimentId as 1 | 2 | 3);
    const userPrompt = buildChallengePrompt(
      visibleState.hand,
      visibleState.currentRank,
      visibleState.pileSize,
      visibleState.otherPlayersCounts,
      lastPlay,
      visibleState.recentTurns
    );

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const result = onToken
      ? await this.client.chatCompletionStream(modelId, messages, onToken)
      : await this.client.chatCompletion(modelId, messages);

    let lastResponse = result.content;
    let lastTruncated = result.finishReason === 'length';
    const parsed = parseChallengeResponse(result.content);

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
      ]);

      lastResponse = retryResult.content;
      lastTruncated = retryResult.finishReason === 'length';
      const retryParsed = parseChallengeResponse(retryResult.content);

      if (retryParsed) {
        retryParsed.responseTimeMs = retryResult.responseTimeMs;
        retryParsed.tokenUsage = retryResult.tokenUsage;
        return retryParsed;
      }
    }

    throw new Error(`[${modelId}] Failed to parse challenge response after ${this.maxRetries} retries`);
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
    // Simulate thinking time before response (1-2 seconds)
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

    // Simulate streaming with realistic token delays (avg 30-80ms per token)
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
    // Simulate thinking time before response (500-1500ms)
    await this.randomDelay(500, 1500);

    const adjustedChance = this.challengeChance + (lastPlay.claimedCount - 1) * 0.1;
    const shouldChallenge = Math.random() < adjustedChance;

    const reasoning = shouldChallenge
      ? `The last player claimed ${lastPlay.claimedCount} × ${lastPlay.claimedRank}, but this seems suspicious given the current game state. The probability of having exactly those cards is low, so I'll challenge.`
      : `The previous player's claim of ${lastPlay.claimedCount} × ${lastPlay.claimedRank} seems reasonable given the context. Challenging at this point would be risky, so I'll let it pass.`;

    // Simulate streaming with realistic token delays (avg 30-80ms per token)
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
