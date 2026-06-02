import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createDeck, shuffleDeck, dealCards, parseCard, cardToString, countRank } from '../engine/deck.js';
import {
  createGameState,
  getNextRank,
  getCurrentPlayer,
  processPlay,
  processChallenge,
  checkWinner,
} from '../engine/game-state.js';
import { TurnManager, LLMAdapter } from '../engine/turn-manager.js';
import {
  combinations,
  createTournamentConfig,
  generateMatchups,
  resolveGameSlotShard,
  resolveMatchupShard,
  shuffleSeating,
} from '../tournament/matchup-generator.js';
import { formatTournamentGameCompletion, TournamentRunner } from '../tournament/tournament-runner.js';
import { calculatePlayerStats, calculateParanoia, calculateCompareStatsRows } from '../metrics/player-stats.js';
import { replayTurnTruthfulAvailability } from '../metrics/truthful-availability.js';
import { parsePlayResponse, parseChallengeResponse, extractJSON } from '../llm/response-parser.js';
import { MODELS, BASELINE_MODELS, RANKS, Card, GameLog, PublicTurnHistoryEntry, DecisionTrace } from '../types/game.js';
import { GameLogger, selectComparableGameCohort, buildCohortManifest } from '../logging/game-logger.js';
import { CSVExporter } from '../logging/csv-exporter.js';
import { ResilientLLMAdapter, buildRunMetadata } from '../llm/provider.js';
import { APIConnectionError as NimAPIConnectionError, NimClient, NonRetryableAPIError } from '../llm/nim-api.js';
import { MAX_CARDS_PER_PLAY } from '../engine/play-rules.js';
import { NimLLMAdapter, ScriptedBaselineAdapter, PLAY_MAX_TOKENS, CHALLENGE_MAX_TOKENS } from '../llm/llm-adapter.js';
import {
  buildChallengePrompt,
  buildPlayPrompt,
  buildPromptProtocolCorpus,
  buildSystemPrompt,
  hashPromptProtocol,
  PROMPT_VERSION,
} from '../llm/prompt-builder.js';
import { assertOutputCohortCompatible } from '../tournament/output-guard.js';
import { ContextLimitError } from '../llm/context-budget.js';
import { auditV3Logs } from '../logging/v3-log-audit.js';

describe('Deck', () => {
  it('should create a standard 52-card deck with 4 of each rank', () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
    for (const rank of RANKS) {
      const count = deck.filter((c) => c.rank === rank).length;
      expect(count).toBe(4);
    }
  });

  it('should shuffle deterministically with seed', () => {
    const deck1 = shuffleDeck(createDeck(), 42);
    const deck2 = shuffleDeck(createDeck(), 42);
    expect(deck1).toEqual(deck2);
  });

  it('should shuffle differently with different seeds', () => {
    const deck1 = shuffleDeck(createDeck(), 42);
    const deck2 = shuffleDeck(createDeck(), 123);
    expect(deck1).not.toEqual(deck2);
  });

  it('should deal 13 cards to 4 players', () => {
    const deck = createDeck();
    const hands = dealCards(deck, 4);

    expect(hands.length).toBe(4);
    for (const hand of hands) {
      expect(hand.length).toBe(13);
    }
  });

  it('should parse, stringify, and count cards correctly', () => {
    expect(parseCard('AS')).toEqual({ rank: 'A', suit: 'S' });
    expect(parseCard('10H')).toEqual({ rank: '10', suit: 'H' });
    expect(parseCard('KD')).toEqual({ rank: 'K', suit: 'D' });
    expect(parseCard('invalid')).toBeNull();
    expect(cardToString({ rank: 'A', suit: 'S' })).toBe('AS');
    expect(cardToString({ rank: '10', suit: 'H' })).toBe('10H');
    const hand: Card[] = [
      { rank: 'A', suit: 'S' },
      { rank: 'A', suit: 'H' },
      { rank: 'K', suit: 'D' },
    ];
    expect(countRank(hand, 'A')).toBe(2);
    expect(countRank(hand, 'K')).toBe(1);
    expect(countRank(hand, 'Q')).toBe(0);
  });
});

describe('GameState', () => {
  it('should create a valid initial game state', () => {
    const models = ['model1', 'model2', 'model3', 'model4'];
    const state = createGameState('test-game', 1, models);

    expect(state.players.length).toBe(4);
    for (const player of state.players) {
      expect(player.hand.length).toBe(13);
    }
    expect(state.currentRank).toBe('A');
    expect(state.pile.length).toBe(0);
    expect(state.winner).toBeNull();
  });

  it('should preserve seat metadata for human and model players', () => {
    const state = createGameState('interactive-game', 1, [
      { modelId: 'human/player', displayName: 'you', role: 'human' },
      { modelId: 'model-a' },
      { modelId: 'model-b', displayName: 'model bee' },
      { modelId: 'model-c' },
    ], 7);

    const humanPlayer = state.players.find((player) => player.modelId === 'human/player');
    expect(humanPlayer?.role).toBe('human');
    expect(humanPlayer?.displayName).toBe('you');
    expect(state.players.find((player) => player.modelId === 'model-b')?.displayName).toBe('model bee');
    expect(state.seatingOrder).toEqual(['human/player', 'model-a', 'model-b', 'model-c']);
  });

  it('should start with the player holding the Ace of Spades', () => {
    const models = ['model1', 'model2', 'model3', 'model4'];
    const state = createGameState('test-game', 1, models, 42);
    const startingPlayer = state.players[state.currentPlayerIndex];

    expect(startingPlayer.hand.some((card) => card.rank === 'A' && card.suit === 'S')).toBe(true);
    expect(state.currentRank).toBe('A');
  });

  it('should cycle ranks correctly', () => {
    expect(getNextRank('A')).toBe('2');
    expect(getNextRank('K')).toBe('A');
    expect(getNextRank('10')).toBe('J');
  });

  it('should deal deterministic hands with the same seed', () => {
    const models = ['model1', 'model2', 'model3', 'model4'];
    const stateA = createGameState('game-a', 1, models, 42);
    const stateB = createGameState('game-b', 1, models, 42);

    const handsA = stateA.players.map((player) => player.hand.map(cardToString));
    const handsB = stateB.players.map((player) => player.hand.map(cardToString));

    expect(handsA).toEqual(handsB);
  });

  it('should detect win when hand is empty', () => {
    const models = ['model1', 'model2', 'model3', 'model4'];
    const state = createGameState('test-game', 1, models);

    state.players[0].hand = [];

    const winner = checkWinner(state);
    expect(winner).toBe('player_0');
  });

  it('should process a play correctly', () => {
    const models = ['model1', 'model2', 'model3', 'model4'];
    const state = createGameState('test-game', 1, models, 42);

    const player = getCurrentPlayer(state);
    const cardToPlay = player.hand[0];
    const initialHandSize = player.hand.length;

    const turn = processPlay(state, player.id, [cardToPlay], 1, 'Test reasoning');

    expect(player.hand.length).toBe(initialHandSize - 1);
    expect(state.pile.length).toBe(1);
    expect(turn.actualCards).toContainEqual(cardToPlay);
  });

  it('should resolve challenge correctly when player lied', () => {
    const models = ['model1', 'model2', 'model3', 'model4'];
    const state = createGameState('test-game', 1, models, 42);

    const player = state.players[0];
    const wrongCard = player.hand.find((c) => c.rank !== state.currentRank);

    if (wrongCard) {
      const turn = processPlay(state, player.id, [wrongCard], 1, 'Lying');
      expect(turn.wasLie).toBe(true);

      const challenger = state.players[1];
      const pileSize = state.pile.length;

      processChallenge(state, turn, challenger.id, 'Calling bullshit');

      expect(turn.challenged).toBe(true);
      expect(turn.challengeCorrect).toBe(true);
      expect(player.hand.length).toBeGreaterThan(12);
      expect(state.pile.length).toBe(0);
      expect(turn.pileAfterTurn).toBe(0);
    }
  });

  it('should resolve challenge correctly when player told the truth', () => {
    const models = ['model1', 'model2', 'model3', 'model4'];
    const state = createGameState('test-game', 1, models, 42);
    const player = state.players[0];
    const challenger = state.players[1];
    const truthfulCard = { rank: 'A', suit: 'S' } as const;

    state.currentRank = 'A';
    player.hand = [truthfulCard];
    challenger.hand = [{ rank: 'K', suit: 'D' }];

    const initialPlayerHand = player.hand.length;
    const initialChallengerHand = challenger.hand.length;
    const turn = processPlay(state, player.id, [truthfulCard], 1, 'Truthful play');

    processChallenge(state, turn, challenger.id, 'Bad challenge');

    expect(turn.wasLie).toBe(false);
    expect(turn.challengeCorrect).toBe(false);
    expect(player.hand.length).toBe(initialPlayerHand - 1);
    expect(challenger.hand.length).toBe(initialChallengerHand + 1);
    expect(state.pile.length).toBe(0);
    expect(turn.pileAfterTurn).toBe(0);
  });

  it('should reject plays above the four-card maximum', () => {
    const models = ['model1', 'model2', 'model3', 'model4'];
    const state = createGameState('test-game', 1, models, 42);
    const player = state.players[0];

    player.hand = [
      { rank: 'A', suit: 'S' },
      { rank: '2', suit: 'S' },
      { rank: '3', suit: 'S' },
      { rank: '4', suit: 'S' },
      { rank: '5', suit: 'S' },
    ];

    expect(() =>
      processPlay(state, player.id, player.hand.slice(0, 5), 5, 'Impossible five-card dump')
    ).toThrow(/between 1 and 4 cards/);
  });

  it('should reject claim counts that differ from the number of face-down cards', () => {
    const models = ['model1', 'model2', 'model3', 'model4'];
    const state = createGameState('test-game', 1, models, 42);
    const player = state.players[0];

    expect(() =>
      processPlay(state, player.id, [player.hand[0]], 2, 'Count lies are not allowed')
    ).toThrow(/Claimed count must match/);
  });
});

