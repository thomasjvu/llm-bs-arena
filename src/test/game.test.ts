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
import { combinations, createTournamentConfig, generateMatchups, resolveMatchupShard, shuffleSeating } from '../tournament/matchup-generator.js';
import { formatTournamentGameCompletion, TournamentRunner } from '../tournament/tournament-runner.js';
import { calculatePlayerStats, calculateParanoia } from '../metrics/player-stats.js';
import { parsePlayResponse, parseChallengeResponse, extractJSON } from '../llm/response-parser.js';
import { MODELS, BASELINE_MODELS, RANKS, Card, GameLog } from '../types/game.js';
import { GameLogger, selectComparableGameCohort, buildCohortManifest } from '../logging/game-logger.js';
import { ResilientLLMAdapter, buildRunMetadata } from '../llm/provider.js';
import { APIConnectionError as NimAPIConnectionError, NimClient } from '../llm/nim-api.js';
import { MAX_CARDS_PER_PLAY } from '../engine/play-rules.js';
import { ScriptedBaselineAdapter } from '../llm/llm-adapter.js';

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
});

describe('Matchup Generator', () => {
  it('should ship the current default 6-model roster', () => {
    expect(MODELS).toContain('minimaxai/minimax-m2.5');
    expect(MODELS).not.toContain('minimaxai/minimax-m2.1');
    expect(MODELS.length).toBe(6);
    expect(BASELINE_MODELS).toEqual(['baseline/scripted']);
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
    const config = createTournamentConfig(1, 10, 'custom-logs', 200, 3, 8);
    expect(config.matchupStart).toBe(3);
    expect(config.matchupEnd).toBe(8);
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
      ['baseline/scripted', 'qwen/qwen3.5-397b-a17b', 'minimaxai/minimax-m2.5', 'nvidia/nemotron-3-super-120b-a12b']
    );

    expect(config.models).toEqual([
      'baseline/scripted',
      'qwen/qwen3.5-397b-a17b',
      'minimaxai/minimax-m2.5',
      'nvidia/nemotron-3-super-120b-a12b',
    ]);
  });

  it('should tag mixed scripted/provider runs in metadata', () => {
    const metadata = buildRunMetadata('nim', [
      'baseline/scripted',
      'qwen/qwen3.5-397b-a17b',
      'minimaxai/minimax-m2.5',
      'nvidia/nemotron-3-super-120b-a12b',
    ]);

    expect(metadata.provider).toBe('nim+scripted');
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

  it('should format tournament completion lines with the winner model name', () => {
    const message = formatTournamentGameCompletion(
      {
        gameId: 'exp1_m0_g0_123',
        experimentId: 1,
        players: [
          { id: 'player_0', modelId: 'qwen/qwen3.5-397b-a17b' },
          { id: 'player_1', modelId: 'minimaxai/minimax-m2.5' },
          { id: 'player_2', modelId: 'nvidia/nemotron-3-super-120b-a12b' },
          { id: 'player_3', modelId: 'mistralai/mistral-small-4-119b-2603' },
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

    expect(message).toContain('Winner: mistralai/mistral-small-4-119b-2603');
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

  it('should count instruction violations in experiment 3', () => {
    const exp3Log: GameLog = {
      ...mockGameLog,
      gameId: 'exp3-game',
      experimentId: 3,
    };

    const stats = calculatePlayerStats('model-a', [exp3Log], 3);
    expect(stats.instructionViolations).toBe(1);
    expect(stats.instructionViolationRate).toBe(1);
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
    ];

    const manifest = buildCohortManifest(logs);

    expect(manifest.includedGames).toEqual(['valid']);
    expect(manifest.excludedGamesByReason.mixedCohort).toEqual(['mixed']);
    expect(manifest.excludedGamesByReason.turnCap).toEqual(['turn-cap']);
    expect(manifest.countsByExperiment[1]).toEqual({
      included: 1,
      excludedMixedCohort: 1,
      excludedTurnCap: 1,
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
