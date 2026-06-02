import { DurableObject } from 'cloudflare:workers';
import { createGameState, getCurrentPlayer, getOtherPlayers, processPlay, processChallenge, advanceTurn, checkWinner, finalizeGame } from './engine/game-state.js';
import { normalizePlaySelection } from './engine/play-rules.js';
import { buildClientGameState, getAwaitingHumanAction } from './server-state.js';
import { Card, ChallengeResponse, ExperimentId, GameState, MODELS, PlayTurnResponse, PlayerSeatConfig, Turn } from './types/game.js';
import type { LLMAdapter } from './engine/turn-manager.js';
import { NimLLMAdapter } from './llm/llm-adapter.js';
import { createNimClient } from './llm/nim-api.js';
import { getPromptHash, PROMPT_VERSION } from './llm/prompt-builder.js';

type Fetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type DurableObjectId = unknown;

type DurableObjectNamespace = {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): Fetcher;
};

type DurableObjectStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  deleteAll(): Promise<void>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
};

type DurableObjectState = {
  storage: DurableObjectStorage;
};

interface Env {
  ASSETS: Fetcher;
  GAME_SESSIONS: DurableObjectNamespace;
  LIVE_NIM_ENABLED?: string;
}

type ActiveGame = {
  state: GameState;
  adapter: LLMAdapter;
  pendingTurn: Turn | null;
  challengeQueue: string[];
  phase: 'waiting' | 'challenging' | 'finished';
  lastUpdate: number;
  stepInProgress: boolean;
  humanPlayerId: string | null;
  hidePrivateState: boolean;
  provider: 'mock' | 'nim';
  stepCount: number;
  expiresAt: number;
};

type StoredGame = Omit<ActiveGame, 'adapter'>;

const HUMAN_MODEL_ID = 'human/player';
const DEFAULT_HUMAN_NAME = 'You';
const PUBLIC_GAME_TTL_MS = 24 * 60 * 60 * 1000;
const PUBLIC_MAX_RESOLVED_TURNS = 160;
const PUBLIC_MAX_MODEL_STEPS = 800;
const API_RATE_LIMIT = { limit: 600, windowMs: 10 * 60 * 1000 };
const GAME_START_RATE_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 };
const LIVE_STEP_RATE_LIMIT = { limit: 240, windowMs: 60 * 60 * 1000 };
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const PUBLIC_DEMO_STATS = {
  stats: {},
  rows: [],
  cohort: null,
  excludedGames: 0,
  counts: {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    total: 0,
    includedByExperiment: { 0: 0, 1: 0, 2: 0, 3: 0 },
    totalByExperiment: { 0: 0, 1: 0, 2: 0, 3: 0 },
  },
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function redirect(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Location: location,
    },
  });
}

function parseCardString(card: string): Card | null {
  const match = /^([0-9AJQK]+)([CDHS])$/.exec(card);
  if (!match) return null;
  return { rank: match[1] as Card['rank'], suit: match[2] as Card['suit'] };
}

function formatCard(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function shuffleArray<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function liveNimEnabled(env: Env): boolean {
  return env.LIVE_NIM_ENABLED !== 'false';
}

function getClientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'local';
}

function cleanupRateLimitBuckets(now: number): void {
  if (rateLimitBuckets.size < 5000) return;
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

function checkRateLimit(
  key: string,
  limit: { limit: number; windowMs: number },
  message = 'Too many requests'
): Response | null {
  const now = Date.now();
  cleanupRateLimitBuckets(now);
  const current = rateLimitBuckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + limit.windowMs };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (bucket.count <= limit.limit) {
    return null;
  }

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return json({ error: message, retryAfterSeconds: retryAfter }, 429, {
    'Retry-After': String(retryAfter),
  });
}

function isHumanPlayer(player: { modelId: string; role?: string }): boolean {
  return player.role === 'human' || player.modelId === HUMAN_MODEL_ID;
}

function isModelId(value: unknown): value is (typeof MODELS)[number] {
  return typeof value === 'string' && (MODELS as readonly string[]).includes(value);
}