describe('TurnManager', () => {
  it('should run a complete game with a deterministic local adapter', async () => {
    const adapter: LLMAdapter = {
      async getPlayDecision(_playerId, _modelId, visibleState) {
        const card = visibleState.hand[0];
        return {
          reasoning: 'Play the first available card.',
          cards_to_play: [cardToString(card)],
          claim_count: 1,
        };
      },
      async getChallengeDecision() {
        return {
          reasoning: 'Never challenge in this scripted test.',
          challenge: false,
        };
      },
    };

    const state = createGameState('integration-game', 1, ['m1', 'm2', 'm3', 'm4'], 99);
    const turnManager = new TurnManager();
    const finalState = await turnManager.runGame(state, adapter);

    expect(finalState.winner).not.toBeNull();
    expect(finalState.turns.length).toBeGreaterThan(0);
    expect(finalState.turns.length).toBeLessThanOrEqual(52);
    expect(finalState.turns.every((turn) => turn.challengeOfferedTo?.length === 3)).toBe(true);
    expect(finalState.endTime).toBeDefined();
    expect(finalState.terminationReason).toBe('winner');
    expect(finalState.maxTurns).toBeUndefined();
  });

  it('should mark games that end due to the turn cap', async () => {
    const adapter: LLMAdapter = {
      async getPlayDecision() {
        return {
          reasoning: 'Always play the first card.',
          cards_to_play: ['AS'],
          claim_count: 1,
        };
      },
      async getChallengeDecision() {
        return {
          reasoning: 'Never challenge.',
          challenge: false,
        };
      },
    };

    const state = createGameState('turn-cap-game', 1, ['m1', 'm2', 'm3', 'm4'], 42);
    const turnManager = new TurnManager({ maxTurns: 1 });
    const finalState = await turnManager.runGame(state, adapter);

    expect(finalState.turns.length).toBe(1);
    expect(finalState.winner).toBeNull();
    expect(finalState.terminationReason).toBe('turn_cap');
    expect(finalState.maxTurns).toBe(1);
    expect(finalState.endTime).toBeDefined();
  });

  it('should stop a game as context_limit when a play prompt exceeds budget', async () => {
    let providerCalls = 0;
    const adapter: LLMAdapter = {
      async getPlayDecision(playerId, modelId, visibleState) {
        providerCalls++;
        throw new ContextLimitError({
          decisionType: 'play',
          playerId,
          modelId,
          actingPlayerId: playerId,
          actingModelId: modelId,
          systemPrompt: 'system',
          userPrompt: 'long prompt',
          visibleContext: visibleState,
          visibleContextHash: 'c'.repeat(64),
          estimatedPromptTokens: 200,
          promptBudgetTokens: 100,
        });
      },
      async getChallengeDecision() {
        throw new Error('unused');
      },
    };

    const state = createGameState('context-limit-play-game', 1, ['m1', 'm2', 'm3', 'm4'], 42);
    const finalState = await new TurnManager().runGame(state, adapter);

    expect(providerCalls).toBe(1);
    expect(finalState.turns).toHaveLength(0);
    expect(finalState.winner).toBeNull();
    expect(finalState.terminationReason).toBe('context_limit');
    expect(finalState.invalidDecision).toMatchObject({
      terminationReason: 'context_limit',
      decisionType: 'play',
      turnNumber: 1,
      contextLimitExceeded: true,
      estimatedPromptTokens: 200,
      promptBudgetTokens: 100,
    });
    expect(finalState.endTime).toBeDefined();
  });

  it('should preserve partial turn and earlier passes when a challenge prompt exceeds budget', async () => {
    let challengeCalls = 0;
    const adapter: LLMAdapter = {
      async getPlayDecision(_playerId, _modelId, visibleState) {
        const card = visibleState.hand[0];
        return {
          reasoning: 'Play first card.',
          cards_to_play: [cardToString(card)],
          claim_count: 1,
        };
      },
      async getChallengeDecision(challengerId, modelId, visibleState, _lastPlay) {
        challengeCalls++;
        if (challengeCalls === 1) {
          return {
            reasoning: 'First challenger passes.',
            challenge: false,
            responseTimeMs: 20,
            tokenUsageIncomplete: true,
          };
        }

        throw new ContextLimitError({
          decisionType: 'challenge',
          playerId: challengerId,
          modelId,
          actingPlayerId: 'player_0',
          actingModelId: 'm1',
          decisionOrder: 1,
          systemPrompt: 'system',
          userPrompt: 'long challenge prompt',
          visibleContext: visibleState,
          visibleContextHash: 'd'.repeat(64),
          estimatedPromptTokens: 300,
          promptBudgetTokens: 100,
        });
      },
    };

    const state = createGameState('context-limit-challenge-game', 1, ['m1', 'm2', 'm3', 'm4'], 42);
    state.currentPlayerIndex = 0;
    const finalState = await new TurnManager().runGame(state, adapter);

    expect(finalState.terminationReason).toBe('context_limit');
    expect(finalState.turns).toHaveLength(1);
    expect(finalState.turns[0].challengeOfferedTo).toEqual(['player_1', 'player_2']);
    expect(finalState.turns[0].challengeDecisions).toHaveLength(1);
    expect(finalState.turns[0].challengeDecisions?.[0]).toMatchObject({
      playerId: 'player_1',
      challenge: false,
      reasoning: 'First challenger passes.',
    });
    expect(finalState.invalidDecision).toMatchObject({
      decisionType: 'challenge',
      turnNumber: 1,
      playerId: 'player_2',
      decisionOrder: 1,
      contextLimitExceeded: true,
    });
  });

  it('should reject an invalid maxTurns value', () => {
    expect(() => new TurnManager({ maxTurns: Number.NaN })).toThrow(/maxTurns/);
  });

  it('should normalize impossible model plays to a valid four-card move', async () => {
    const adapter: LLMAdapter = {
      async getPlayDecision(_playerId, _modelId, visibleState) {
        return {
          reasoning: 'Dump everything.',
          cards_to_play: visibleState.hand.slice(0, 6).map(cardToString),
          claim_count: 10,
        };
      },
      async getChallengeDecision() {
        return {
          reasoning: 'Never challenge.',
          challenge: false,
        };
      },
    };

    const state = createGameState('normalize-game', 1, ['m1', 'm2', 'm3', 'm4'], 42);
    const currentPlayer = getCurrentPlayer(state);
    currentPlayer.hand = [
      { rank: 'A', suit: 'S' },
      { rank: '2', suit: 'S' },
      { rank: '3', suit: 'S' },
      { rank: '4', suit: 'S' },
      { rank: '5', suit: 'S' },
      { rank: '6', suit: 'S' },
    ];

    const turnManager = new TurnManager({ maxTurns: 10 });
    const turn = await turnManager.executeTurn(state, adapter);

    expect(turn.actualCards.length).toBe(MAX_CARDS_PER_PLAY);
    expect(turn.claimedCount).toBe(MAX_CARDS_PER_PLAY);
  });

  it('should persist all pass decisions with model ids, timings, and token usage', async () => {
    const adapter: LLMAdapter = {
      async getPlayDecision(_playerId, _modelId, visibleState) {
        const card = visibleState.hand.find((candidate) => candidate.rank === visibleState.currentRank) || visibleState.hand[0];
        return {
          reasoning: 'Play with usage.',
          cards_to_play: [cardToString(card)],
          claim_count: 1,
          responseTimeMs: 11,
          tokenUsage: { promptTokens: 101, completionTokens: 7, totalTokens: 108 },
        };
      },
      async getChallengeDecision(challengerId, modelId) {
        return {
          reasoning: `${modelId} passes.`,
          challenge: false,
          responseTimeMs: challengerId === 'player_1' ? 21 : challengerId === 'player_2' ? 22 : 23,
          tokenUsage: { promptTokens: 201, completionTokens: 9, totalTokens: 210 },
        };
      },
    };

    const state = createGameState('pass-logging-game', 1, ['m1', 'm2', 'm3', 'm4'], 42);
    state.currentPlayerIndex = 0;
    state.currentRank = 'A';
    state.players[0].hand = [{ rank: 'A', suit: 'S' }, ...state.players[0].hand.filter((card) => card.rank !== 'A' || card.suit !== 'S')];
    const turn = await new TurnManager().executeTurn(state, adapter);

    expect(turn.playResponseTimeMs).toBe(11);
    expect(turn.playTokenUsage).toEqual({ promptTokens: 101, completionTokens: 7, totalTokens: 108 });
    expect(turn.challenged).toBe(false);
    expect(turn.challengeOfferedTo).toEqual(['player_1', 'player_2', 'player_3']);
    expect(turn.challengeDecisions).toEqual([
      {
        playerId: 'player_1',
        modelId: 'm2',
        challenge: false,
        reasoning: 'm2 passes.',
        decisionOrder: 0,
        responseTimeMs: 21,
        tokenUsage: { promptTokens: 201, completionTokens: 9, totalTokens: 210 },
      },
      {
        playerId: 'player_2',
        modelId: 'm3',
        challenge: false,
        reasoning: 'm3 passes.',
        decisionOrder: 1,
        responseTimeMs: 22,
        tokenUsage: { promptTokens: 201, completionTokens: 9, totalTokens: 210 },
      },
      {
        playerId: 'player_3',
        modelId: 'm4',
        challenge: false,
        reasoning: 'm4 passes.',
        decisionOrder: 2,
        responseTimeMs: 23,
        tokenUsage: { promptTokens: 201, completionTokens: 9, totalTokens: 210 },
      },
    ]);
  });

  it('should preserve pass decisions before a later successful challenge', async () => {
    let challengeCalls = 0;
    const adapter: LLMAdapter = {
      async getPlayDecision(_playerId, _modelId, visibleState) {
        const card = visibleState.hand[0];
        return {
          reasoning: 'Play first card.',
          cards_to_play: [cardToString(card)],
          claim_count: 1,
          responseTimeMs: 10,
          tokenUsage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
        };
      },
      async getChallengeDecision(_challengerId, modelId) {
        challengeCalls++;
        return {
          reasoning: challengeCalls === 1 ? 'Let it pass.' : 'Challenge now.',
          challenge: challengeCalls === 2,
          responseTimeMs: 30 + challengeCalls,
          tokenUsage: { promptTokens: 40 + challengeCalls, completionTokens: 5, totalTokens: 45 + challengeCalls },
        };
      },
    };

    const state = createGameState('later-challenge-game', 1, ['m1', 'm2', 'm3', 'm4'], 42);
    state.currentPlayerIndex = 0;
    state.currentRank = 'A';
    const turn = await new TurnManager().executeTurn(state, adapter);

    expect(challengeCalls).toBe(2);
    expect(turn.challenged).toBe(true);
    expect(turn.challengerId).toBe('player_2');
    expect(turn.challengeReasoning).toBe('Challenge now.');
    expect(turn.challengeResponseTimeMs).toBe(32);
    expect(turn.challengeTokenUsage).toEqual({ promptTokens: 42, completionTokens: 5, totalTokens: 47 });
    expect(turn.challengeOfferedTo).toEqual(['player_1', 'player_2']);
    expect(turn.challengeDecisions).toEqual([
      {
        playerId: 'player_1',
        modelId: 'm2',
        challenge: false,
        reasoning: 'Let it pass.',
        decisionOrder: 0,
        responseTimeMs: 31,
        tokenUsage: { promptTokens: 41, completionTokens: 5, totalTokens: 46 },
      },
      {
        playerId: 'player_2',
        modelId: 'm3',
        challenge: true,
        reasoning: 'Challenge now.',
        decisionOrder: 1,
        responseTimeMs: 32,
        tokenUsage: { promptTokens: 42, completionTokens: 5, totalTokens: 47 },
      },
    ]);
  });
});

