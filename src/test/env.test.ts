import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import { parseCard } from '../engine/deck.js';
import { createBullshitEnv } from '../env/bullshit-env.js';
import { BASELINE_MODELS, GameLog } from '../types/game.js';
import {
  DEFAULT_FROZEN_ARTIFACTS,
  DEFAULT_TRACKED_FIGURES,
  RandomLegalPolicy,
  SCHEMA_V3_FROZEN_ARTIFACTS,
  SCHEMA_V4_FROZEN_ARTIFACTS,
  TruthfulGreedyPolicy,
  buildBenchmarkRelease,
} from '../lib.js';

describe('BullshitEnv', () => {
  it('should reset deterministically with the same seed', () => {
    const env = createBullshitEnv({
      experimentId: 1,
      players: ['m1', 'm2', 'm3', 'm4'],
      seed: 42,
    });

    const first = env.reset();
    const firstObservation = env.observation(first.expectedActorId!);
    const second = env.reset({ seed: 42 });
    const secondObservation = env.observation(second.expectedActorId!);

    expect(first.publicState.players).toEqual(second.publicState.players);
    expect(first.expectedActorId).toBe(second.expectedActorId);
    expect(firstObservation.hand).toEqual(secondObservation.hand);
  });

  it('should advance from play phase into challenge phase on a valid play', () => {
    const env = createBullshitEnv({
      experimentId: 1,
      players: ['m1', 'm2', 'm3', 'm4'],
      seed: 42,
    });

    const reset = env.reset();
    const actorId = reset.expectedActorId!;
    const observation = env.observation(actorId);
    const result = env.step({
      type: 'play',
      playerId: actorId,
      cards: [observation.hand[0]],
      claimCount: 1,
      reasoning: 'Play one card.',
    });

    expect(result.publicState.phase).toBe('challenge');
    expect(result.turnCompleted).toBe(false);
    expect(result.event?.type).toBe('play_submitted');
    expect(result.publicState.pendingPlay?.playerId).toBe(actorId);
    expect(result.publicState.expectedActorId).not.toBe(actorId);
  });

  it('should resolve a correct challenge and restore the liar hand size', () => {
    const env = createBullshitEnv({
      experimentId: 1,
      players: ['m1', 'm2', 'm3', 'm4'],
      seed: 42,
    });

    const reset = env.reset();
    const actorId = reset.expectedActorId!;
    const observation = env.observation(actorId);
    const bluffCard = observation.hand.find((card) => parseCard(card)?.rank !== observation.currentRank);

    expect(bluffCard).toBeDefined();

    env.step({
      type: 'play',
      playerId: actorId,
      cards: [bluffCard!],
      claimCount: 1,
      reasoning: 'Bluff with one off-rank card.',
    });

    const challengerId = env.publicState().expectedActorId!;
    const result = env.step({
      type: 'challenge',
      playerId: challengerId,
      challenge: true,
      reasoning: 'Call the bluff.',
    });

    expect(result.turnCompleted).toBe(true);
    expect(result.publicState.lastTurn?.challengeCorrect).toBe(true);
    expect(result.publicState.players.find((player) => player.playerId === actorId)?.handSize).toBe(observation.hand.length);
  });

  it('should reject invalid actors and mismatched claim counts', () => {
    const env = createBullshitEnv({
      experimentId: 1,
      players: ['m1', 'm2', 'm3', 'm4'],
      seed: 42,
    });

    const reset = env.reset();
    const actorId = reset.expectedActorId!;
    const observation = env.observation(actorId);
    const wrongActor = env.publicState().players.find((player) => player.playerId !== actorId)!;

    expect(() =>
      env.step({
        type: 'play',
        playerId: wrongActor.playerId,
        cards: [observation.hand[0]],
        claimCount: 1,
      })
    ).toThrow(/expected actor/i);

    expect(() =>
      env.step({
        type: 'play',
        playerId: actorId,
        cards: [observation.hand[0]],
        claimCount: 2,
      })
    ).toThrow(/Claimed count must match/i);
  });

  it('should mark capped games as finished after the configured turn limit', () => {
    const env = createBullshitEnv({
      experimentId: 1,
      players: ['m1', 'm2', 'm3', 'm4'],
      seed: 42,
      maxTurns: 1,
    });

    const reset = env.reset();
    const actorId = reset.expectedActorId!;
    const observation = env.observation(actorId);

    env.step({
      type: 'play',
      playerId: actorId,
      cards: [observation.hand[0]],
      claimCount: 1,
      reasoning: 'One card.',
    });

    while (!env.done()) {
      const challengerId = env.publicState().expectedActorId!;
      env.step({
        type: 'challenge',
        playerId: challengerId,
        challenge: false,
        reasoning: 'Pass.',
      });
    }

    expect(env.result()?.terminationReason).toBe('turn_cap');
  });
});