function pickOpponentModels(body: Record<string, unknown>): string[] {
  const requestedOpponentIds = Array.isArray(body.opponentModelIds)
    ? body.opponentModelIds.filter(isModelId)
    : [];
  const uniqueRequested = [...new Set(requestedOpponentIds)];
  if (uniqueRequested.length >= 3) return uniqueRequested.slice(0, 3);

  const remainingPool = shuffleArray(MODELS.filter((modelId) => !uniqueRequested.includes(modelId)));
  return [...uniqueRequested, ...remainingPool.slice(0, 3 - uniqueRequested.length)];
}

function buildPlayerSeats(body: Record<string, unknown>): PlayerSeatConfig[] {
  const interactive = body.interactive === true;

  if (!interactive) {
    const requestedModelIds = Array.isArray(body.modelIds)
      ? body.modelIds.filter(isModelId)
      : [];
    const uniqueRequested = [...new Set(requestedModelIds)];
    const chosenModels = uniqueRequested.length === 4 ? uniqueRequested : shuffleArray(MODELS).slice(0, 4);
    return chosenModels.map((modelId) => ({ modelId, role: 'model' }));
  }

  const humanName = typeof body.humanName === 'string' && body.humanName.trim().length > 0
    ? body.humanName.trim().slice(0, 40)
    : DEFAULT_HUMAN_NAME;

  return shuffleArray([
    { modelId: HUMAN_MODEL_ID, displayName: humanName, role: 'human' },
    ...pickOpponentModels(body).map((modelId) => ({ modelId, role: 'model' as const })),
  ]);
}

function reviveState(state: GameState): GameState {
  return {
    ...state,
    startTime: new Date(state.startTime),
    endTime: state.endTime ? new Date(state.endTime) : undefined,
  };
}

function readSessionApiKey(body: Record<string, unknown>): string | undefined {
  return typeof body.apiKey === 'string' && body.apiKey.trim().length > 0
    ? body.apiKey.trim()
    : undefined;
}

function createAdapterForProvider(provider: ActiveGame['provider'], apiKey?: string): LLMAdapter {
  if (provider === 'mock') {
    return new PublicDemoAdapter();
  }

  if (!apiKey) {
    return new MissingSessionKeyAdapter();
  }

  return new NimLLMAdapter(createNimClient({ apiKey }));
}

function getFullGameState(game: ActiveGame) {
  return buildClientGameState(game);
}

function buildVisibleStateForPlayer(game: ActiveGame, playerId: string, pileSize = game.state.pile.length) {
  const player = game.state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`Player ${playerId} not found`);
  }

  return {
    hand: player.hand,
    currentRank: game.state.currentRank,
    pileSize,
    otherPlayersCounts: Object.fromEntries(
      game.state.players
        .filter((entry) => entry.id !== player.id && !entry.isEliminated)
        .map((entry) => [entry.modelId, entry.hand.length])
    ),
    recentTurns: game.state.turns.map((turn) => ({
      turnNumber: turn.turnNumber,
      playerId: turn.playerId,
      modelId: turn.modelId || game.state.players.find((entry) => entry.id === turn.playerId)?.modelId,
      claimedRank: turn.claimedRank,
      claimedCount: turn.claimedCount,
      challengeOfferedTo: [...(turn.challengeOfferedTo || [])],
      challengeDecisions: turn.challengeDecisions?.map((decision) => ({
        playerId: decision.playerId,
        modelId: decision.modelId || game.state.players.find((entry) => entry.id === decision.playerId)?.modelId,
        challenge: decision.challenge,
        decisionOrder: decision.decisionOrder,
      })),
      challenged: turn.challenged,
      challengerId: turn.challengerId,
      challengerModelId: turn.challengerModelId || (turn.challengerId ? game.state.players.find((entry) => entry.id === turn.challengerId)?.modelId : undefined),
      challengeCorrect: turn.challengeCorrect,
      pileAfterTurn: turn.pileAfterTurn,
      handSizesAfterTurn: { ...turn.handSizesAfterTurn },
      handCountsByModelAfterTurn: Object.fromEntries(
        Object.entries(turn.handSizesAfterTurn).map(([turnPlayerId, handSize]) => [
          game.state.players.find((entry) => entry.id === turnPlayerId)?.modelId || turnPlayerId,
          handSize,
        ])
      ),
    })),
  };
}