describe('Adapter Recovery', () => {
  it('should recreate the adapter and retry a recoverable request once', async () => {
    let factoryCalls = 0;

    const resilient = new ResilientLLMAdapter(() => {
      factoryCalls++;

      if (factoryCalls === 1) {
        return {
          async getPlayDecision() {
            throw new NimAPIConnectionError('temporary timeout');
          },
          async getChallengeDecision() {
            return { reasoning: 'unused', challenge: false };
          },
        } satisfies LLMAdapter;
      }

      return {
        async getPlayDecision() {
          return {
            reasoning: 'Recovered after adapter reset.',
            cards_to_play: ['AS'],
            claim_count: 1,
          };
        },
        async getChallengeDecision() {
          return { reasoning: 'unused', challenge: false };
        },
      } satisfies LLMAdapter;
    }, 'TEST', 60_000, 1);

    const response = await resilient.getPlayDecision(
      'player_0',
      'model-a',
      {
        hand: [{ rank: 'A', suit: 'S' }],
        currentRank: 'A',
        pileSize: 0,
        otherPlayersCounts: {},
        recentTurns: [],
      },
      1
    );

    expect(factoryCalls).toBe(2);
    expect(response.cards_to_play).toEqual(['AS']);
    expect(response.claim_count).toBe(1);
  });

  it('should stop retrying after the recovery window is exhausted', async () => {
    let factoryCalls = 0;
    const resilient = new ResilientLLMAdapter(() => {
      factoryCalls++;
      return {
        async getPlayDecision() {
          throw new NimAPIConnectionError('persistent outage');
        },
        async getChallengeDecision() {
          return { reasoning: 'unused', challenge: false };
        },
      } satisfies LLMAdapter;
    }, 'TEST', 1, 1);

    await expect(
      resilient.getPlayDecision(
        'player_0',
        'model-a',
        {
          hand: [{ rank: 'A', suit: 'S' }],
          currentRank: 'A',
          pileSize: 0,
          otherPlayersCounts: {},
          recentTurns: [],
        },
        1
      )
    ).rejects.toThrow(/persistent outage/);

    expect(factoryCalls).toBeGreaterThanOrEqual(1);
  });
});

describe('Scripted Baseline Adapter', () => {
  it('should play truthfully when it has the required rank', async () => {
    const adapter = new ScriptedBaselineAdapter();

    const response = await adapter.getPlayDecision(
      'player_0',
      'baseline/scripted',
      {
        hand: [
          { rank: 'A', suit: 'S' },
          { rank: 'A', suit: 'H' },
          { rank: 'K', suit: 'D' },
        ],
        currentRank: 'A',
        pileSize: 0,
        otherPlayersCounts: {},
        recentTurns: [],
      },
      1
    );

    expect(response.cards_to_play).toEqual(['AH', 'AS']);
    expect(response.claim_count).toBe(2);
  });

  it('should challenge mathematically impossible claims', async () => {
    const adapter = new ScriptedBaselineAdapter();

    const response = await adapter.getChallengeDecision(
      'player_1',
      'baseline/scripted',
      {
        hand: [
          { rank: 'Q', suit: 'S' },
          { rank: 'Q', suit: 'H' },
          { rank: 'Q', suit: 'D' },
        ],
        currentRank: 'Q',
        pileSize: 4,
        otherPlayersCounts: {
          'model-a': 2,
        },
        recentTurns: [],
      },
      {
        playerId: 'model-a',
        claimedCount: 2,
        claimedRank: 'Q',
      },
      1
    );

    expect(response.challenge).toBe(true);
    expect(response.reasoning).toMatch(/impossible/i);
  });
});

describe('Prompt Protocol', () => {
  it('should use a full-history v3 prompt version with a neutered Exp0 system prompt', () => {
    const exp0Prompt = buildSystemPrompt(0);
    const exp1Prompt = buildSystemPrompt(1);

    expect(PROMPT_VERSION).toBe('2026-05-26-full-history-v3-json-only');
    expect(exp0Prompt).not.toContain('STRATEGY CONSIDERATIONS');
    expect(exp0Prompt).not.toMatch(/\blie|lying|LIED|challenge|Bullshit/i);
    expect(exp0Prompt).toContain('CONTROL CONDITION');
    expect(exp0Prompt).toContain('Return only one valid JSON object');
    expect(exp0Prompt).toContain('maximum 100 words');
    expect(exp1Prompt).toContain('STRATEGY CONSIDERATIONS');
    expect(exp1Prompt).toContain('You MAY lie');
  });

  it('should render full public history without hidden cards or private reasoning', () => {
    const history: PublicTurnHistoryEntry[] = Array.from({ length: 6 }, (_, index) => ({
      turnNumber: index + 1,
      playerId: `player_${index % 4}`,
      modelId: `model-${index % 4}`,
      claimedRank: RANKS[index],
      claimedCount: index === 5 ? 4 : 1,
      challengeOfferedTo: ['player_1', 'player_2'],
      challengeDecisions: [
        { playerId: 'player_1', modelId: 'model-1', challenge: false, decisionOrder: 0 },
        { playerId: 'player_2', modelId: 'model-2', challenge: index === 2, decisionOrder: 1 },
      ],
      challenged: index === 2,
      challengerId: index === 2 ? 'player_2' : undefined,
      challengerModelId: index === 2 ? 'model-2' : undefined,
      challengeCorrect: index === 2 ? true : undefined,
      pileAfterTurn: index + 1,
      handSizesAfterTurn: {
        player_0: 12 - index,
        player_1: 13,
      },
      handCountsByModelAfterTurn: {
        'model-0': 12 - index,
        'model-1': 13,
      },
    }));

    const prompt = buildPlayPrompt(
      [{ rank: 'Q', suit: 'S' }],
      'Q',
      4,
      { 'model-1': 7 },
      history
    );

    expect(prompt).toContain('Full public game history');
    expect(prompt).toContain('Turn 1: model-0 (player_0) claimed 1 A(s)');
    expect(prompt).toContain('Turn 6: model-1 (player_1) claimed 4 6(s)');
    expect(prompt).toContain('model-1 (player_1): pass');
    expect(prompt).toContain('model-2 (player_2): CHALLENGE');
    expect(prompt).toContain('public hand counts after turn: model-0: 7, model-1: 13');
    expect(prompt).not.toContain('actualCards');
    expect(prompt).not.toContain('private reasoning');

    const challengePrompt = buildChallengePrompt(
      [{ rank: 'Q', suit: 'S' }],
      'Q',
      4,
      { 'model-1': 7 },
      { playerId: 'model-1', claimedCount: 4, claimedRank: 'Q' },
      history
    );
    expect(challengePrompt).toContain('Full public game history');
    expect(challengePrompt).toContain('Turn 6: model-1 (player_1) claimed 4 6(s)');
  });

  it('should hash the full prompt protocol, including user prompt history formatting', () => {
    const corpus = buildPromptProtocolCorpus();
    const hash = hashPromptProtocol(corpus);
    const changedHistoryFormatting = corpus.replace('Full public game history', 'Complete public transcript');

    expect(corpus).toContain('Full public game history');
    expect(corpus).toContain('"cards_to_play"');
    expect(corpus).toContain('"challenge"');
    expect(hashPromptProtocol(changedHistoryFormatting)).not.toBe(hash);
  });
});

describe('Structured Response Accounting', () => {
  const visibleState = {
    hand: [{ rank: 'A', suit: 'S' }] as Card[],
    currentRank: 'A' as const,
    pileSize: 0,
    otherPlayersCounts: {},
    recentTurns: [],
  };

  it('should aggregate token usage and response time across JSON repair retries', async () => {
    let calls = 0;
    const client = {
      async chatCompletion() {
        calls++;
        if (calls === 1) {
          return {
            content: 'not json',
            tokenUsage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
            responseTimeMs: 11,
            finishReason: 'stop',
          };
        }

        return {
          content: '{"reasoning":"retry ok","challenge":false}',
          tokenUsage: { promptTokens: 20, completionTokens: 3, totalTokens: 23 },
          responseTimeMs: 22,
          finishReason: 'stop',
        };
      },
      async chatCompletionStream() {
        throw new Error('unused');
      },
    };

    const adapter = new NimLLMAdapter(client as any, 1);
    const response = await adapter.getChallengeDecision(
      'player_1',
      'model-a',
      visibleState,
      { playerId: 'model-b', claimedCount: 1, claimedRank: 'A' },
      1
    );

    expect(calls).toBe(2);
    expect(response.challenge).toBe(false);
    expect(response.responseTimeMs).toBe(33);
    expect(response.tokenUsage).toEqual({ promptTokens: 30, completionTokens: 5, totalTokens: 35 });
    expect(response.tokenUsageIncomplete).toBe(false);
    expect(response.decisionTrace?.systemPrompt).toContain('Bullshit');
    expect(response.decisionTrace?.userPrompt).toContain('CHALLENGE DECISION');
    expect(response.decisionTrace?.rawResponse).toContain('"challenge":false');
    expect(response.decisionTrace?.parsedResponse).toEqual({ reasoning: 'retry ok', challenge: false });
    expect(response.decisionTrace?.retryCount).toBe(1);
    expect(response.decisionTrace?.attempts).toHaveLength(2);
    expect(response.decisionTrace?.attempts[0].parsed).toBe(false);
    expect(response.decisionTrace?.attempts[1].parsed).toBe(true);
    expect(response.decisionTrace?.visibleContextHash).toMatch(/^[a-f0-9]{64}$/);
    expect(response.decisionTrace?.maxTokens).toBe(CHALLENGE_MAX_TOKENS);
    expect(response.decisionTrace?.estimatedPromptTokens).toBeGreaterThan(0);
    expect(response.decisionTrace?.promptBudgetTokens).toBeGreaterThan(response.decisionTrace?.estimatedPromptTokens ?? 0);
    expect(response.decisionTrace?.contextLimitExceeded).toBe(false);
  });

  it('should retry parseable responses that ended because of the completion cap', async () => {
    let calls = 0;
    const client = {
      async chatCompletion() {
        calls++;
        if (calls === 1) {
          return {
            content: '{"reasoning":"parseable but capped","challenge":false}',
            tokenUsage: { promptTokens: 10, completionTokens: 1024, totalTokens: 1034 },
            responseTimeMs: 11,
            finishReason: 'length',
          };
        }

        return {
          content: '{"reasoning":"retry ok","challenge":false}',
          tokenUsage: { promptTokens: 20, completionTokens: 4, totalTokens: 24 },
          responseTimeMs: 22,
          finishReason: 'stop',
        };
      },
      async chatCompletionStream() {
        throw new Error('unused');
      },
    };

    const adapter = new NimLLMAdapter(client as any, 1);
    const response = await adapter.getChallengeDecision(
      'player_1',
      'model-a',
      visibleState,
      { playerId: 'model-b', claimedCount: 1, claimedRank: 'A' },
      1
    );

    expect(calls).toBe(2);
    expect(response.challenge).toBe(false);
    expect(response.reasoning).toBe('retry ok');
    expect(response.decisionTrace?.finishReason).toBe('stop');
    expect(response.decisionTrace?.retryCount).toBe(1);
    expect(response.decisionTrace?.attempts[0].parsed).toBe(true);
    expect(response.decisionTrace?.attempts[0].wasTruncated).toBe(true);
    expect(response.decisionTrace?.attempts[1].parsed).toBe(true);
    expect(response.decisionTrace?.attempts[1].wasTruncated).toBe(false);
  });

  it('should mark structured-response usage incomplete when any retry call omits usage', async () => {
    let calls = 0;
    const client = {
      async chatCompletion() {
        calls++;
        if (calls === 1) {
          return {
            content: 'not json',
            responseTimeMs: 11,
            finishReason: 'stop',
          };
        }

        return {
          content: '{"reasoning":"retry ok","cards_to_play":["AS"],"claim_count":1}',
          tokenUsage: { promptTokens: 20, completionTokens: 3, totalTokens: 23 },
          responseTimeMs: 22,
          finishReason: 'stop',
        };
      },
      async chatCompletionStream() {
        throw new Error('unused');
      },
    };

    const adapter = new NimLLMAdapter(client as any, 1);
    const response = await adapter.getPlayDecision('player_0', 'model-a', visibleState, 1);

    expect(calls).toBe(2);
    expect(response.responseTimeMs).toBe(33);
    expect(response.tokenUsage).toEqual({ promptTokens: 20, completionTokens: 3, totalTokens: 23 });
    expect(response.tokenUsageIncomplete).toBe(true);
  });

  it('should reject over-budget prompts before making a provider call', async () => {
    let calls = 0;
    const client = {
      async chatCompletion() {
        calls++;
        return {
          content: '{"reasoning":"unused","cards_to_play":["AS"],"claim_count":1}',
          responseTimeMs: 1,
          finishReason: 'stop',
        };
      },
      async chatCompletionStream() {
        calls++;
        throw new Error('unused');
      },
    };

    const adapter = new NimLLMAdapter(client as any, 1, 1);
    await expect(adapter.getPlayDecision('player_0', 'model-a', visibleState, 1)).rejects.toThrow(ContextLimitError);
    expect(calls).toBe(0);
  });
});