describe('Baseline policies', () => {
  const basePublicState = {
    gameId: 'g',
    experimentId: 1 as const,
    currentPlayerId: 'player_0',
    currentPlayerModelId: 'baseline/truthful-greedy',
    currentRank: 'A' as const,
    pileSize: 0,
    players: [
      { playerId: 'player_0', modelId: 'baseline/truthful-greedy', handSize: 3, isCurrentPlayer: true, isExpectedActor: true },
      { playerId: 'player_1', modelId: 'm1', handSize: 13, isCurrentPlayer: false, isExpectedActor: false },
      { playerId: 'player_2', modelId: 'm2', handSize: 13, isCurrentPlayer: false, isExpectedActor: false },
      { playerId: 'player_3', modelId: 'm3', handSize: 13, isCurrentPlayer: false, isExpectedActor: false },
    ],
    phase: 'play' as const,
    expectedActorId: 'player_0',
    expectedActorModelId: 'baseline/truthful-greedy',
    totalTurns: 0,
    done: false,
  };

  it('should expose the full baseline policy pack', () => {
    expect(BASELINE_MODELS).toEqual([
      'baseline/scripted',
      'baseline/random-legal',
      'baseline/truthful-greedy',
    ]);
  });

  it('random-legal should always emit a syntactically valid play action', () => {
    const policy = new RandomLegalPolicy(() => 0.25);
    const observation = {
      playerId: 'player_0',
      modelId: 'baseline/random-legal',
      hand: ['AS', '2C', 'KH'],
      currentRank: 'A' as const,
      pileSize: 0,
      otherPlayers: [],
      recentTurns: [],
      phase: 'play' as const,
      expectedActorId: 'player_0',
      expectedActorModelId: 'baseline/random-legal',
      isActingPlayer: true,
    };

    const action = policy.act(observation, {
      ...basePublicState,
      currentPlayerModelId: 'baseline/random-legal',
      players: [
        { playerId: 'player_0', modelId: 'baseline/random-legal', handSize: 3, isCurrentPlayer: true, isExpectedActor: true },
      ],
    });

    expect(action.type).toBe('play');
    if (action.type === 'play') {
      expect(action.claimCount).toBe(action.cards.length);
      expect(action.cards.every((card) => observation.hand.includes(card))).toBe(true);
      expect(action.cards.length).toBeGreaterThan(0);
    }
  });

  it('truthful-greedy should play truthfully when possible and bluff minimally when forced', () => {
    const policy = new TruthfulGreedyPolicy();

    const truthfulAction = policy.act(
      {
        playerId: 'player_0',
        modelId: 'baseline/truthful-greedy',
        hand: ['AS', 'AH', 'KD'],
        currentRank: 'A',
        pileSize: 0,
        otherPlayers: [],
        recentTurns: [],
        phase: 'play',
        expectedActorId: 'player_0',
        expectedActorModelId: 'baseline/truthful-greedy',
        isActingPlayer: true,
      },
      basePublicState
    );

    expect(truthfulAction.type).toBe('play');
    if (truthfulAction.type === 'play') {
      expect(truthfulAction.cards.every((card) => parseCard(card)?.rank === 'A')).toBe(true);
      expect(truthfulAction.claimCount).toBe(2);
    }

    const bluffAction = policy.act(
      {
        playerId: 'player_0',
        modelId: 'baseline/truthful-greedy',
        hand: ['2C', 'KD', 'QS'],
        currentRank: 'A',
        pileSize: 0,
        otherPlayers: [],
        recentTurns: [],
        phase: 'play',
        expectedActorId: 'player_0',
        expectedActorModelId: 'baseline/truthful-greedy',
        isActingPlayer: true,
      },
      basePublicState
    );

    expect(bluffAction.type).toBe('play');
    if (bluffAction.type === 'play') {
      expect(bluffAction.cards).toHaveLength(1);
      expect(parseCard(bluffAction.cards[0])?.rank).not.toBe('A');
    }
  });
});