function recordChallengeDecision(
  turn: Turn,
  playerId: string,
  modelId: string,
  challenge: boolean,
  reasoning: string,
  responseTimeMs?: number
) {
  turn.challengeOfferedTo ??= [];
  turn.challengeOfferedTo.push(playerId);
  turn.challengeDecisions ??= [];
  turn.challengeDecisions.push({
    playerId,
    modelId,
    challenge,
    reasoning,
    decisionOrder: turn.challengeDecisions.length,
    responseTimeMs,
  });
}

function completeGameIfWon(game: ActiveGame): boolean {
  const winner = checkWinner(game.state);
  if (!winner) return false;
  finalizeGame(game.state, winner);
  game.phase = 'finished';
  return true;
}

function finishAtPublicCap(game: ActiveGame): void {
  game.state.winner = null;
  game.state.terminationReason = 'turn_cap';
  game.state.endTime = new Date();
  game.pendingTurn = null;
  game.challengeQueue = [];
  game.phase = 'finished';
  game.lastUpdate = Date.now();
}

function publicGameCapReached(game: ActiveGame): boolean {
  return game.stepCount >= PUBLIC_MAX_MODEL_STEPS || game.state.turns.length >= PUBLIC_MAX_RESOLVED_TURNS;
}

function refreshGameExpiry(game: ActiveGame): void {
  game.expiresAt = Date.now() + PUBLIC_GAME_TTL_MS;
}

function acceptPendingTurn(game: ActiveGame) {
  if (!game.pendingTurn) return;
  advanceTurn(game.state, game.pendingTurn);
  game.pendingTurn = null;
  game.phase = 'waiting';
  completeGameIfWon(game);
}

function resolveChallenge(game: ActiveGame, challengerId: string, reasoning: string) {
  if (!game.pendingTurn) return;
  processChallenge(game.state, game.pendingTurn, challengerId, reasoning);
  advanceTurn(game.state, game.pendingTurn);
  game.pendingTurn = null;
  game.challengeQueue = [];
  game.phase = 'waiting';
  completeGameIfWon(game);
}

class PublicDemoAdapter implements LLMAdapter {
  private async delay(minMs: number, maxMs: number): Promise<void> {
    const delayMs = minMs + Math.random() * Math.max(0, maxMs - minMs);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  async getPlayDecision(
    _playerId: string,
    _modelId: string,
    visibleState: ReturnType<typeof buildVisibleStateForPlayer>,
    _experimentId: number,
    onToken?: (text: string) => void
  ): Promise<PlayTurnResponse> {
    await this.delay(120, 320);
    const hand = visibleState.hand;
    const matchingCards = hand.filter((card) => card.rank === visibleState.currentRank);
    const shouldTellTruth = matchingCards.length > 0 && Math.random() > 0.3;
    const selected = shouldTellTruth
      ? matchingCards.slice(0, Math.min(matchingCards.length, 2))
      : [hand[Math.floor(Math.random() * hand.length)]];
    const cardsToPlay = selected.map(formatCard);
    const reasoning = shouldTellTruth
      ? `I can match ${visibleState.currentRank}, so I play ${cardsToPlay.length} truthful card${cardsToPlay.length === 1 ? '' : 's'}.`
      : `I do not like my truthful options, so I make a small bluff and claim ${visibleState.currentRank}.`;

    if (onToken) {
      for (const token of reasoning.split(' ')) {
        onToken(`${token} `);
        await this.delay(10, 24);
      }
    }

    return {
      reasoning,
      cards_to_play: cardsToPlay,
      claim_count: cardsToPlay.length,
      responseTimeMs: 160 + Math.random() * 220,
    };
  }

  async getChallengeDecision(
    _challengerId: string,
    _modelId: string,
    visibleState: ReturnType<typeof buildVisibleStateForPlayer>,
    lastPlay: { playerId: string; claimedCount: number; claimedRank: string },
    _experimentId: number,
    onToken?: (text: string) => void
  ): Promise<ChallengeResponse> {
    await this.delay(90, 260);
    const heldClaimedRank = visibleState.hand.filter((card) => card.rank === lastPlay.claimedRank).length;
    const impossible = heldClaimedRank + lastPlay.claimedCount > 4;
    const pressure = Math.max(0, lastPlay.claimedCount - 1) * 0.12;
    const shouldChallenge = impossible || Math.random() < 0.16 + pressure;
    const reasoning = shouldChallenge
      ? impossible
        ? `I hold ${heldClaimedRank} ${lastPlay.claimedRank}(s), so the claim cannot be true.`
        : `The ${lastPlay.claimedCount}-card ${lastPlay.claimedRank} claim is risky enough to challenge.`
      : `I cannot prove the ${lastPlay.claimedRank} claim is false, so I pass.`;

    if (onToken) {
      for (const token of reasoning.split(' ')) {
        onToken(`${token} `);
        await this.delay(10, 24);
      }
    }

    return {
      reasoning,
      challenge: shouldChallenge,
      responseTimeMs: 120 + Math.random() * 200,
    };
  }
}

class MissingSessionKeyAdapter implements LLMAdapter {
  private fail(): never {
    throw new Error('Session NVIDIA API key required to continue live model play');
  }

