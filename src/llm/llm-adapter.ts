import {
  PlayTurnResponse,
  ChallengeResponse,
  Card,
  Rank,
  TokenUsage,
  PublicTurnHistoryEntry,
  DecisionTrace,
  DecisionAttemptTrace,
} from '../types/game.js';
import { NimClient } from './nim-api.js';
import { VeniceClient } from './venice-api.js';
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
import { LocalPolicyLLMAdapter } from '../baselines/index.js';
import {
  assertWithinContextBudget,
  DecisionContextMetadata,
  resolveContextBudgetTokens,
} from './context-budget.js';

interface VisibleState {
  hand: Card[];
  currentRank: Rank;
  pileSize: number;
  otherPlayersCounts: Record<string, number>;
  recentTurns: PublicTurnHistoryEntry[];
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResult {
  content: string;
  tokenUsage?: TokenUsage;
  responseTimeMs: number;
  finishReason: string;
  providerKeyAlias?: string;
  providerRequestAttempt?: number;
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
  tokenUsageIncomplete?: boolean;
  decisionTrace?: DecisionTrace;
};

type ResponseParser<T extends ParsedDecision> = (response: string) => T | null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const PLAY_MAX_TOKENS = parsePositiveInt(process.env.LLM_PLAY_MAX_TOKENS, 4096);
export const CHALLENGE_MAX_TOKENS = parsePositiveInt(process.env.LLM_CHALLENGE_MAX_TOKENS, 4096);

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const MOCK_MIN_DELAY_MS = parseNonNegativeInt(process.env.MOCK_LLM_MIN_DELAY_MS, 1000);
const MOCK_MAX_DELAY_MS = Math.max(
  MOCK_MIN_DELAY_MS,
  parseNonNegativeInt(process.env.MOCK_LLM_MAX_DELAY_MS, 2000)
);

function combineTokenUsage(usages: Array<TokenUsage | undefined>): TokenUsage | undefined {
  const present = usages.filter((usage): usage is TokenUsage => Boolean(usage));
  if (present.length === 0) return undefined;

  return present.reduce<TokenUsage>(
    (total, usage) => ({
      promptTokens: total.promptTokens + usage.promptTokens,
      completionTokens: total.completionTokens + usage.completionTokens,
      totalTokens: total.totalTokens + usage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
}

function parsedDecisionPayload(response: ParsedDecision): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(response)) {
    if (
      key !== 'responseTimeMs' &&
      key !== 'tokenUsage' &&
      key !== 'tokenUsageIncomplete' &&
      key !== 'decisionTrace'
    ) {
      payload[key] = value;
    }
  }
  return payload;
}

class BaseLLMAdapter implements LLMAdapter {
  private client: OpenAICompatibleClient;
  private maxRetries: number;
  private contextBudgetTokens?: number;
  private providerName: string;

  constructor(
    client: OpenAICompatibleClient,
    maxRetries: number = 4,
    contextBudgetTokens?: number,
    providerName: string = 'nim'
  ) {
    this.client = client;
    this.maxRetries = maxRetries;
    this.contextBudgetTokens = contextBudgetTokens;
    this.providerName = providerName;
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
      {
        decisionType: 'play',
        playerId,
        modelId,
        actingPlayerId: playerId,
        actingModelId: modelId,
      },
      onToken,
      PLAY_MAX_TOKENS,
      visibleState
    );
  }

  async getChallengeDecision(
    challengerId: string,
    modelId: string,
    visibleState: VisibleState,
    lastPlay: {
      playerId: string;
      claimedCount: number;
      claimedRank: string;
      actingPlayerId?: string;
      decisionOrder?: number;
    },
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
      {
        decisionType: 'challenge',
        playerId: challengerId,
        modelId,
        actingPlayerId: lastPlay.actingPlayerId,
        actingModelId: lastPlay.playerId,
        decisionOrder: lastPlay.decisionOrder,
      },
      onToken,
      CHALLENGE_MAX_TOKENS,
      {
        ...visibleState,
        lastPlay,
      }
    );
  }