describe('NVIDIA NIM Client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should retry degraded-function 400 responses as recoverable outages', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            status: 400,
            title: 'Bad Request',
            detail: "Function id 'abc': DEGRADED function cannot be invoked",
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          id: 'resp-1',
          choices: [
            {
              message: { role: 'assistant', content: '{"reasoning":"ok","challenge":false}' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const client = new NimClient({
      apiKey: 'test-key',
      baseUrl: 'https://example.invalid/v1',
      maxRetries: 2,
      retryDelayMs: 1,
      rateLimitDelayMs: 0,
      requestTimeoutMs: 1000,
    });
    (client as any).sleep = async () => {};

    const response = await client.chatCompletion('model-a', [{ role: 'user', content: 'hi' }], 32);

    expect(calls).toBe(2);
    expect(response.content).toContain('"challenge":false');
  });

  it('should retry null-content responses instead of crashing the logger', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            id: 'resp-null',
            choices: [
              {
                message: { role: 'assistant', content: null },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          id: 'resp-ok',
          choices: [
            {
              message: { role: 'assistant', content: '{"reasoning":"ok","challenge":false}' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const client = new NimClient({
      apiKey: 'test-key',
      baseUrl: 'https://example.invalid/v1',
      maxRetries: 2,
      retryDelayMs: 1,
      rateLimitDelayMs: 0,
      requestTimeoutMs: 1000,
    });
    (client as any).sleep = async () => {};

    const response = await client.chatCompletion('model-a', [{ role: 'user', content: 'hi' }], 32);

    expect(calls).toBe(2);
    expect(response.content).toContain('"challenge":false');
  });

  it('should leave token usage undefined when the provider omits usage data', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'resp-no-usage',
          choices: [
            {
              message: { role: 'assistant', content: '{"reasoning":"ok","challenge":false}' },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as typeof fetch;

    const client = new NimClient({
      apiKey: 'test-key',
      baseUrl: 'https://example.invalid/v1',
      maxRetries: 1,
      retryDelayMs: 1,
      rateLimitDelayMs: 0,
      requestTimeoutMs: 1000,
    });

    const response = await client.chatCompletion('model-a', [{ role: 'user', content: 'hi' }], 32);

    expect(response.content).toContain('"challenge":false');
    expect(response.tokenUsage).toBeUndefined();
  });
});

describe('Matchup Generator', () => {
  it('should ship the current default 6-model roster', () => {
    expect(MODELS).toEqual([
      'z-ai/glm-5.1',
      'google/gemma-4-31b-it',
      'nvidia/nemotron-3-super-120b-a12b',
      'moonshotai/kimi-k2.6',
      'minimaxai/minimax-m2.7',
      'deepseek-ai/deepseek-v4-flash',
    ]);
    expect(MODELS).toContain('minimaxai/minimax-m2.7');
    expect(MODELS).not.toContain('minimaxai/minimax-m2.1');
    expect(MODELS.length).toBe(6);
    expect(BASELINE_MODELS).toEqual([
      'baseline/scripted',
      'baseline/random-legal',
      'baseline/truthful-greedy',
    ]);
  });

  it('should generate correct number of combinations', () => {
    const items = [1, 2, 3, 4, 5];
    const combs = combinations(items, 2);
    expect(combs.length).toBe(10);
  });

  it('should generate 15 matchups for the shipped 6-model roster', () => {
    const matchups = generateMatchups([...MODELS], 1);
    expect(matchups.length).toBe(15);
  });

  it('should include all 4 models in each matchup', () => {
    const models = ['a', 'b', 'c', 'd', 'e'];
    const matchups = generateMatchups(models, 5);

    for (const matchup of matchups) {
      expect(matchup.players.length).toBe(4);
      expect(matchup.games).toBe(5);
    }
  });

  it('should shuffle seating deterministically with a seed', () => {
    const players = ['a', 'b', 'c', 'd'];
    expect(shuffleSeating(players, 42)).toEqual(shuffleSeating(players, 42));
    expect(shuffleSeating(players, 42)).not.toEqual(shuffleSeating(players, 99));
  });

  it('should create tournament config from the current model roster', () => {
    const config = createTournamentConfig(2, 7, 'custom-logs');
    expect(config.experimentId).toBe(2);
    expect(config.models).toEqual([...MODELS]);
    expect(config.gamesPerMatchup).toBe(7);
    expect(config.outputDir).toBe('custom-logs');
    expect(config.maxTurns).toBeUndefined();
  });

  it('should include shard bounds in tournament config when provided', () => {
    const config = createTournamentConfig(1, 10, 'custom-logs', 200, 3, 8, [...MODELS], 20, 29);
    expect(config.matchupStart).toBe(3);
    expect(config.matchupEnd).toBe(8);
    expect(config.gameStart).toBe(20);
    expect(config.gameEnd).toBe(29);
    expect(config.maxTurns).toBe(200);
  });

  it('should allow a custom roster for scripted-baseline side tournaments', () => {
    const config = createTournamentConfig(
      1,
      3,
      'custom-logs',
      undefined,
      undefined,
      undefined,
      ['baseline/scripted', 'z-ai/glm-5.1', 'google/gemma-4-31b-it', 'nvidia/nemotron-3-super-120b-a12b']
    );

    expect(config.models).toEqual([
      'baseline/scripted',
      'z-ai/glm-5.1',
      'google/gemma-4-31b-it',
      'nvidia/nemotron-3-super-120b-a12b',
    ]);
  });

  it('should tag mixed scripted/provider runs in metadata', () => {
    const metadata = buildRunMetadata('nim', [
      'baseline/scripted',
      'z-ai/glm-5.1',
      'google/gemma-4-31b-it',
      'nvidia/nemotron-3-super-120b-a12b',
    ]);

    expect(metadata.provider).toBe('nim+baseline');
  });

  it('should include completion token caps in run metadata', () => {
    const metadata = buildRunMetadata('nim', ['a', 'b', 'c', 'd']);

    expect(metadata.playMaxTokens).toBe(PLAY_MAX_TOKENS);
    expect(metadata.challengeMaxTokens).toBe(CHALLENGE_MAX_TOKENS);
  });

  it('should reject tournament output directories with a mixed schema/provider/prompt cohort', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-output-guard-'));
    const gamesDir = path.join(outputDir, 'games');
    fs.mkdirSync(gamesDir, { recursive: true });

    fs.writeFileSync(
      path.join(gamesDir, 'legacy.json'),
      JSON.stringify({
        gameId: 'legacy',
        experimentId: 1,
        players: [],
        metadata: {
          logSchemaVersion: 2,
          provider: 'nim',
          promptVersion: '2026-03-26',
          promptHash: 'old',
        },
        turns: [],
        winner: null,
        totalTurns: 0,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMs: 0,
      } satisfies GameLog)
    );

    const metadata = buildRunMetadata('nim', ['a', 'b', 'c', 'd']);

    expect(() => assertOutputCohortCompatible(outputDir, metadata)).toThrow(/different schema\/provider\/prompt\/context-budget\/token-cap cohort/);
    expect(() => assertOutputCohortCompatible(outputDir, metadata, { allowMixedOutput: true })).not.toThrow();
  });

  it('should reject tournament output directories with mixed completion token caps', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-output-token-cap-'));
    const gamesDir = path.join(outputDir, 'games');
    fs.mkdirSync(gamesDir, { recursive: true });

    const metadata = buildRunMetadata('nim', ['a', 'b', 'c', 'd']);
    fs.writeFileSync(
      path.join(gamesDir, 'token-cap.json'),
      JSON.stringify({
        gameId: 'token-cap',
        experimentId: 1,
        players: [],
        metadata: {
          ...metadata,
          playMaxTokens: (metadata.playMaxTokens ?? PLAY_MAX_TOKENS) + 1,
        },
        turns: [],
        winner: null,
        totalTurns: 0,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMs: 0,
      } satisfies GameLog)
    );

    expect(() => assertOutputCohortCompatible(outputDir, metadata)).toThrow(/token-cap cohort/);
  });

  it('should resolve a valid matchup shard', () => {
    const shard = resolveMatchupShard(15, 5, 9);
    expect(shard).toEqual({
      start: 5,
      end: 9,
      count: 5,
      label: '5-9',
    });
  });

  it('should reject an invalid matchup shard range', () => {
    expect(() => resolveMatchupShard(15, 9, 5)).toThrow(/matchupEnd/);
    expect(() => resolveMatchupShard(15, 15, 15)).toThrow(/matchupStart/);
  });

  it('should resolve a valid global game-slot shard', () => {
    const shard = resolveGameSlotShard(150, 30, 39);
    expect(shard).toEqual({
      start: 30,
      end: 39,
      count: 10,
      label: '30-39',
    });
  });

  it('should reject an invalid global game-slot shard range', () => {
    expect(() => resolveGameSlotShard(150, 39, 30)).toThrow(/gameEnd/);
    expect(() => resolveGameSlotShard(150, 150, 150)).toThrow(/gameStart/);
  });

  it('should format tournament completion lines with the winner model name', () => {
    const message = formatTournamentGameCompletion(
      {
        gameId: 'exp1_m0_g0_123',
        experimentId: 1,
        players: [
          { id: 'player_0', modelId: 'z-ai/glm-5.1' },
          { id: 'player_1', modelId: 'google/gemma-4-31b-it' },
          { id: 'player_2', modelId: 'nvidia/nemotron-3-super-120b-a12b' },
          { id: 'player_3', modelId: 'deepseek-ai/deepseek-v4-flash' },
        ],
        turns: [],
        winner: 'player_3',
        totalTurns: 82,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMs: 1000,
      },
      2
    );

    expect(message).toContain('Winner: deepseek-ai/deepseek-v4-flash');
    expect(message).not.toContain('Winner: player_3');
  });

  it('should retry a failed tournament slot until it produces the configured number of successful games', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-runner-'));
    const config = createTournamentConfig(1, 2, outputDir, undefined, 0, 0);
    const runner = new TournamentRunner(config, {} as LLMAdapter);
    const savedGameIds: string[] = [];
    let callCount = 0;

    (runner as any).sleep = async () => {};
    (runner as any).saveGameLog = (log: GameLog) => {
      savedGameIds.push(log.gameId);
    };
    (runner as any).runSingleGame = async (_matchup: unknown, matchupIndex: number, gameIndex: number) => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('transient provider failure');
      }

      return {
        gameId: `exp1_m${matchupIndex}_g${gameIndex}_success_${callCount}`,
        experimentId: 1,
        players: [
          { id: 'player_0', modelId: 'a' },
          { id: 'player_1', modelId: 'b' },
          { id: 'player_2', modelId: 'c' },
          { id: 'player_3', modelId: 'd' },
        ],
        turns: [],
        winner: 'player_0',
        terminationReason: 'winner',
        totalTurns: 1,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMs: 1000,
      } satisfies GameLog;
    };

    await runner.run();

    expect(callCount).toBe(4);
    expect(savedGameIds).toEqual([
      'exp1_m0_g0_success_3',
      'exp1_m0_g1_success_4',
    ]);

    const checkpoint = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'checkpoint_exp1_m0-0.json'), 'utf-8')
    );
    expect(checkpoint.completedGames).toHaveLength(2);
  });

  it('should parse unlimited tournament slot retry limits from env', () => {
    const original = process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT;

    try {
      for (const value of ['0', 'none', 'unlimited', 'infinite']) {
        process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = value;
        expect(createTournamentConfig(1, 1, 'logs').maxGameFailuresPerSlot).toBe(0);
      }

      process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = '7';
      expect(createTournamentConfig(1, 1, 'logs').maxGameFailuresPerSlot).toBe(7);

      process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = 'invalid';
      expect(createTournamentConfig(1, 1, 'logs').maxGameFailuresPerSlot).toBe(10);
    } finally {
      if (original === undefined) {
        delete process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT;
      } else {
        process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = original;
      }
    }
  });

  it('should keep retrying transient tournament slot failures when retry limit is unlimited', async () => {
    const original = process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT;
    process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = '0';

    try {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-unlimited-retry-'));
      const config = createTournamentConfig(1, 1, outputDir, undefined, 0, 0);
      const runner = new TournamentRunner(config, {} as LLMAdapter);
      let callCount = 0;

      (runner as any).sleep = async () => {};
      (runner as any).saveGameLog = () => {};
      (runner as any).runSingleGame = async (_matchup: unknown, matchupIndex: number, gameIndex: number) => {
        callCount++;
        if (callCount <= 3) {
          throw new Error('transient endpoint failure');
        }

        return {
          gameId: `exp1_m${matchupIndex}_g${gameIndex}_success`,
          experimentId: 1,
          players: [
            { id: 'player_0', modelId: 'a' },
            { id: 'player_1', modelId: 'b' },
            { id: 'player_2', modelId: 'c' },
            { id: 'player_3', modelId: 'd' },
          ],
          turns: [],
          winner: 'player_0',
          terminationReason: 'winner',
          totalTurns: 1,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMs: 1000,
        } satisfies GameLog;
      };

      await runner.run();

      expect(callCount).toBe(4);
    } finally {
      if (original === undefined) {
        delete process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT;
      } else {
        process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = original;
      }
    }
  });

  it('should abort capped tournament slot retries after the configured failure limit', async () => {
    const original = process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT;
    process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = '2';

    try {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-capped-retry-'));
      const config = createTournamentConfig(1, 1, outputDir, undefined, 0, 0);
      const runner = new TournamentRunner(config, {} as LLMAdapter);
      let callCount = 0;

      (runner as any).sleep = async () => {};
      (runner as any).runSingleGame = async () => {
        callCount++;
        throw new Error('transient endpoint failure');
      };

      await expect(runner.run()).rejects.toThrow(/Aborting shard after 2 failed attempt/);
      expect(callCount).toBe(2);
    } finally {
      if (original === undefined) {
        delete process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT;
      } else {
        process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = original;
      }
    }
  });

  it('should abort fatal auth or access errors without retrying the slot', async () => {
    const original = process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT;
    process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = '0';

    try {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-fatal-retry-'));
      const config = createTournamentConfig(1, 1, outputDir, undefined, 0, 0);
      const runner = new TournamentRunner(config, {} as LLMAdapter);
      let callCount = 0;
      let sleepCount = 0;

      (runner as any).sleep = async () => {
        sleepCount++;
      };
      (runner as any).runSingleGame = async () => {
        callCount++;
        throw new NonRetryableAPIError(401, 'Unauthorized');
      };

      await expect(runner.run()).rejects.toThrow(/API error 401/);
      expect(callCount).toBe(1);
      expect(sleepCount).toBe(0);
    } finally {
      if (original === undefined) {
        delete process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT;
      } else {
        process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT = original;
      }
    }
  });

  it('should repair legacy checkpoints with holes instead of skipping missing game slots', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-hole-'));
    const config = createTournamentConfig(0, 4, outputDir, undefined, 0, 0);
    const checkpointPath = path.join(outputDir, 'checkpoint_exp0_m0-0.json');

    fs.writeFileSync(
      checkpointPath,
      JSON.stringify(
        {
          experimentId: 0,
          gamesPerMatchup: 4,
          matchupStart: 0,
          matchupEnd: 0,
          matchupIndex: 0,
          gameIndex: 4,
          completedGames: ['exp0_m0_g2_123', 'exp0_m0_g3_456'],
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    const runner = new TournamentRunner(config, {} as LLMAdapter);
    const savedSlots: string[] = [];

    (runner as any).sleep = async () => {};
    (runner as any).saveGameLog = () => {};
    (runner as any).runSingleGame = async (_matchup: unknown, matchupIndex: number, gameIndex: number) => {
      savedSlots.push(`${matchupIndex}:${gameIndex}`);
      return {
        gameId: `exp0_m${matchupIndex}_g${gameIndex}_${Date.now()}`,
        experimentId: 0,
        players: [
          { id: 'player_0', modelId: 'a' },
          { id: 'player_1', modelId: 'b' },
          { id: 'player_2', modelId: 'c' },
          { id: 'player_3', modelId: 'd' },
        ],
        turns: [],
        winner: 'player_0',
        terminationReason: 'winner',
        totalTurns: 1,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMs: 1000,
      } satisfies GameLog;
    };

    await runner.run();

    expect(savedSlots).toEqual(['0:0', '0:1']);

    const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
    expect(checkpoint.completedGames).toHaveLength(4);
  });

  it('should run only the requested global game-slot shard', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-game-slot-'));
    const config = createTournamentConfig(1, 3, outputDir, undefined, undefined, undefined, ['a', 'b', 'c', 'd', 'e'], 4, 5);
    const runner = new TournamentRunner(config, {} as LLMAdapter);
    const savedSlots: string[] = [];

    (runner as any).sleep = async () => {};
    (runner as any).saveGameLog = () => {};
    (runner as any).runSingleGame = async (_matchup: unknown, matchupIndex: number, gameIndex: number) => {
      savedSlots.push(`${matchupIndex}:${gameIndex}`);
      return {
        gameId: `exp1_m${matchupIndex}_g${gameIndex}_${Date.now()}`,
        experimentId: 1,
        players: [
          { id: 'player_0', modelId: 'a' },
          { id: 'player_1', modelId: 'b' },
          { id: 'player_2', modelId: 'c' },
          { id: 'player_3', modelId: 'd' },
        ],
        turns: [],
        winner: 'player_0',
        terminationReason: 'winner',
        totalTurns: 1,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMs: 1000,
      } satisfies GameLog;
    };

    await runner.run();

    expect(savedSlots).toEqual(['1:1', '1:2']);
    const checkpoint = JSON.parse(fs.readFileSync(path.join(outputDir, 'checkpoint_exp1_m0-4_s4-5.json'), 'utf-8'));
    expect(checkpoint.gameStart).toBe(4);
    expect(checkpoint.gameEnd).toBe(5);
    expect(checkpoint.completedGames).toHaveLength(2);
  });
});