  async getPlayDecision(
    _playerId: string,
    _modelId: string,
    _visibleState: Parameters<LLMAdapter['getPlayDecision']>[2],
    _experimentId: number,
    _onToken?: (text: string) => void
  ): Promise<PlayTurnResponse> {
    this.fail();
  }

  async getChallengeDecision(
    _challengerId: string,
    _modelId: string,
    _visibleState: Parameters<LLMAdapter['getChallengeDecision']>[2],
    _lastPlay: Parameters<LLMAdapter['getChallengeDecision']>[3],
    _experimentId: number,
    _onToken?: (text: string) => void
  ): Promise<ChallengeResponse> {
    this.fail();
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) return {};
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

async function stepGame(game: ActiveGame): Promise<void> {
  if (game.phase === 'finished' || getAwaitingHumanAction(game)) return;

  if (game.phase === 'waiting') {
    const currentPlayer = getCurrentPlayer(game.state);
    const visibleState = buildVisibleStateForPlayer(game, currentPlayer.id);
    const playResponse = await game.adapter.getPlayDecision(
      currentPlayer.id,
      currentPlayer.modelId,
      visibleState,
      game.state.experimentId
    );
    const normalizedPlay = normalizePlaySelection(playResponse.cards_to_play, currentPlayer.hand, playResponse.claim_count);
    const turn = processPlay(
      game.state,
      currentPlayer.id,
      normalizedPlay.actualCards,
      normalizedPlay.claimedCount,
      playResponse.reasoning
    );

    turn.playResponseTimeMs = playResponse.responseTimeMs;
    game.pendingTurn = turn;
    game.challengeQueue = getOtherPlayers(game.state).map((player) => player.id);
    game.phase = 'challenging';
    game.lastUpdate = Date.now();
    return;
  }

  if (game.phase === 'challenging' && game.pendingTurn) {
    if (game.challengeQueue.length === 0) {
      acceptPendingTurn(game);
      game.lastUpdate = Date.now();
      return;
    }

    const challengerId = game.challengeQueue.shift();
    const challenger = game.state.players.find((player) => player.id === challengerId);
    const currentPlayer = getCurrentPlayer(game.state);
    if (!challenger || !challengerId) {
      acceptPendingTurn(game);
      game.lastUpdate = Date.now();
      return;
    }

    const visibleState = buildVisibleStateForPlayer(game, challenger.id, game.state.pile.length - game.pendingTurn.actualCards.length);
    const challengeResponse = await game.adapter.getChallengeDecision(
      challenger.id,
      challenger.modelId,
      visibleState,
      {
        playerId: currentPlayer.modelId,
        claimedCount: game.pendingTurn.claimedCount,
        claimedRank: game.pendingTurn.claimedRank,
      },
      game.state.experimentId
    );

    recordChallengeDecision(
      game.pendingTurn,
      challenger.id,
      challenger.modelId,
      challengeResponse.challenge,
      challengeResponse.reasoning,
      challengeResponse.responseTimeMs
    );

    if (challengeResponse.challenge) {
      game.pendingTurn.challengeResponseTimeMs = challengeResponse.responseTimeMs;
      resolveChallenge(game, challenger.id, challengeResponse.reasoning);
    }
    game.lastUpdate = Date.now();
  }
}

export class GameSession extends DurableObject<Env> {
  private game: ActiveGame | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/start' && request.method === 'POST') {
      return this.start(request);
    }