  private async requestStructuredResponse<T extends ParsedDecision>(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    parser: ResponseParser<T>,
    decisionMetadata: DecisionContextMetadata,
    onToken?: (text: string) => void,
    maxTokens: number = PLAY_MAX_TOKENS,
    visibleContext: unknown = {}
  ): Promise<T> {
    const usageParts: Array<TokenUsage | undefined> = [];
    let responseTimeMs = 0;
    const attempts: DecisionAttemptTrace[] = [];
    const promptBudgetTokens = resolveContextBudgetTokens(this.providerName, modelId, this.contextBudgetTokens);
    const contextDetails = assertWithinContextBudget(
      decisionMetadata,
      systemPrompt,
      userPrompt,
      visibleContext,
      promptBudgetTokens
    );
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = onToken
      ? await this.client.chatCompletionStream(modelId, messages, onToken, maxTokens)
      : await this.client.chatCompletion(modelId, messages, maxTokens);
    usageParts.push(result.tokenUsage);
    responseTimeMs += result.responseTimeMs;

    let lastResponse = result.content;
    let lastTruncated = result.finishReason === 'length';
    const parsed = parser(result.content);
    attempts.push({
      attempt: 0,
      prompt: userPrompt,
      rawResponse: result.content,
      finishReason: result.finishReason,
      parsed: Boolean(parsed),
      wasRetry: false,
      wasTruncated: lastTruncated,
      responseTimeMs: result.responseTimeMs,
      tokenUsage: result.tokenUsage,
      providerKeyAlias: result.providerKeyAlias,
      providerRequestAttempt: result.providerRequestAttempt,
    });

    if (parsed && !lastTruncated) {
      parsed.responseTimeMs = responseTimeMs;
      parsed.tokenUsage = combineTokenUsage(usageParts);
      parsed.tokenUsageIncomplete = usageParts.some((usage) => !usage);
      parsed.decisionTrace = {
        systemPrompt,
        userPrompt,
        visibleContext,
        visibleContextHash: contextDetails.visibleContextHash,
        maxTokens,
        estimatedPromptTokens: contextDetails.estimatedPromptTokens,
        promptBudgetTokens: contextDetails.promptBudgetTokens,
        contextLimitExceeded: false,
        rawResponse: result.content,
        parsedResponse: parsedDecisionPayload(parsed),
        attempts,
        retryCount: 0,
        finishReason: result.finishReason,
      };
      return parsed;
    }

    if (lastTruncated) {
      console.warn(`[${modelId}] Response truncated, retrying with JSON-only brevity hint...`);
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const retryPrompt = buildRetryPrompt(userPrompt, lastResponse, lastTruncated);
      const retryResult = await this.client.chatCompletion(modelId, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: retryPrompt },
      ], maxTokens);
      usageParts.push(retryResult.tokenUsage);
      responseTimeMs += retryResult.responseTimeMs;

      lastResponse = retryResult.content;
      lastTruncated = retryResult.finishReason === 'length';
      const retryParsed = parser(retryResult.content);
      attempts.push({
        attempt,
        prompt: retryPrompt,
        rawResponse: retryResult.content,
        finishReason: retryResult.finishReason,
        parsed: Boolean(retryParsed),
        wasRetry: true,
        wasTruncated: lastTruncated,
        responseTimeMs: retryResult.responseTimeMs,
        tokenUsage: retryResult.tokenUsage,
        providerKeyAlias: retryResult.providerKeyAlias,
        providerRequestAttempt: retryResult.providerRequestAttempt,
      });

      if (retryParsed && !lastTruncated) {
        retryParsed.responseTimeMs = responseTimeMs;
        retryParsed.tokenUsage = combineTokenUsage(usageParts);
        retryParsed.tokenUsageIncomplete = usageParts.some((usage) => !usage);
        retryParsed.decisionTrace = {
          systemPrompt,
          userPrompt,
          visibleContext,
          visibleContextHash: contextDetails.visibleContextHash,
          maxTokens,
          estimatedPromptTokens: contextDetails.estimatedPromptTokens,
          promptBudgetTokens: contextDetails.promptBudgetTokens,
          contextLimitExceeded: false,
          rawResponse: retryResult.content,
          parsedResponse: parsedDecisionPayload(retryParsed),
          attempts,
          retryCount: attempt,
          finishReason: retryResult.finishReason,
        };
        return retryParsed;
      }

      if (lastTruncated) {
        console.warn(`[${modelId}] Response truncated on retry, retrying again...`);
      }
    }

    throw new Error(`[${modelId}] Failed to parse response after ${this.maxRetries} retries`);
  }
}

export class NimLLMAdapter extends BaseLLMAdapter {
  constructor(client: NimClient, maxRetries: number = 4, contextBudgetTokens?: number, providerName: string = 'nim') {
    super(client, maxRetries, contextBudgetTokens, providerName);
  }
}

export class VeniceLLMAdapter extends BaseLLMAdapter {
  constructor(client: VeniceClient, maxRetries: number = 4, contextBudgetTokens?: number, providerName: string = 'venice') {
    super(client, maxRetries, contextBudgetTokens, providerName);
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
    const effectiveMin = Math.min(minMs, MOCK_MIN_DELAY_MS);
    const effectiveMax = Math.min(maxMs, MOCK_MAX_DELAY_MS);
    const delay = effectiveMin + Math.random() * Math.max(0, effectiveMax - effectiveMin);
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

export class ScriptedBaselineAdapter extends LocalPolicyLLMAdapter {}

export class RandomLegalBaselineAdapter extends LocalPolicyLLMAdapter {}

export class TruthfulGreedyBaselineAdapter extends LocalPolicyLLMAdapter {}