describe('Response Parser', () => {
  it('should extract JSON from code fence', () => {
    const response = 'Here is my response:\n```json\n{"key": "value"}\n```';
    const json = extractJSON(response);
    expect(json).toBe('{"key": "value"}');
  });

  it('should extract raw JSON', () => {
    const response = 'Some text {"key": "value"} more text';
    const json = extractJSON(response);
    expect(json).toBe('{"key": "value"}');
  });

  it('should parse play response', () => {
    const response = '{"reasoning": "Test", "cards_to_play": ["AS", "AH"], "claim_count": 2}';
    const parsed = parsePlayResponse(response);

    expect(parsed).not.toBeNull();
    expect(parsed?.reasoning).toBe('Test');
    expect(parsed?.cards_to_play).toEqual(['AS', 'AH']);
    expect(parsed?.claim_count).toBe(2);
  });

  it('should parse challenge response', () => {
    const response = '{"reasoning": "Suspicious", "challenge": true}';
    const parsed = parseChallengeResponse(response);

    expect(parsed).not.toBeNull();
    expect(parsed?.reasoning).toBe('Suspicious');
    expect(parsed?.challenge).toBe(true);
  });

  it('should handle malformed JSON gracefully', () => {
    const response = 'Not valid JSON at all';
    expect(parsePlayResponse(response)).toBeNull();
    expect(parseChallengeResponse(response)).toBeNull();
  });
});