    await this.loadGame();
    if (!this.game) {
      return json({ error: 'Game not found' }, 404);
    }

    if (url.pathname === '/state' && request.method === 'GET') {
      return json(getFullGameState(this.game));
    }

    if (url.pathname === '/state-soft' && request.method === 'GET') {
      return json({ found: true, state: getFullGameState(this.game) });
    }

    if (url.pathname === '/step' && request.method === 'POST') {
      return this.step(request);
    }

    if (url.pathname === '/human/play' && request.method === 'POST') {
      return this.humanPlay(request);
    }

    if (url.pathname === '/human/challenge' && request.method === 'POST') {
      return this.humanChallenge(request);
    }

    if (url.pathname === '/auto' && request.method === 'POST') {
      const body = await readJsonBody(request);
      this.refreshSessionAdapter(body);
      const steps = Math.max(1, Math.min(20, Number(url.searchParams.get('steps')) || 1));
      for (let index = 0; index < steps && this.game.phase !== 'finished'; index += 1) {
        if (getAwaitingHumanAction(this.game)) break;
        if (publicGameCapReached(this.game)) {
          finishAtPublicCap(this.game);
          break;
        }
        this.game.stepCount += 1;
        await stepGame(this.game);
      }
      if (publicGameCapReached(this.game)) {
        finishAtPublicCap(this.game);
      }
      await this.persistGame();
      return json(getFullGameState(this.game));
    }

    return json({ error: 'Not found' }, 404);
  }

  async alarm(): Promise<void> {
    await this.loadGame();
    if (!this.game) return;
    if (this.game.expiresAt <= Date.now()) {
      await this.ctx.storage.deleteAll();
      this.game = null;
      return;
    }
    await this.ctx.storage.setAlarm(this.game.expiresAt);
  }

  private async loadGame(): Promise<void> {
    if (this.game) return;
    const stored = await this.ctx.storage.get<StoredGame>('game');
    if (!stored) return;
    if (stored.expiresAt && stored.expiresAt <= Date.now()) {
      await this.ctx.storage.deleteAll();
      return;
    }

    this.game = {
      ...stored,
      state: reviveState(stored.state),
      stepCount: stored.stepCount ?? 0,
      expiresAt: stored.expiresAt ?? Date.now() + PUBLIC_GAME_TTL_MS,
      adapter: createAdapterForProvider(stored.provider),
    };
  }

  private async persistGame(): Promise<void> {
    if (!this.game) return;
    refreshGameExpiry(this.game);
    const { adapter: _adapter, ...stored } = this.game;
    await this.ctx.storage.put('game', stored);
    await this.ctx.storage.setAlarm(stored.expiresAt);
  }

  private refreshSessionAdapter(body: Record<string, unknown>): void {
    if (!this.game || this.game.provider !== 'nim') return;
    const apiKey = readSessionApiKey(body);
    if (!apiKey) return;
    this.game.adapter = createAdapterForProvider('nim', apiKey);
  }