describe('Benchmark release builder', () => {
  it('should build a versioned release manifest, checksums, and raw-log archive', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bullshit-release-'));
    const gamesDir = path.join(repoRoot, 'logs', 'games');

    fs.mkdirSync(gamesDir, { recursive: true });

    const log: GameLog = {
      gameId: 'exp1_m0_g0_demo',
      experimentId: 1,
      players: [
        { id: 'player_0', modelId: 'a' },
        { id: 'player_1', modelId: 'b' },
        { id: 'player_2', modelId: 'c' },
        { id: 'player_3', modelId: 'd' },
      ],
      metadata: {
        logSchemaVersion: 4,
        provider: 'nim',
        promptVersion: '2026-05-26-full-history-v3-json-only',
        promptHash: 'p-v3',
      },
      turns: [],
      winner: 'player_0',
      terminationReason: 'winner',
      totalTurns: 1,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationMs: 1,
    };

    fs.writeFileSync(path.join(gamesDir, `${log.gameId}.json`), JSON.stringify(log, null, 2));

    for (const relativePath of [
      ...DEFAULT_FROZEN_ARTIFACTS,
      ...SCHEMA_V3_FROZEN_ARTIFACTS,
      ...SCHEMA_V4_FROZEN_ARTIFACTS,
      ...DEFAULT_TRACKED_FIGURES,
    ]) {
      const filepath = path.join(repoRoot, relativePath);
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, `content for ${relativePath}\n`);
    }

    const release = buildBenchmarkRelease({
      repoRoot,
      logsDir: 'logs',
      releaseDir: 'release/v1.0.0',
    });

    expect(fs.existsSync(path.join(repoRoot, release.datasetManifest))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, release.evaluationManifest))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, release.checksums))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, release.rawLogArchive.path))).toBe(true);

    const archiveListing = execFileSync('tar', ['-tzf', path.join(repoRoot, release.rawLogArchive.path)], {
      encoding: 'utf-8',
    });
    expect(archiveListing).toContain(`${log.gameId}.json`);

    const datasetManifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, release.datasetManifest), 'utf-8')
    ) as { includedGames: number };
    expect(datasetManifest.includedGames).toBe(1);
    expect(release.frozenSummaryArtifacts).toContain('paper/arxiv/artifacts/frozen/decision_log.csv');

    const evaluationManifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, release.evaluationManifest), 'utf-8')
    ) as { schemaVersion: number; primaryMetrics: string[] };
    expect(evaluationManifest.schemaVersion).toBe(4);
    expect(evaluationManifest.primaryMetrics).toContain('history_conditioned_challenge_accuracy');

    const checksumFile = fs.readFileSync(path.join(repoRoot, release.checksums), 'utf-8');
    expect(checksumFile).toContain(release.rawLogArchive.path);
    expect(checksumFile).toContain('paper/arxiv/artifacts/frozen/decision_log.csv');
  });
});