describe('Metrics', () => {
  const mockGameLog: GameLog = {
    gameId: 'test-game',
    experimentId: 1,
    players: [
      { id: 'player_0', modelId: 'model-a' },
      { id: 'player_1', modelId: 'model-b' },
      { id: 'player_2', modelId: 'model-c' },
      { id: 'player_3', modelId: 'model-d' },
    ],
    turns: [
      {
        turnNumber: 1,
        playerId: 'player_0',
        claimedRank: 'A',
        claimedCount: 2,
        actualCards: [{ rank: 'A', suit: 'S' }, { rank: 'K', suit: 'H' }],
        wasLie: true,
        challenged: false,
        reasoning: 'Test',
        pileAfterTurn: 2,
        handSizesAfterTurn: {},
      },
      {
        turnNumber: 2,
        playerId: 'player_1',
        claimedRank: '2',
        claimedCount: 1,
        actualCards: [{ rank: '2', suit: 'D' }],
        wasLie: false,
        challenged: true,
        challengerId: 'player_0',
        challengeCorrect: false,
        reasoning: 'Test',
        pileAfterTurn: 3,
        handSizesAfterTurn: {},
      },
    ],
    winner: 'player_0',
    terminationReason: 'winner',
    totalTurns: 2,
    startTime: '2024-01-01T00:00:00Z',
    endTime: '2024-01-01T00:01:00Z',
    durationMs: 60000,
  };

  it('should calculate player stats correctly', () => {
    const stats = calculatePlayerStats('model-a', [mockGameLog]);

    expect(stats.gamesPlayed).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.winRate).toBe(1);
    expect(stats.totalPlays).toBe(1);
    expect(stats.totalLies).toBe(1);
    expect(stats.lieFrequency).toBe(1);
    expect(stats.challengesMade).toBe(1);
    expect(stats.correctChallenges).toBe(0);
  });

  it('should calculate paranoia correctly', () => {
    const paranoia = calculateParanoia('model-a', [mockGameLog]);

    expect(paranoia).toBe(1);
  });

  it('should handle models with no games', () => {
    const stats = calculatePlayerStats('model-unknown', [mockGameLog]);

    expect(stats.gamesPlayed).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.lieFrequency).toBe(0);
  });

  it('should only count actual challenge opportunities', () => {
    const limitedOpportunityLog: GameLog = {
      gameId: 'limited-opportunity',
      experimentId: 1,
      players: [
        { id: 'player_0', modelId: 'model-a' },
        { id: 'player_1', modelId: 'model-b' },
        { id: 'player_2', modelId: 'model-c' },
        { id: 'player_3', modelId: 'model-d' },
      ],
      turns: [
        {
          turnNumber: 1,
          playerId: 'player_1',
          claimedRank: 'A',
          claimedCount: 1,
          actualCards: [{ rank: 'K', suit: 'S' }],
          wasLie: true,
          challengeOfferedTo: ['player_0'],
          challenged: true,
          challengerId: 'player_0',
          challengeCorrect: true,
          reasoning: 'Test',
          pileAfterTurn: 1,
          handSizesAfterTurn: {},
        },
      ],
      winner: 'player_0',
      totalTurns: 1,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:01:00Z',
      durationMs: 60000,
    };

    const stats = calculatePlayerStats('model-c', [limitedOpportunityLog]);
    expect(stats.challengeOpportunities).toBe(0);
    expect(stats.paranoiaFrequency).toBe(0);
  });

  it('should calculate v3 long-history metrics and pass-rationale buckets', () => {
    const v3MetricLog: GameLog = {
      gameId: 'v3-metrics-game',
      experimentId: 1,
      players: [
        { id: 'player_0', modelId: 'model-a' },
        { id: 'player_1', modelId: 'model-b' },
        { id: 'player_2', modelId: 'model-c' },
        { id: 'player_3', modelId: 'model-d' },
      ],
      metadata: {
        logSchemaVersion: 4,
        provider: 'nim',
        promptVersion: '2026-05-26-full-history-v3-json-only',
        promptHash: 'p-v3',
      },
      turns: [
        {
          turnNumber: 1,
          playerId: 'player_1',
          claimedRank: 'A',
          claimedCount: 1,
          actualCards: [{ rank: 'A', suit: 'S' }],
          wasLie: false,
          challengeOfferedTo: ['player_0'],
          challengeDecisions: [
            {
              playerId: 'player_0',
              modelId: 'model-a',
              challenge: false,
              reasoning: 'I do not have enough evidence to call this.',
              decisionOrder: 0,
            },
          ],
          challenged: false,
          reasoning: 'Truthful opening.',
          pileAfterTurn: 1,
          handSizesAfterTurn: {},
        },
        {
          turnNumber: 2,
          playerId: 'player_1',
          claimedRank: '2',
          claimedCount: 1,
          actualCards: [{ rank: 'K', suit: 'H' }],
          wasLie: true,
          challengeOfferedTo: ['player_0', 'player_2'],
          challengeDecisions: [
            {
              playerId: 'player_0',
              modelId: 'model-a',
              challenge: false,
              reasoning: 'The claim seems plausible.',
              decisionOrder: 0,
            },
            {
              playerId: 'player_2',
              modelId: 'model-c',
              challenge: true,
              reasoning: 'Caught the bluff.',
              decisionOrder: 1,
            },
          ],
          challenged: true,
          challengerId: 'player_2',
          challengeCorrect: true,
          reasoning: 'Bluff.',
          pileAfterTurn: 2,
          handSizesAfterTurn: {},
        },
        {
          turnNumber: 3,
          playerId: 'player_1',
          claimedRank: '3',
          claimedCount: 1,
          actualCards: [{ rank: 'Q', suit: 'D' }],
          wasLie: true,
          challengeOfferedTo: ['player_0'],
          challengeDecisions: [
            {
              playerId: 'player_0',
              modelId: 'model-a',
              challenge: true,
              reasoning: 'Prior caught lie makes this suspicious.',
              decisionOrder: 0,
            },
          ],
          challenged: true,
          challengerId: 'player_0',
          challengeCorrect: true,
          reasoning: 'Bluff again.',
          pileAfterTurn: 1,
          handSizesAfterTurn: {},
        },
        {
          turnNumber: 4,
          playerId: 'player_0',
          claimedRank: '4',
          claimedCount: 1,
          actualCards: [{ rank: '9', suit: 'C' }],
          wasLie: true,
          challenged: false,
          reasoning: 'Late bluff.',
          pileAfterTurn: 2,
          handSizesAfterTurn: {},
        },
      ],
      winner: 'player_0',
      terminationReason: 'winner',
      totalTurns: 4,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:01:00Z',
      durationMs: 60000,
    };

    const stats = calculatePlayerStats('model-a', [v3MetricLog]);

    expect(stats.lateGamePlays).toBe(1);
    expect(stats.lateGameLies).toBe(1);
    expect(stats.lateGameBluffRate).toBe(1);
    expect(stats.historyConditionedChallenges).toBe(1);
    expect(stats.historyConditionedCorrectChallenges).toBe(1);
    expect(stats.historyConditionedChallengeAccuracy).toBe(1);
    expect(stats.repeatedPlayerCleanHistoryOpportunities).toBe(1);
    expect(stats.repeatedPlayerCleanHistoryChallenges).toBe(0);
    expect(stats.repeatedPlayerKnownLieOpportunities).toBe(1);
    expect(stats.repeatedPlayerKnownLieChallenges).toBe(1);
    expect(stats.repeatedPlayerAdaptation).toBe(1);
    expect(stats.passDecisions).toBe(2);
    expect(stats.passRationaleInsufficientEvidence).toBe(1);
    expect(stats.passRationalePlausibleClaim).toBe(1);
  });

  it('should count instruction violations in experiment 3', () => {
    const deck = shuffleDeck(createDeck(), 42);
    const hands = dealCards(deck, 4).map((hand) => hand.map(cardToString));
    const players = [
      { id: 'player_0', modelId: 'model-a' },
      { id: 'player_1', modelId: 'model-b' },
      { id: 'player_2', modelId: 'model-c' },
      { id: 'player_3', modelId: 'model-d' },
    ];

    const optionalPlayerIndex = hands.findIndex(
      (hand) => hand.some((card) => card.startsWith('A')) && hand.some((card) => !card.startsWith('A'))
    );
    const conflictPlayerIndex = hands.findIndex(
      (hand, index) => index !== optionalPlayerIndex && hand.every((card) => !card.startsWith('2'))
    );

    expect(optionalPlayerIndex).toBeGreaterThanOrEqual(0);
    expect(conflictPlayerIndex).toBeGreaterThanOrEqual(0);

    const optionalHand = hands[optionalPlayerIndex];
    const optionalTruth = optionalHand.find((card) => card.startsWith('A'))!;
    const optionalOffRank = optionalHand.find((card) => !card.startsWith('A'))!;

    const conflictHand = hands[conflictPlayerIndex];
    const conflictCard = conflictHand[0];

    const exp3Log: GameLog = {
      gameId: 'exp3-game',
      experimentId: 3,
      players,
      seed: 42,
      turns: [
        {
          turnNumber: 1,
          playerId: `player_${optionalPlayerIndex}`,
          claimedRank: 'A',
          claimedCount: 2,
          actualCards: [parseCard(optionalTruth)!, parseCard(optionalOffRank)!],
          wasLie: true,
          challenged: false,
          reasoning: 'Optional lie',
          pileAfterTurn: 2,
          handSizesAfterTurn: {},
        },
        {
          turnNumber: 2,
          playerId: `player_${conflictPlayerIndex}`,
          claimedRank: '2',
          claimedCount: 1,
          actualCards: [parseCard(conflictCard)!],
          wasLie: true,
          challenged: false,
          reasoning: 'Conflict turn',
          pileAfterTurn: 3,
          handSizesAfterTurn: {},
        },
      ],
      winner: `player_${optionalPlayerIndex}`,
      terminationReason: 'winner',
      totalTurns: 2,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:01:00Z',
      durationMs: 60000,
    };

    const replayed = replayTurnTruthfulAvailability(exp3Log);
    expect(replayed[0].truthfulAvailable).toBe(true);
    expect(replayed[0].optionalLie).toBe(true);
    expect(replayed[1].truthfulPlayUnavailable).toBe(true);
    expect(replayed[1].optionalLie).toBe(false);

    const optionalModelId = players[optionalPlayerIndex].modelId;
    const conflictModelId = players[conflictPlayerIndex].modelId;

    const optionalStats = calculatePlayerStats(optionalModelId, [exp3Log], 3);
    expect(optionalStats.instructionViolations).toBe(1);
    expect(optionalStats.instructionViolationRate).toBe(1);
    expect(optionalStats.optionalLies).toBe(1);
    expect(optionalStats.optionalLieRateGivenTruthfulAvailable).toBe(1);
    expect(optionalStats.truthfulAvailableTurns).toBe(1);

    const conflictStats = calculatePlayerStats(conflictModelId, [exp3Log], 3);
    expect(conflictStats.instructionViolations).toBe(1);
    expect(conflictStats.optionalLies).toBe(0);
    expect(conflictStats.optionalLieRateGivenTruthfulAvailable).toBe(0);
    expect(conflictStats.truthfulUnavailableTurns).toBe(1);
  });

  it('should include availability-adjusted lie metrics in compare rows', () => {
    const rows = calculateCompareStatsRows(['model-a'], [mockGameLog], [1]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('truthfulAvailableTurnShare');
    expect(rows[0]).toHaveProperty('truthfulUnavailableTurnShare');
    expect(rows[0]).toHaveProperty('optionalLieTurnShare');
    expect(rows[0]).toHaveProperty('optionalLieRateGivenTruthfulAvailable');
    expect(rows[0]).toHaveProperty('lateGameBluffRate');
    expect(rows[0]).toHaveProperty('historyConditionedChallengeAccuracy');
    expect(rows[0]).toHaveProperty('repeatedPlayerAdaptation');
  });

  it('should build compare rows for every model and experiment pair', () => {
    const exp0Log: GameLog = {
      ...mockGameLog,
      gameId: 'exp0-game',
      experimentId: 0,
      winner: 'player_0',
    };
    const exp1Log: GameLog = {
      ...mockGameLog,
      gameId: 'exp1-game',
      experimentId: 1,
      winner: 'player_1',
    };

    const rows = calculateCompareStatsRows(['model-a', 'model-b'], [exp0Log, exp1Log], [0, 1]);

    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.experimentId === 0 && row.modelId === 'model-a')?.wins).toBe(1);
    expect(rows.find((row) => row.experimentId === 1 && row.modelId === 'model-b')?.wins).toBe(1);
    expect(rows.find((row) => row.experimentId === 0 && row.modelId === 'model-b')?.gamesPlayed).toBe(1);
    expect(rows.find((row) => row.experimentId === 1 && row.modelId === 'model-a')?.gamesPlayed).toBe(1);
  });
});