  private async start(request: Request): Promise<Response> {
    const body = await readJsonBody(request);
    const provider: ActiveGame['provider'] = body.provider === 'nim' ? 'nim' : 'mock';
    const apiKey = readSessionApiKey(body);

    if (provider === 'nim' && !apiKey) {
      return json({ error: 'Session NVIDIA API key required for live model play' }, 400);
    }

    const gameId = typeof body.gameId === 'string' ? body.gameId : `game_${Date.now()}`;
    const experimentId = ([0, 1, 2, 3].includes(Number(body.experimentId)) ? Number(body.experimentId) : 1) as ExperimentId;
    const seats = buildPlayerSeats(body);
    const state = reviveState(createGameState(gameId, experimentId, seats));
    const humanPlayerId = state.players.find((player) => isHumanPlayer(player))?.id ?? null;

    state.metadata = {
      logSchemaVersion: 4,
      provider,
      promptVersion: provider === 'nim' ? PROMPT_VERSION : 'public-demo',
      promptHash: provider === 'nim' ? getPromptHash() : 'public-demo',
      providerBaseUrl: provider === 'nim' ? 'https://integrate.api.nvidia.com/v1' : undefined,
    };

    this.game = {
      state,
      adapter: createAdapterForProvider(provider, apiKey),
      pendingTurn: null,
      challengeQueue: [],
      phase: 'waiting',
      lastUpdate: Date.now(),
      stepInProgress: false,
      humanPlayerId,
      hidePrivateState: humanPlayerId !== null,
      provider,
      stepCount: 0,
      expiresAt: Date.now() + PUBLIC_GAME_TTL_MS,
    };

    await this.persistGame();
    return json(getFullGameState(this.game));
  }

  private async step(request: Request): Promise<Response> {
    if (!this.game) return json({ error: 'Game not found' }, 404);
    const body = await readJsonBody(request);
    this.refreshSessionAdapter(body);

    if (publicGameCapReached(this.game)) {
      finishAtPublicCap(this.game);
      await this.persistGame();
      return json(getFullGameState(this.game));
    }

    if (this.game.stepInProgress) {
      return json({ ...getFullGameState(this.game), stepInProgress: true });
    }

    this.game.stepInProgress = true;
    this.game.stepCount += 1;
    await this.persistGame();

    try {
      await stepGame(this.game);
      if (publicGameCapReached(this.game)) {
        finishAtPublicCap(this.game);
      }
      this.game.stepInProgress = false;
      await this.persistGame();
      return json(getFullGameState(this.game));
    } catch (error) {
      this.game.stepInProgress = false;
      await this.persistGame();
      return json({ error: 'Step failed', details: String(error) }, 500);
    }
  }

  private async humanPlay(request: Request): Promise<Response> {
    if (!this.game) return json({ error: 'Game not found' }, 404);
    const awaitingHumanAction = getAwaitingHumanAction(this.game);
    if (!awaitingHumanAction || awaitingHumanAction.type !== 'play') {
      return json({ error: 'Human play is not expected right now' }, 409);
    }

    const body = await readJsonBody(request);
    const cardsToPlay = Array.isArray(body.cardsToPlay)
      ? body.cardsToPlay.filter((card): card is string => typeof card === 'string')
      : [];
    const currentPlayer = getCurrentPlayer(this.game.state);
    const normalizedPlay = normalizePlaySelection(cardsToPlay, currentPlayer.hand, cardsToPlay.length);
    const turn = processPlay(
      this.game.state,
      currentPlayer.id,
      normalizedPlay.actualCards,
      normalizedPlay.claimedCount,
      'Human player'
    );

    turn.playResponseTimeMs = 0;
    this.game.pendingTurn = turn;
    this.game.challengeQueue = getOtherPlayers(this.game.state).map((player) => player.id);
    this.game.phase = 'challenging';
    this.game.lastUpdate = Date.now();
    await this.persistGame();
    return json(getFullGameState(this.game));
  }

  private async humanChallenge(request: Request): Promise<Response> {
    if (!this.game) return json({ error: 'Game not found' }, 404);
    const awaitingHumanAction = getAwaitingHumanAction(this.game);
    if (!awaitingHumanAction || awaitingHumanAction.type !== 'challenge' || !this.game.pendingTurn) {
      return json({ error: 'Human challenge is not expected right now' }, 409);
    }

    const body = await readJsonBody(request);
    const shouldChallenge = body.challenge === true;
    const challengerId = this.game.challengeQueue.shift();
    if (!challengerId || challengerId !== awaitingHumanAction.playerId) {
      return json({ error: 'Human challenge order is out of sync' }, 409);
    }

    const challenger = this.game.state.players.find((player) => player.id === challengerId);
    recordChallengeDecision(
      this.game.pendingTurn,
      challengerId,
      challenger?.modelId || challengerId,
      shouldChallenge,
      shouldChallenge ? 'Human player called Bullshit.' : 'Human player passed.',
      0
    );

    if (shouldChallenge) {
      this.game.pendingTurn.challengeResponseTimeMs = 0;
      resolveChallenge(this.game, challengerId, 'Human player called Bullshit.');
    } else if (this.game.challengeQueue.length === 0) {
      acceptPendingTurn(this.game);
    }

    this.game.lastUpdate = Date.now();
    await this.persistGame();
    return json(getFullGameState(this.game));
  }
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const clientIp = getClientIp(request);
  const apiLimit = checkRateLimit(`api:${clientIp}`, API_RATE_LIMIT, 'Too many public demo API requests');
  if (apiLimit) return apiLimit;

  if (pathname === '/api/runtime' && request.method === 'GET') {
    return json({
      defaultProvider: 'mock',
      hasServerApiKey: false,
      hasServerBaseUrl: false,
      liveProviderAvailable: liveNimEnabled(env),
      sessionApiKeysSupported: true,
      publicDemo: true,
    });
  }

  if (pathname === '/api/stats' && request.method === 'GET') {
    return json(PUBLIC_DEMO_STATS);
  }

  if (
    (pathname === '/api/stats/compare' || pathname === '/api/research/stats' || pathname === '/api/research/compare') &&
    request.method === 'GET'
  ) {
    return json(PUBLIC_DEMO_STATS);
  }

  if (pathname === '/api/game/start' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const startLimit = checkRateLimit(`start:${clientIp}`, GAME_START_RATE_LIMIT, 'Too many new public demo games');
    if (startLimit) return startLimit;
    if (body.provider === 'nim' && !liveNimEnabled(env)) {
      return json({ error: 'Live model play is temporarily disabled on this public demo' }, 503);
    }
    const gameId = `game_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const id = env.GAME_SESSIONS.idFromName(gameId);
    const stub = env.GAME_SESSIONS.get(id);
    return stub.fetch(new Request(new URL('/start', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, gameId }),
    }));
  }

  const gameMatch = pathname.match(/^\/api\/game\/([^/]+)\/(state|step|auto|human\/play|human\/challenge)$/);
  if (gameMatch) {
    const [, gameId, action] = gameMatch;
    const bodyText = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
    const body = bodyText.trim() ? JSON.parse(bodyText) as Record<string, unknown> : {};
    const sessionApiKey = readSessionApiKey(body);
    if ((action === 'step' || action === 'auto') && sessionApiKey) {
      if (!liveNimEnabled(env)) {
        return json({ error: 'Live model play is temporarily disabled on this public demo' }, 503);
      }
      const liveStepLimit = checkRateLimit(`live-step:${clientIp}`, LIVE_STEP_RATE_LIMIT, 'Too many live model steps');
      if (liveStepLimit) return liveStepLimit;
    }
    const id = env.GAME_SESSIONS.idFromName(gameId);
    const stub = env.GAME_SESSIONS.get(id);
    const targetPath = action === 'state' && url.searchParams.get('soft') === '1' ? '/state-soft' : `/${action}`;
    return stub.fetch(new Request(new URL(`${targetPath}${url.search}`, request.url), {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : bodyText,
    }));
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    if (url.pathname === '/stats.html') {
      return redirect('/research/');
    }

    if (url.pathname === '/research') {
      return redirect('/research/');
    }

    if (url.pathname === '/') {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }

    if (url.pathname === '/research/') {
      return env.ASSETS.fetch(new Request(new URL('/research/index.html', request.url), request));
    }

    return env.ASSETS.fetch(request);
  },
};