describe('Analysis Cohorts', () => {
  it('should prefer the highest-schema dominant cohort', () => {
    const logs: GameLog[] = [
      {
        gameId: 'legacy',
        experimentId: 1,
        players: [{ id: 'p1', modelId: 'a' }, { id: 'p2', modelId: 'b' }, { id: 'p3', modelId: 'c' }, { id: 'p4', modelId: 'd' }],
        turns: [],
        winner: null,
        totalTurns: 0,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:01Z',
        durationMs: 1000,
      },
      {
        gameId: 'new-1',
        experimentId: 1,
        players: [{ id: 'p1', modelId: 'a' }, { id: 'p2', modelId: 'b' }, { id: 'p3', modelId: 'c' }, { id: 'p4', modelId: 'd' }],
        metadata: {
          logSchemaVersion: 2,
          provider: 'nim',
          promptVersion: '2026-03-25',
          promptHash: 'p123',
        },
        turns: [],
        winner: null,
        totalTurns: 0,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:01Z',
        durationMs: 1000,
      },
      {
        gameId: 'new-2',
        experimentId: 1,
        players: [{ id: 'p1', modelId: 'a' }, { id: 'p2', modelId: 'b' }, { id: 'p3', modelId: 'c' }, { id: 'p4', modelId: 'd' }],
        metadata: {
          logSchemaVersion: 2,
          provider: 'nim',
          promptVersion: '2026-03-25',
          promptHash: 'p123',
        },
        turns: [],
        winner: null,
        totalTurns: 0,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:01Z',
        durationMs: 1000,
      },
    ];

    const selection = selectComparableGameCohort(logs);
    expect(selection.games.map((log) => log.gameId)).toEqual(['new-1', 'new-2']);
    expect(selection.excludedGames).toBe(1);
    expect(selection.cohort?.schemaVersion).toBe(2);
  });

  it('should build a cohort manifest with explicit exclusion reasons', () => {
    const logs: GameLog[] = [
      {
        gameId: 'mixed',
        experimentId: 1,
        players: [{ id: 'p1', modelId: 'a' }, { id: 'p2', modelId: 'b' }, { id: 'p3', modelId: 'c' }, { id: 'p4', modelId: 'd' }],
        metadata: {
          logSchemaVersion: 1,
          provider: 'legacy',
          promptVersion: 'old',
          promptHash: 'old',
        },
        turns: [],
        winner: 'p1',
        terminationReason: 'winner',
        totalTurns: 1,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:01Z',
        durationMs: 1000,
      },
      {
        gameId: 'turn-cap',
        experimentId: 1,
        players: [{ id: 'p1', modelId: 'a' }, { id: 'p2', modelId: 'b' }, { id: 'p3', modelId: 'c' }, { id: 'p4', modelId: 'd' }],
        metadata: {
          logSchemaVersion: 2,
          provider: 'nim',
          promptVersion: '2026-03-25',
          promptHash: 'p123',
        },
        turns: [],
        winner: null,
        terminationReason: 'turn_cap',
        totalTurns: 10,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:01Z',
        durationMs: 1000,
      },
      {
        gameId: 'valid',
        experimentId: 1,
        players: [{ id: 'p1', modelId: 'a' }, { id: 'p2', modelId: 'b' }, { id: 'p3', modelId: 'c' }, { id: 'p4', modelId: 'd' }],
        metadata: {
          logSchemaVersion: 2,
          provider: 'nim',
          promptVersion: '2026-03-25',
          promptHash: 'p123',
        },
        turns: [],
        winner: 'p1',
        terminationReason: 'winner',
        totalTurns: 10,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:01Z',
        durationMs: 1000,
      },
      {
        gameId: 'context-limit',
        experimentId: 1,
        players: [{ id: 'p1', modelId: 'a' }, { id: 'p2', modelId: 'b' }, { id: 'p3', modelId: 'c' }, { id: 'p4', modelId: 'd' }],
        metadata: {
          logSchemaVersion: 2,
          provider: 'nim',
          promptVersion: '2026-03-25',
          promptHash: 'p123',
        },
        turns: [],
        winner: null,
        terminationReason: 'context_limit',
        invalidDecision: {
          terminationReason: 'context_limit',
          decisionType: 'play',
          turnNumber: 1,
          playerId: 'p1',
          modelId: 'a',
          estimatedPromptTokens: 200,
          promptBudgetTokens: 100,
          contextLimitExceeded: true,
          errorMessage: 'over budget',
        },
        totalTurns: 0,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:01Z',
        durationMs: 1000,
      },
      {
        gameId: 'incomplete',
        experimentId: 1,
        players: [{ id: 'p1', modelId: 'a' }, { id: 'p2', modelId: 'b' }, { id: 'p3', modelId: 'c' }, { id: 'p4', modelId: 'd' }],
        metadata: {
          logSchemaVersion: 2,
          provider: 'nim',
          promptVersion: '2026-03-25',
          promptHash: 'p123',
        },
        turns: [],
        winner: null,
        terminationReason: 'winner',
        totalTurns: 0,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:01Z',
        durationMs: 1000,
      },
    ];

    const manifest = buildCohortManifest(logs);

    expect(manifest.includedGames).toEqual(['valid']);
    expect(manifest.excludedGamesByReason.mixedCohort).toEqual(['mixed']);
    expect(manifest.excludedGamesByReason.turnCap).toEqual(['turn-cap']);
    expect(manifest.excludedGamesByReason.contextLimit).toEqual(['context-limit']);
    expect(manifest.excludedGamesByReason.incomplete).toEqual(['incomplete']);
    expect(manifest.countsByExperiment[1]).toEqual({
      included: 1,
      excludedMixedCohort: 1,
      excludedTurnCap: 1,
      excludedContextLimit: 1,
      excludedProviderError: 0,
      excludedParseFailure: 0,
      excludedIncomplete: 1,
    });
  });
});

describe('GameLogger', () => {
  it('should preserve metadata, seed, and seating order when converting state to a log', () => {
    const state = createGameState('logged-game', 1, ['a', 'b', 'c', 'd'], 123);
    state.metadata = {
      logSchemaVersion: 2,
      provider: 'nim',
      providerBaseUrl: 'https://integrate.api.nvidia.com/v1',
      promptVersion: '2026-03-25',
      promptHash: 'p123',
    };
    state.winner = 'player_2';
    state.maxTurns = 200;
    state.terminationReason = 'winner';

    const logger = new GameLogger('logs/test-games');
    const log = logger.stateToLog(state);

    expect(log.gameId).toBe('logged-game');
    expect(log.metadata).toEqual(state.metadata);
    expect(log.seed).toBe(123);
    expect(log.maxTurns).toBe(200);
    expect(log.seatingOrder).toEqual(['a', 'b', 'c', 'd']);
    expect(log.winner).toBe('player_2');
    expect(log.terminationReason).toBe('winner');
  });
});

describe('CSVExporter', () => {
  it('should export every challenge-window decision and preserve missing token usage as blank', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-csv-'));
    const exporter = new CSVExporter(outputDir);
    const playTrace: DecisionTrace = {
      systemPrompt: 'system play',
      userPrompt: 'play prompt',
      visibleContext: { currentRank: 'A', recentTurns: [] },
      visibleContextHash: 'a'.repeat(64),
      maxTokens: 2048,
      estimatedPromptTokens: 12,
      promptBudgetTokens: 100,
      contextLimitExceeded: false,
      rawResponse: '{"reasoning":"Truthful play.","cards_to_play":["AS"],"claim_count":1}',
      parsedResponse: { reasoning: 'Truthful play.', cards_to_play: ['AS'], claim_count: 1 },
      attempts: [],
      retryCount: 0,
      finishReason: 'stop',
    };
    const passTrace: DecisionTrace = {
      systemPrompt: 'system challenge',
      userPrompt: 'pass prompt',
      visibleContext: { lastPlay: { claimedRank: 'A' } },
      visibleContextHash: 'b'.repeat(64),
      maxTokens: 1024,
      estimatedPromptTokens: 14,
      promptBudgetTokens: 100,
      contextLimitExceeded: false,
      rawResponse: '{"reasoning":"No challenge, seems plausible.","challenge":false}',
      parsedResponse: { reasoning: 'No challenge, seems plausible.', challenge: false },
      attempts: [],
      retryCount: 0,
      finishReason: 'stop',
    };
    const game: GameLog = {
      gameId: 'challenge-csv-game',
      experimentId: 1,
      players: [
        { id: 'player_0', modelId: 'model-a' },
        { id: 'player_1', modelId: 'model-b' },
        { id: 'player_2', modelId: 'model-c' },
        { id: 'player_3', modelId: 'model-d' },
      ],
      metadata: {
        logSchemaVersion: 3,
        provider: 'nim',
        providerBaseUrl: 'https://example.invalid/v1',
        promptVersion: '2026-03-26',
        promptHash: 'p123',
        playMaxTokens: 2048,
        challengeMaxTokens: 1024,
      },
      turns: [
        {
          turnNumber: 1,
          playerId: 'player_0',
          claimedRank: 'A',
          claimedCount: 1,
          actualCards: [{ rank: 'A', suit: 'S' }],
          wasLie: false,
          challengeOfferedTo: ['player_1', 'player_2'],
          challengeDecisions: [
            {
              playerId: 'player_1',
              modelId: 'model-b',
              challenge: false,
              reasoning: 'No challenge, seems plausible.',
              decisionOrder: 0,
              responseTimeMs: 20,
              tokenUsageIncomplete: true,
              decisionTrace: passTrace,
            },
            {
              playerId: 'player_2',
              modelId: 'model-c',
              challenge: true,
              reasoning: 'I will challenge.',
              decisionOrder: 1,
              responseTimeMs: 30,
              tokenUsage: { promptTokens: 100, completionTokens: 5, totalTokens: 105 },
            },
          ],
          challenged: true,
          challengerId: 'player_2',
          challengeCorrect: false,
          challengeReasoning: 'I will challenge.',
          reasoning: 'Truthful play.',
          pileAfterTurn: 1,
          handSizesAfterTurn: {},
          playResponseTimeMs: 10,
          playTokenUsage: { promptTokens: 50, completionTokens: 4, totalTokens: 54 },
          playDecisionTrace: playTrace,
          challengeResponseTimeMs: 30,
          challengeTokenUsage: { promptTokens: 100, completionTokens: 5, totalTokens: 105 },
        },
      ],
      winner: 'player_0',
      terminationReason: 'winner',
      totalTurns: 1,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:00:01Z',
      durationMs: 1000,
    };

    const decisionsPath = exporter.exportChallengeDecisions([game]);
    const decisionsCsv = fs.readFileSync(decisionsPath, 'utf-8');

    expect(decisionsCsv).toContain('player_1,model-b,0,0,,"No challenge, seems plausible.",20,,,,1');
    expect(decisionsCsv).toContain('player_2,model-c,1,1,0,I will challenge.,30,100,5,105,');

    const summaryPath = exporter.exportGameSummary([game]);
    const summaryCsv = fs.readFileSync(summaryPath, 'utf-8');
    expect(summaryCsv).toContain(',150,9,159,1');

    const noUsageGame: GameLog = {
      ...game,
      gameId: 'no-usage-game',
      turns: [
        {
          ...game.turns[0],
          playTokenUsage: undefined,
          playTokenUsageIncomplete: undefined,
          challengeTokenUsage: undefined,
          challengeTokenUsageIncomplete: undefined,
          challengeDecisions: game.turns[0].challengeDecisions?.map((decision) => ({
            ...decision,
            tokenUsage: undefined,
            tokenUsageIncomplete: undefined,
          })),
        },
      ],
    };
    const noUsageSummaryPath = exporter.exportGameSummary([noUsageGame]);
    const noUsageSummaryCsv = fs.readFileSync(noUsageSummaryPath, 'utf-8');
    expect(noUsageSummaryCsv.trim().split('\n')[1].endsWith('1000,,,,0')).toBe(true);

    const decisionLogPath = exporter.exportDecisionLog([game]);
    const decisionLogCsv = fs.readFileSync(decisionLogPath, 'utf-8');
    expect(decisionLogCsv).toContain('play,player_0,model-a,player_0,model-a');
    expect(decisionLogCsv).toContain('challenge,player_1,model-b,player_0,model-a,0,0');
    expect(decisionLogCsv).toContain('system play');
    expect(decisionLogCsv).toContain('pass prompt');
    expect(decisionLogCsv).toContain('No challenge, seems plausible.');
    expect(decisionLogCsv).toContain('a'.repeat(64));
    expect(decisionLogCsv).toContain('b'.repeat(64));
    expect(decisionLogCsv).toContain('max_tokens,estimated_prompt_tokens,prompt_budget_tokens,context_limit_exceeded');

    const invalidDecisionLogPath = exporter.exportDecisionLog([
      {
        ...game,
        gameId: 'context-limit-csv-game',
        turns: [],
        winner: null,
        terminationReason: 'context_limit',
        invalidDecision: {
          terminationReason: 'context_limit',
          decisionType: 'challenge',
          turnNumber: 2,
          playerId: 'player_2',
          modelId: 'model-c',
          actingPlayerId: 'player_0',
          actingModelId: 'model-a',
          decisionOrder: 1,
          systemPrompt: 'system overflow',
          userPrompt: 'challenge overflow prompt',
          visibleContext: { recentTurns: [] },
          visibleContextHash: 'c'.repeat(64),
          estimatedPromptTokens: 200,
          promptBudgetTokens: 100,
          contextLimitExceeded: true,
          errorMessage: 'Prompt exceeded context budget',
        },
      },
    ]);
    const invalidDecisionLogCsv = fs.readFileSync(invalidDecisionLogPath, 'utf-8');
    expect(invalidDecisionLogCsv).toContain('challenge,player_2,model-c,player_0,model-a,1');
    expect(invalidDecisionLogCsv).toContain('system overflow');
    expect(invalidDecisionLogCsv).toContain('Prompt exceeded context budget');
  });
});

describe('V3 Log Audit', () => {
  function auditTrace(visibleContext: unknown = { recentTurns: [] }, maxTokens: number = 1024): DecisionTrace {
    return {
      systemPrompt: 'system',
      userPrompt: 'Full public game history\nprompt',
      visibleContext,
      visibleContextHash: 'e'.repeat(64),
      maxTokens,
      estimatedPromptTokens: 20,
      promptBudgetTokens: 200,
      contextLimitExceeded: false,
      rawResponse: '{"reasoning":"ok","challenge":false}',
      parsedResponse: { reasoning: 'ok', challenge: false },
      attempts: [
        {
          attempt: 0,
          prompt: 'Full public game history\nprompt',
          rawResponse: '{"reasoning":"ok","challenge":false}',
          finishReason: 'stop',
          parsed: true,
          wasRetry: false,
          wasTruncated: false,
          responseTimeMs: 10,
          tokenUsage: { promptTokens: 20, completionTokens: 4, totalTokens: 24 },
        },
      ],
      retryCount: 0,
      finishReason: 'stop',
    };
  }

  function auditedGame(overrides: Partial<GameLog> = {}): GameLog {
    const promptHash = hashPromptProtocol(buildPromptProtocolCorpus());
    const turn = {
      turnNumber: 1,
      playerId: 'player_0',
      modelId: 'model-a',
      claimedRank: 'A' as const,
      claimedCount: 1,
      actualCards: [{ rank: 'A' as const, suit: 'S' as const }],
      wasLie: false,
      challengeOfferedTo: ['player_1', 'player_2', 'player_3'],
      challengeDecisions: [
        {
          playerId: 'player_1',
          modelId: 'model-b',
          challenge: false,
          reasoning: 'Pass.',
          decisionOrder: 0,
          responseTimeMs: 10,
          tokenUsageIncomplete: false,
          decisionTrace: auditTrace(),
        },
        {
          playerId: 'player_2',
          modelId: 'model-c',
          challenge: false,
          reasoning: 'Pass.',
          decisionOrder: 1,
          responseTimeMs: 10,
          tokenUsageIncomplete: false,
          decisionTrace: auditTrace(),
        },
        {
          playerId: 'player_3',
          modelId: 'model-d',
          challenge: false,
          reasoning: 'Pass.',
          decisionOrder: 2,
          responseTimeMs: 10,
          tokenUsageIncomplete: false,
          decisionTrace: auditTrace(),
        },
      ],
      challenged: false,
      reasoning: 'Truthful play.',
      pileAfterTurn: 1,
      handSizesAfterTurn: {},
      playResponseTimeMs: 10,
      playTokenUsageIncomplete: false,
      playDecisionTrace: auditTrace({ recentTurns: [] }, 2048),
    };

    return {
      gameId: 'audited-game',
      experimentId: 1,
      players: [
        { id: 'player_0', modelId: 'model-a' },
        { id: 'player_1', modelId: 'model-b' },
        { id: 'player_2', modelId: 'model-c' },
        { id: 'player_3', modelId: 'model-d' },
      ],
      metadata: {
        logSchemaVersion: 4,
        provider: 'nim',
        promptVersion: PROMPT_VERSION,
        promptHash,
        contextBudgetTokens: 200,
        playMaxTokens: 2048,
        challengeMaxTokens: 1024,
      },
      turns: [turn],
      winner: 'player_0',
      terminationReason: 'winner',
      totalTurns: 1,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:00:01Z',
      durationMs: 1000,
      ...overrides,
    };
  }

  it('should accept complete schema-v4 logs with full decision coverage', () => {
    const result = auditV3Logs([auditedGame()]);

    expect(result.errors).toEqual([]);
    expect(result.completeGames).toBe(1);
    expect(result.invalidGames).toBe(0);
  });

  it('should reject missing pass decisions and public-history hidden leakage', () => {
    const game = auditedGame();
    game.turns[0].challengeDecisions = game.turns[0].challengeDecisions?.slice(0, 2);
    game.turns[0].playDecisionTrace = auditTrace({
      recentTurns: [
        {
          turnNumber: 1,
          actualCards: [{ rank: 'A', suit: 'S' }],
        },
      ],
    });

    const result = auditV3Logs([game]);

    expect(result.errors.some((error) => error.includes('challenge decisions (2) do not match expected decisions (3)'))).toBe(true);
    expect(result.errors.some((error) => error.includes('public history leaks recentTurns[0].actualCards'))).toBe(true);
  });

  it('should accept context-limit invalid logs when invalid decision metadata is complete', () => {
    const game = auditedGame({
      gameId: 'audited-context-limit',
      turns: [],
      winner: null,
      terminationReason: 'context_limit',
      totalTurns: 0,
      invalidDecision: {
        terminationReason: 'context_limit',
        decisionType: 'play',
        turnNumber: 1,
        playerId: 'player_0',
        modelId: 'model-a',
        actingPlayerId: 'player_0',
        actingModelId: 'model-a',
        systemPrompt: 'system',
        userPrompt: 'Full public game history\nprompt',
        visibleContext: { recentTurns: [] },
        visibleContextHash: 'f'.repeat(64),
        estimatedPromptTokens: 300,
        promptBudgetTokens: 200,
        contextLimitExceeded: true,
        errorMessage: 'Prompt exceeded budget',
      },
    });

    const result = auditV3Logs([game]);

    expect(result.errors).toEqual([]);
    expect(result.completeGames).toBe(0);
    expect(result.invalidGames).toBe(1);
  });
});
