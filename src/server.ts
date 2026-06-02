import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { GameState, ExperimentId, MODELS, Card, Turn, PlayerSeatConfig } from './types/game.js';
import { createGameState, getCurrentPlayer, getOtherPlayers, processPlay, processChallenge, advanceTurn, checkWinner, finalizeGame } from './engine/game-state.js';
import { LLMAdapter } from './engine/turn-manager.js';
import { APIConnectionError as NimAPIConnectionError } from './llm/nim-api.js';
import { buildClientGameState, getAwaitingHumanAction } from './server-state.js';
import {
  buildRunMetadata,
  detectProvider,
  createAdapter as createProviderAdapter,
  getProviderDisplayName,
  Provider,
  ProviderRuntimeConfig,
} from './llm/provider.js';
import { GameLogger, selectComparableGameCohort, isBenchmarkCompleteGame } from './logging/game-logger.js';
import { calculateAllStats, calculateCompareStatsRows } from './metrics/player-stats.js';
import { normalizePlaySelection } from './engine/play-rules.js';

const PORT = 3001;
const RESEARCH_APP_URL = process.env.RESEARCH_APP_URL || 'http://localhost:3002';
const UI_DIR = path.join(process.cwd(), 'ui');
const LOGS_DIR = path.join(process.cwd(), 'logs/games');
const FROZEN_ARTIFACTS_DIR = path.join(process.cwd(), 'paper/arxiv/artifacts/frozen');
const HUMAN_MODEL_ID = 'human/player';
const DEFAULT_HUMAN_NAME = 'You';
const MODEL_SET = new Set<string>(MODELS as readonly string[]);

// Active games with step-by-step execution
interface ActiveGame {
  state: GameState;
  adapter: LLMAdapter;
  provider: Provider;
  providerConfig: ProviderRuntimeConfig;
  pendingTurn: Turn | null;
  challengeQueue: string[]; // Player IDs who can still challenge
  phase: 'waiting' | 'playing' | 'challenging' | 'finished';
  lastUpdate: number;
  stepInProgress: boolean; // Lock to prevent concurrent step calls
  errorCount: number; // Track consecutive errors for this game
  lastErrorTime: number; // Time of last error
  humanPlayerId: string | null;
  hidePrivateState: boolean;
  persistLog: boolean;
}

interface FrozenResearchManifest {
  totalGamesFound: number;
  comparableCohort: {
    schemaVersion: number;
    provider: string;
    promptVersion?: string;
    promptHash?: string;
    size: number;
  };
  countsByExperiment: Record<string, {
    included: number;
    excludedMixedCohort: number;
    excludedTurnCap: number;
    excludedContextLimit?: number;
    excludedProviderError?: number;
    excludedParseFailure?: number;
    excludedIncomplete?: number;
  }>;
  excludedGamesByReason?: Record<string, string[]>;
}

interface FrozenResearchRow {
  experimentId: number;
  modelId: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  totalPlays: number;
  totalLies: number;
  lieFrequency: number;
  successfulLies: number;
  lieSuccessRate: number;
  truthfulAvailableTurns: number;
  truthfulUnavailableTurns: number;
  truthfulAvailableTurnShare: number;
  truthfulUnavailableTurnShare: number;
  optionalLies: number;
  optionalLieTurnShare: number;
  optionalLieRateGivenTruthfulAvailable: number;
  challengesMade: number;
  challengeOpportunities: number;
  paranoiaFrequency: number;
  correctChallenges: number;
  challengeAccuracy: number;
  instructionViolations: number | null;
  instructionViolationRate: number | null;
}

interface FrozenResearchCache {
  manifest: FrozenResearchManifest;
  rowsByExperiment: Record<string, FrozenResearchRow[]>;
  compareRows: FrozenResearchRow[];
}

const activeGames = new Map<string, ActiveGame>();
let frozenResearchCache: FrozenResearchCache | null = null;

// MIME types
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function isHumanPlayer(player: { modelId: string; role?: string }): boolean {
  return player.role === 'human' || player.modelId === HUMAN_MODEL_ID;
}

function sendRedirect(res: http.ServerResponse, location: string, statusCode = 302): void {
  res.writeHead(statusCode, {
    Location: location,
    'Cache-Control': 'no-store',
  });
  res.end();
}

function shuffleArray<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getPlayerLabel(player: { displayName?: string; modelId: string }): string {
  return player.displayName || player.modelId;
}

function getRequestedProvider(body: any, runtimeConfig: ProviderRuntimeConfig): Provider | null {
  const requested = body.provider as Provider | undefined;
  if (requested === 'mock') {
    return 'mock';
  }

  if (requested === 'nim') {
    return detectProvider(runtimeConfig) === 'nim' ? 'nim' : null;
  }

  return detectProvider(runtimeConfig);
}

function pickOpponentModels(body: any): string[] {
  const requestedOpponentIds: string[] = Array.isArray(body.opponentModelIds)
    ? body.opponentModelIds.filter((modelId: unknown): modelId is string => typeof modelId === 'string' && MODEL_SET.has(modelId))
    : [];
  const uniqueRequested: string[] = [...new Set(requestedOpponentIds)];
  if (uniqueRequested.length >= 3) {
    return uniqueRequested.slice(0, 3);
  }

  const remainingPool = shuffleArray(MODELS.filter((modelId) => !uniqueRequested.includes(modelId)));
  return [...uniqueRequested, ...remainingPool.slice(0, 3 - uniqueRequested.length)];
}

function buildPlayerSeats(body: any): PlayerSeatConfig[] {
  const interactive = body.interactive === true;

  if (!interactive) {
    const requestedModelIds: string[] = Array.isArray(body.modelIds)
      ? body.modelIds.filter((modelId: unknown): modelId is string => typeof modelId === 'string' && MODEL_SET.has(modelId))
      : [];
    const uniqueRequested: string[] = [...new Set(requestedModelIds)];
    const chosenModels: string[] = uniqueRequested.length === 4 ? uniqueRequested : shuffleArray(MODELS).slice(0, 4);
    return chosenModels.map((modelId) => ({ modelId, role: 'model' }));
  }

  const humanName = typeof body.humanName === 'string' && body.humanName.trim().length > 0
    ? body.humanName.trim().slice(0, 40)
    : DEFAULT_HUMAN_NAME;

  const seats: PlayerSeatConfig[] = [
    { modelId: HUMAN_MODEL_ID, displayName: humanName, role: 'human' },
    ...pickOpponentModels(body).map((modelId) => ({ modelId, role: 'model' as const })),
  ];

  return shuffleArray(seats);
}

function createAdapterForGame(provider: Provider, modelIds: readonly string[], runtimeConfig: ProviderRuntimeConfig): LLMAdapter {
  return createProviderAdapter(provider, modelIds, runtimeConfig);
}

const logger = new GameLogger(LOGS_DIR);

function getModelsFromGames(games: { players: { modelId: string }[] }[]): string[] {
  return [...new Set(games.flatMap((game) => game.players.map((player) => player.modelId)))].sort();
}

// Parse JSON body
async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Send JSON response
function sendJSON(res: http.ServerResponse, data: any, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function handleGetRuntimeStatus(res: http.ServerResponse) {
  sendJSON(res, {
    defaultProvider: detectProvider(),
    hasServerApiKey: Boolean(process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY),
    hasServerBaseUrl: Boolean(process.env.NVIDIA_NIM_BASE_URL),
  });
}

function parseCsvRows(csvText: string): string[][] {
  return csvText
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(','));
}

function parseNullableNumber(value: string | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadFrozenResearchData(): FrozenResearchCache {
  if (frozenResearchCache) {
    return frozenResearchCache;
  }

  const manifestPath = path.join(FROZEN_ARTIFACTS_DIR, 'cohort_manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as FrozenResearchManifest;
  const rowsByExperiment: Record<string, FrozenResearchRow[]> = {};
  const compareRows: FrozenResearchRow[] = [];

  for (const experimentId of ['0', '1', '2', '3']) {
    const csvPath = path.join(FROZEN_ARTIFACTS_DIR, `player_stats_exp${experimentId}.csv`);
    const csv = fs.readFileSync(csvPath, 'utf8');
    const [headerRow, ...dataRows] = parseCsvRows(csv);
    const columnIndex = Object.fromEntries(headerRow.map((name, index) => [name, index]));

    const rows = dataRows.map((cells) => ({
      experimentId: Number(experimentId),
      modelId: cells[columnIndex.model_id] || '',
      gamesPlayed: parseRequiredNumber(cells[columnIndex.games_played]),
      wins: parseRequiredNumber(cells[columnIndex.wins]),
      winRate: parseRequiredNumber(cells[columnIndex.win_rate]),
      totalPlays: parseRequiredNumber(cells[columnIndex.total_plays]),
      totalLies: parseRequiredNumber(cells[columnIndex.total_lies]),
      lieFrequency: parseRequiredNumber(cells[columnIndex.lie_frequency]),
      successfulLies: parseRequiredNumber(cells[columnIndex.successful_lies]),
      lieSuccessRate: parseRequiredNumber(cells[columnIndex.lie_success_rate]),
      truthfulAvailableTurns: parseRequiredNumber(cells[columnIndex.truthful_available_turns]),
      truthfulUnavailableTurns: parseRequiredNumber(cells[columnIndex.truthful_unavailable_turns]),
      truthfulAvailableTurnShare: parseRequiredNumber(cells[columnIndex.truthful_available_turn_share]),
      truthfulUnavailableTurnShare: parseRequiredNumber(cells[columnIndex.truthful_unavailable_turn_share]),
      optionalLies: parseRequiredNumber(cells[columnIndex.optional_lies]),
      optionalLieTurnShare: parseRequiredNumber(cells[columnIndex.optional_lie_turn_share]),
      optionalLieRateGivenTruthfulAvailable: parseRequiredNumber(cells[columnIndex.optional_lie_rate_given_truthful_available]),
      challengesMade: parseRequiredNumber(cells[columnIndex.challenges_made]),
      challengeOpportunities: parseRequiredNumber(cells[columnIndex.challenge_opportunities]),
      paranoiaFrequency: parseRequiredNumber(cells[columnIndex.paranoia_frequency]),
      correctChallenges: parseRequiredNumber(cells[columnIndex.correct_challenges]),
      challengeAccuracy: parseRequiredNumber(cells[columnIndex.challenge_accuracy]),
      instructionViolations: parseNullableNumber(cells[columnIndex.instruction_violations]),
      instructionViolationRate: parseNullableNumber(cells[columnIndex.instruction_violation_rate]),
    }));

    rowsByExperiment[experimentId] = rows;
    compareRows.push(...rows);
  }

  frozenResearchCache = {
    manifest,
    rowsByExperiment,
    compareRows,
  };

  return frozenResearchCache;
}

// SSE helpers for streaming
function startSSE(res: http.ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
}

function sendSSE(res: http.ServerResponse, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Serve static files
function serveStatic(res: http.ServerResponse, filepath: string) {
  const ext = path.extname(filepath);
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

function saveGameLogIfEnabled(game: ActiveGame) {
  if (!game.persistLog) {
    return;
  }

  const log = logger.stateToLog(game.state);
  logger.saveGameLog(log);
}

function completeGameIfWon(game: ActiveGame): boolean {
  const winner = checkWinner(game.state);
  if (!winner) {
    return false;
  }

  const winnerPlayer = game.state.players.find((player) => player.id === winner);
  console.log(`[game] 🏆 WINNER: ${getPlayerLabel(winnerPlayer || { modelId: winner })} after ${game.state.turns.length} turns`);
  finalizeGame(game.state, winner);
  game.phase = 'finished';
  saveGameLogIfEnabled(game);
  return true;
}

// Validate game state before processing steps
function validateGameState(game: ActiveGame): { valid: boolean; error?: string } {
  // Check for required state properties
  if (!game.state) {
    return { valid: false, error: 'Game state is missing' };
  }
  
  if (!game.state.players || game.state.players.length === 0) {
    return { valid: false, error: 'No players in game state' };
  }
  
  // Validate current player index
  if (game.state.currentPlayerIndex < 0 || game.state.currentPlayerIndex >= game.state.players.length) {
    return { valid: false, error: `Invalid currentPlayerIndex: ${game.state.currentPlayerIndex}` };
  }
  
  // Validate phase consistency
  if (game.phase === 'challenging' && !game.pendingTurn) {
    return { valid: false, error: 'Challenge phase without pending turn' };
  }
  
  // Check for stale step lock (if step has been in progress for >5 minutes, something went wrong)
  if (game.stepInProgress) {
    const stepDuration = Date.now() - game.lastUpdate;
    if (stepDuration > 5 * 60 * 1000) {
      console.log(`[validate] Step lock stale (${Math.round(stepDuration / 1000)}s), clearing...`);
      game.stepInProgress = false;
    }
  }
  
  return { valid: true };
}

// Get visible state for UI
function getFullGameState(game: ActiveGame) {
  return buildClientGameState(game);
}

// Start a new game
async function handleStartGame(req: http.IncomingMessage, res: http.ServerResponse) {
  const body = await parseBody(req);
  const experimentId = (body.experimentId || 1) as ExperimentId;
  const providerConfig: ProviderRuntimeConfig = {
    apiKey: typeof body.apiKey === 'string' && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined,
    baseUrl: typeof body.baseUrl === 'string' && body.baseUrl.trim().length > 0 ? body.baseUrl.trim() : undefined,
  };
  const provider = getRequestedProvider(body, providerConfig);
  if (!provider) {
    sendJSON(res, { error: 'NVIDIA API key required for live model play' }, 400);
    return;
  }

  const seats = buildPlayerSeats(body);

  const gameId = `game_${Date.now()}`;
  const state = createGameState(gameId, experimentId, seats);
  const adapter = createAdapterForGame(provider, state.players.map((player) => player.modelId), providerConfig);
  const humanPlayerId = state.players.find((player) => isHumanPlayer(player))?.id ?? null;
  const hidePrivateState = humanPlayerId !== null;
  const persistLog = body.persistLogs === true || (!hidePrivateState && !providerConfig.apiKey && body.persistLogs !== false);

  state.metadata = buildRunMetadata(provider, state.players.map((player) => player.modelId), providerConfig);
  console.log(`\n[game] New game ${gameId} (experiment ${experimentId}, adapter: ${provider.toUpperCase()}, interactive: ${hidePrivateState ? 'yes' : 'no'})`);
  console.log(`[game] Players: ${state.players.map((player) => getPlayerLabel(player)).join(', ')}`);

  const game: ActiveGame = {
    state,
    adapter,
    provider,
    providerConfig,
    pendingTurn: null,
    challengeQueue: [],
    phase: 'waiting',
    lastUpdate: Date.now(),
    stepInProgress: false,
    errorCount: 0,
    lastErrorTime: 0,
    humanPlayerId,
    hidePrivateState,
    persistLog,
  };

  activeGames.set(gameId, game);

  sendJSON(res, getFullGameState(game));
}

function buildVisibleStateForPlayer(game: ActiveGame, playerId: string, pileSize: number = game.state.pile.length) {
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
        Object.entries(turn.handSizesAfterTurn).map(([playerId, handSize]) => [
          game.state.players.find((entry) => entry.id === playerId)?.modelId || playerId,
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
  responseTimeMs?: number,
  tokenUsage?: Turn['challengeTokenUsage'],
  tokenUsageIncomplete?: boolean,
  decisionTrace?: NonNullable<Turn['challengeDecisions']>[number]['decisionTrace']
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
    tokenUsage,
    tokenUsageIncomplete,
    decisionTrace,
  });
}

function acceptPendingTurn(game: ActiveGame, logPrefix: string) {
  if (!game.pendingTurn) {
    return;
  }

  console.log(`${logPrefix}   No challenge — turn accepted`);
  advanceTurn(game.state, game.pendingTurn);
  game.pendingTurn = null;
  game.phase = 'waiting';
  completeGameIfWon(game);
}

function resolveChallenge(game: ActiveGame, challengerId: string, reasoning: string, logPrefix: string) {
  if (!game.pendingTurn) {
    return;
  }

  const correct = game.pendingTurn.wasLie;
  console.log(`${logPrefix}   Challenge ${correct ? 'CORRECT (was a lie)' : 'WRONG (was truthful)'}`);
  processChallenge(game.state, game.pendingTurn, challengerId, reasoning);
  advanceTurn(game.state, game.pendingTurn);
  game.pendingTurn = null;
  game.challengeQueue = [];
  game.phase = 'waiting';
  completeGameIfWon(game);
}

// Advance the game by one step
async function handleNextStep(res: http.ServerResponse, gameId: string, stream = false) {
  const game = activeGames.get(gameId);
  if (!game) {
    if (stream) { startSSE(res); sendSSE(res, 'error', { error: 'Game not found' }); res.end(); }
    else sendJSON(res, { error: 'Game not found' }, 404);
    return;
  }

  // Validate game state
  const stateValidation = validateGameState(game);
  if (!stateValidation.valid) {
    console.error(`[step] Invalid game state for ${gameId}: ${stateValidation.error}`);
    if (stream) { 
      startSSE(res); 
      sendSSE(res, 'error', { error: 'Invalid game state', details: stateValidation.error }); 
      res.end(); 
    }
    else sendJSON(res, { error: 'Invalid game state', details: stateValidation.error }, 500);
    return;
  }

  if (game.phase === 'finished') {
    if (stream) { startSSE(res); sendSSE(res, 'complete', getFullGameState(game)); res.end(); }
    else sendJSON(res, getFullGameState(game));
    return;
  }

  if (getAwaitingHumanAction(game)) {
    if (stream) { startSSE(res); sendSSE(res, 'complete', getFullGameState(game)); res.end(); }
    else sendJSON(res, getFullGameState(game));
    return;
  }

  if (game.stepInProgress) {
    console.log(`[step] BLOCKED — step already in progress for ${gameId}`);
    if (stream) { startSSE(res); sendSSE(res, 'blocked', { stepInProgress: true }); res.end(); }
    else sendJSON(res, { ...getFullGameState(game), stepInProgress: true });
    return;
  }

  game.stepInProgress = true;
  if (stream) startSSE(res);

  try {
    // Phase: waiting -> playing (get play decision)
    if (game.phase === 'waiting') {
      const currentPlayer = getCurrentPlayer(game.state);
      console.log(`[step] Turn ${game.state.turns.length + 1} — ${getPlayerLabel(currentPlayer)} is playing (rank: ${game.state.currentRank}, hand: ${currentPlayer.hand.length} cards)`);

      const visibleState = buildVisibleStateForPlayer(game, currentPlayer.id);

      if (stream) sendSSE(res, 'thinking', { playerId: currentPlayer.id, modelId: currentPlayer.modelId, type: 'play' });

      console.log(`[step]   Calling ${currentPlayer.modelId} for play decision...`);
      const startTime = Date.now();
      const onToken = stream && !game.hidePrivateState ? (text: string) => sendSSE(res, 'token', { text }) : undefined;
      const playResponse = await game.adapter.getPlayDecision(
        currentPlayer.id,
        currentPlayer.modelId,
        visibleState,
        game.state.experimentId,
        onToken
      );
      console.log(`[step]   Response in ${Date.now() - startTime}ms — plays ${playResponse.cards_to_play.join(', ')} (claims ${playResponse.claim_count})`);

      const normalizedPlay = normalizePlaySelection(
        playResponse.cards_to_play,
        currentPlayer.hand,
        playResponse.claim_count
      );
      for (const note of normalizedPlay.notes) {
        console.log(`[step]   WARNING: ${note}`);
      }

      // Process the play
      const turn = processPlay(
        game.state,
        currentPlayer.id,
        normalizedPlay.actualCards,
        normalizedPlay.claimedCount,
        playResponse.reasoning
      );

      const lieStr = turn.wasLie ? 'LIE' : 'TRUTH';
      console.log(`[step]   Play processed: ${turn.claimedCount}× ${turn.claimedRank} (${lieStr})`);

      // Attach token usage to the turn
      turn.playResponseTimeMs = playResponse.responseTimeMs;
      turn.playTokenUsage = playResponse.tokenUsage;
      turn.playTokenUsageIncomplete = playResponse.tokenUsageIncomplete;
      turn.playDecisionTrace = playResponse.decisionTrace;

      game.pendingTurn = turn;
      game.challengeQueue = getOtherPlayers(game.state).map(p => p.id);
      game.phase = 'challenging';
      game.lastUpdate = Date.now();
    }
    // Phase: challenging -> check each challenger
    else if (game.phase === 'challenging' && game.pendingTurn) {
      if (game.challengeQueue.length === 0) {
        acceptPendingTurn(game, '[step]');
      } else {
        // Get next challenger's decision
        const challengerId = game.challengeQueue.shift()!;
        const challenger = game.state.players.find(p => p.id === challengerId)!;
        const currentPlayer = getCurrentPlayer(game.state);

        console.log(`[step]   Asking ${challenger.modelId} whether to challenge...`);
        if (stream) sendSSE(res, 'thinking', { playerId: challenger.id, modelId: challenger.modelId, type: 'challenge' });

        const visibleState = buildVisibleStateForPlayer(
          game,
          challenger.id,
          game.state.pile.length - game.pendingTurn.actualCards.length
        );

        const startTime = Date.now();
        const onToken = stream && !game.hidePrivateState ? (text: string) => sendSSE(res, 'token', { text }) : undefined;
        const challengeResponse = await game.adapter.getChallengeDecision(
          challenger.id,
          challenger.modelId,
          visibleState,
          {
            playerId: currentPlayer.modelId,
            claimedCount: game.pendingTurn.claimedCount,
            claimedRank: game.pendingTurn.claimedRank,
          },
          game.state.experimentId,
          onToken
        );
        console.log(`[step]   Response in ${Date.now() - startTime}ms — ${challengeResponse.challenge ? 'CHALLENGE!' : 'pass'}`);
        recordChallengeDecision(
          game.pendingTurn,
          challenger.id,
          challenger.modelId,
          challengeResponse.challenge,
          challengeResponse.reasoning,
          challengeResponse.responseTimeMs,
          challengeResponse.tokenUsage,
          challengeResponse.tokenUsageIncomplete,
          challengeResponse.decisionTrace
        );

        if (challengeResponse.challenge) {
          game.pendingTurn.challengeResponseTimeMs = challengeResponse.responseTimeMs;
          game.pendingTurn.challengeTokenUsage = challengeResponse.tokenUsage;
          game.pendingTurn.challengeTokenUsageIncomplete = challengeResponse.tokenUsageIncomplete;
          resolveChallenge(game, challenger.id, challengeResponse.reasoning, '[step]');
        }
        // If no challenge, continue to next potential challenger (loop continues)
      }

      game.lastUpdate = Date.now();
    }

    game.stepInProgress = false;
    game.errorCount = 0; // Reset error count on success
    if (stream) { sendSSE(res, 'complete', getFullGameState(game)); res.end(); }
    else sendJSON(res, getFullGameState(game));
  } catch (error) {
    game.stepInProgress = false;
    game.errorCount++;
    game.lastErrorTime = Date.now();
    
    console.error('[step] ERROR:', error);
    
    // Check if this is a connection error that requires adapter reset
    const errorStr = String(error);
    const isConnectionError = error instanceof NimAPIConnectionError ||
                              errorStr.includes('API connection unstable') ||
                              errorStr.includes('TimeoutError') ||
                              errorStr.includes('terminated');
    
    if (isConnectionError) {
      console.log('[step] Connection issue detected, resetting adapter...');
      // Create a new adapter with fresh connection
      game.adapter = createAdapterForGame(
        game.provider,
        game.state.players.map((player) => player.modelId),
        game.providerConfig
      );
      game.errorCount = 0; // Reset error count after adapter reset
      console.log('[step] Adapter reset complete. Client can retry the step.');
    }
    
    // If we've had too many errors in succession, pause the game
    if (game.errorCount >= 5) {
      console.error(`[step] Too many consecutive errors (${game.errorCount}), game may be in unstable state`);
      const errorMsg = isConnectionError 
        ? 'API connection unstable. Adapter has been reset. Please retry.'
        : 'Multiple consecutive errors. Please check game state before continuing.';
      
      if (stream && !res.writableEnded) {
        try { sendSSE(res, 'error', { error: errorMsg, details: String(error), resetAdapter: isConnectionError }); res.end(); } catch {}
      } else if (!stream) {
        sendJSON(res, { error: errorMsg, details: String(error), resetAdapter: isConnectionError }, 503);
      }
    } else {
      if (stream && !res.writableEnded) {
        try { sendSSE(res, 'error', { error: 'Step failed', details: String(error) }); res.end(); } catch {}
      } else if (!stream) {
        sendJSON(res, { error: 'Step failed', details: String(error) }, 500);
      }
    }
  }
}

// Get current game state
function handleGetGameState(res: http.ServerResponse, gameId: string, softMissing = false) {
  const game = activeGames.get(gameId);
  if (!game) {
    if (softMissing) {
      sendJSON(res, { found: false, gameId });
      return;
    }
    sendJSON(res, { error: 'Game not found' }, 404);
    return;
  }
  sendJSON(res, softMissing ? { found: true, state: getFullGameState(game) } : getFullGameState(game));
}

async function handleHumanPlay(req: http.IncomingMessage, res: http.ServerResponse, gameId: string) {
  const game = activeGames.get(gameId);
  if (!game) {
    sendJSON(res, { error: 'Game not found' }, 404);
    return;
  }

  const awaitingHumanAction = getAwaitingHumanAction(game);
  if (!awaitingHumanAction || awaitingHumanAction.type !== 'play') {
    sendJSON(res, { error: 'Human play is not expected right now' }, 409);
    return;
  }

  const body = await parseBody(req);
  const cardsToPlay = Array.isArray(body.cardsToPlay)
    ? body.cardsToPlay.filter((card: unknown): card is string => typeof card === 'string')
    : [];
  const reasoning = typeof body.reasoning === 'string' && body.reasoning.trim().length > 0
    ? body.reasoning.trim().slice(0, 280)
    : 'Human player';

  const currentPlayer = getCurrentPlayer(game.state);
  const normalizedPlay = normalizePlaySelection(cardsToPlay, currentPlayer.hand, cardsToPlay.length);
  for (const note of normalizedPlay.notes) {
    console.log(`[human] ${getPlayerLabel(currentPlayer)}: ${note}`);
  }

  const turn = processPlay(
    game.state,
    currentPlayer.id,
    normalizedPlay.actualCards,
    normalizedPlay.claimedCount,
    reasoning
  );

  turn.playResponseTimeMs = 0;
  console.log(`[human] ${getPlayerLabel(currentPlayer)} played ${turn.claimedCount}× ${turn.claimedRank}`);

  game.pendingTurn = turn;
  game.challengeQueue = getOtherPlayers(game.state).map((player) => player.id);
  game.phase = 'challenging';
  game.lastUpdate = Date.now();

  sendJSON(res, getFullGameState(game));
}

async function handleHumanChallenge(req: http.IncomingMessage, res: http.ServerResponse, gameId: string) {
  const game = activeGames.get(gameId);
  if (!game) {
    sendJSON(res, { error: 'Game not found' }, 404);
    return;
  }

  const awaitingHumanAction = getAwaitingHumanAction(game);
  if (!awaitingHumanAction || awaitingHumanAction.type !== 'challenge' || !game.pendingTurn) {
    sendJSON(res, { error: 'Human challenge is not expected right now' }, 409);
    return;
  }

  const body = await parseBody(req);
  const shouldChallenge = body.challenge === true;
  const reasoning = typeof body.reasoning === 'string' && body.reasoning.trim().length > 0
    ? body.reasoning.trim().slice(0, 280)
    : shouldChallenge ? 'Human player called Bullshit.' : 'Human player passed.';

  const challengerId = game.challengeQueue.shift();
  if (!challengerId || challengerId !== awaitingHumanAction.playerId) {
    sendJSON(res, { error: 'Human challenge order is out of sync' }, 409);
    return;
  }

  const challenger = game.state.players.find((player) => player.id === challengerId);
  recordChallengeDecision(
    game.pendingTurn,
    challengerId,
    challenger?.modelId || challengerId,
    shouldChallenge,
    reasoning,
    0
  );

  if (shouldChallenge) {
    game.pendingTurn.challengeResponseTimeMs = 0;
    resolveChallenge(game, challengerId, reasoning, '[human]');
  } else if (game.challengeQueue.length === 0) {
    acceptPendingTurn(game, '[human]');
  }

  game.lastUpdate = Date.now();
  sendJSON(res, getFullGameState(game));
}

// Auto-play: run until game ends or N steps
async function handleAutoPlay(res: http.ServerResponse, gameId: string, steps: number = 1) {
  const game = activeGames.get(gameId);
  if (!game) {
    sendJSON(res, { error: 'Game not found' }, 404);
    return;
  }

  for (let i = 0; i < steps && game.phase !== 'finished'; i++) {
    const progressed = await handleNextStepInternal(game);
    if (!progressed) {
      break;
    }
  }

  sendJSON(res, getFullGameState(game));
}

async function handleNextStepInternal(game: ActiveGame): Promise<boolean> {
  if (game.phase === 'finished') return false;
  if (getAwaitingHumanAction(game)) return false;

  if (game.phase === 'waiting') {
    const currentPlayer = getCurrentPlayer(game.state);
    console.log(`[auto] Turn ${game.state.turns.length + 1} — ${currentPlayer.modelId} playing (rank: ${game.state.currentRank})`);

    const visibleState = buildVisibleStateForPlayer(game, currentPlayer.id);

    const startTime = Date.now();
    const playResponse = await game.adapter.getPlayDecision(
      currentPlayer.id,
      currentPlayer.modelId,
      visibleState,
      game.state.experimentId
    );
    console.log(`[auto]   Play response in ${Date.now() - startTime}ms`);

    const normalizedPlay = normalizePlaySelection(
      playResponse.cards_to_play,
      currentPlayer.hand,
      playResponse.claim_count
    );
    for (const note of normalizedPlay.notes) {
      console.log(`[auto]   WARNING: ${note}`);
    }

    const turn = processPlay(
      game.state,
      currentPlayer.id,
      normalizedPlay.actualCards,
      normalizedPlay.claimedCount,
      playResponse.reasoning
    );
    turn.playResponseTimeMs = playResponse.responseTimeMs;
    turn.playTokenUsage = playResponse.tokenUsage;
    turn.playTokenUsageIncomplete = playResponse.tokenUsageIncomplete;
    turn.playDecisionTrace = playResponse.decisionTrace;
    console.log(`[auto]   ${turn.claimedCount}× ${turn.claimedRank} (${turn.wasLie ? 'LIE' : 'TRUTH'})`);

    game.pendingTurn = turn;
    game.challengeQueue = getOtherPlayers(game.state).map(p => p.id);
    game.phase = 'challenging';
  }

  // Process all challenges
  while (game.phase === 'challenging' && game.pendingTurn && game.challengeQueue.length > 0) {
    if (getAwaitingHumanAction(game)) {
      break;
    }

    const challengerId = game.challengeQueue.shift()!;
    const challenger = game.state.players.find(p => p.id === challengerId)!;
    const currentPlayer = getCurrentPlayer(game.state);
    console.log(`[auto]   Asking ${challenger.modelId} to challenge...`);

    const visibleState = buildVisibleStateForPlayer(
      game,
      challenger.id,
      game.state.pile.length - game.pendingTurn.actualCards.length
    );

    const startTime = Date.now();
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
    console.log(`[auto]   Response in ${Date.now() - startTime}ms — ${challengeResponse.challenge ? 'CHALLENGE!' : 'pass'}`);
    recordChallengeDecision(
      game.pendingTurn,
      challenger.id,
      challenger.modelId,
      challengeResponse.challenge,
      challengeResponse.reasoning,
      challengeResponse.responseTimeMs,
      challengeResponse.tokenUsage,
      challengeResponse.tokenUsageIncomplete,
      challengeResponse.decisionTrace
    );

    if (challengeResponse.challenge) {
      game.pendingTurn.challengeResponseTimeMs = challengeResponse.responseTimeMs;
      game.pendingTurn.challengeTokenUsage = challengeResponse.tokenUsage;
      game.pendingTurn.challengeTokenUsageIncomplete = challengeResponse.tokenUsageIncomplete;
      resolveChallenge(game, challenger.id, challengeResponse.reasoning, '[auto]');
      break;
    }
  }

  if (game.phase === 'challenging' && game.pendingTurn && game.challengeQueue.length === 0) {
    acceptPendingTurn(game, '[auto]');
  }

  game.lastUpdate = Date.now();
  return true;
}

function handleGetGames(res: http.ServerResponse) {
  try {
    const games = logger.loadAllLogs().map(g => ({
      gameId: g.gameId,
      experimentId: g.experimentId,
      totalTurns: g.totalTurns,
      winner: g.winner,
    }));
    sendJSON(res, games);
  } catch (e) {
    sendJSON(res, []);
  }
}

function handleGetGame(res: http.ServerResponse, gameId: string) {
  const log = logger.loadGameLog(gameId);
  if (!log) {
    sendJSON(res, { error: 'Game not found' }, 404);
    return;
  }
  sendJSON(res, log);
}

function handleGetStats(res: http.ServerResponse, experiment?: string) {
  try {
    const expId = experiment ? parseInt(experiment) : undefined;
    const rawGames = logger.loadAllLogs(expId);
    const selection = selectComparableGameCohort(rawGames);
    const games = selection.games;
    const counts = logger.getGameCounts();
    const includedCount = games.filter(isBenchmarkCompleteGame).length;

    if (games.length === 0) {
      const placeholderStats: Record<string, any> = {};
      MODELS.forEach(m => {
        placeholderStats[m] = {
          gamesPlayed: 0, wins: 0, winRate: 0,
          lieFrequency: 0, lieSuccessRate: 0,
          paranoiaFrequency: 0, challengeAccuracy: 0,
        };
      });
      sendJSON(res, { stats: placeholderStats, counts: { total: 0, 1: 0, 2: 0, 3: 0 } });
      return;
    }

    const stats = calculateAllStats(getModelsFromGames(games), games, expId);
    const statsObj: Record<string, any> = {};
    stats.forEach((v, k) => statsObj[k] = v);

      sendJSON(res, {
      stats: statsObj,
      cohort: selection.cohort,
      excludedGames: selection.excludedGames,
      includedCount,
      counts: { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) },
    });
  } catch (e) {
    sendJSON(res, { error: 'Failed to load stats' }, 500);
  }
}

function handleGetStatsCompare(res: http.ServerResponse) {
  try {
    const rawGames = logger.loadAllLogs();
    const selection = selectComparableGameCohort(rawGames);
    const games = selection.games;
    const totalCounts = logger.getGameCounts();
    const includedCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    if (games.length === 0) {
      sendJSON(res, {
        rows: [],
        cohort: null,
        excludedGames: 0,
        counts: {
          includedByExperiment: includedCounts,
          totalByExperiment: totalCounts,
          total: Object.values(totalCounts).reduce((sum, value) => sum + value, 0),
        },
      });
      return;
    }

    for (const experimentId of [0, 1, 2, 3]) {
      includedCounts[experimentId] = games.filter(
        (game) => game.experimentId === experimentId && isBenchmarkCompleteGame(game)
      ).length;
    }

    sendJSON(res, {
      rows: calculateCompareStatsRows(MODELS, games),
      cohort: selection.cohort,
      excludedGames: selection.excludedGames,
      counts: {
        includedByExperiment: includedCounts,
        totalByExperiment: totalCounts,
        total: Object.values(totalCounts).reduce((sum, value) => sum + value, 0),
      },
    });
  } catch (e) {
    sendJSON(res, { error: 'Failed to load compare stats' }, 500);
  }
}

function handleGetResearchStats(res: http.ServerResponse, experiment?: string) {
  try {
    const experimentId = ['0', '1', '2', '3'].includes(String(experiment)) ? String(experiment) : '1';
    const frozen = loadFrozenResearchData();
    const rows = frozen.rowsByExperiment[experimentId] || [];
    const statsObj: Record<string, Omit<FrozenResearchRow, 'experimentId'>> = {};

    for (const row of rows) {
      const { experimentId: _ignored, ...stat } = row;
      statsObj[row.modelId] = stat;
    }

    const experimentCounts = frozen.manifest.countsByExperiment[experimentId];
    const excludedGames =
      (experimentCounts?.excludedMixedCohort || 0) +
      (experimentCounts?.excludedTurnCap || 0) +
      (experimentCounts?.excludedContextLimit || 0) +
      (experimentCounts?.excludedProviderError || 0) +
      (experimentCounts?.excludedParseFailure || 0) +
      (experimentCounts?.excludedIncomplete || 0);
    const countsByExperiment = Object.fromEntries(
      Object.entries(frozen.manifest.countsByExperiment).map(([key, value]) => [key, value.included])
    );

    sendJSON(res, {
      source: 'frozen-paper-cohort',
      stats: statsObj,
      cohort: frozen.manifest.comparableCohort,
      includedCount: experimentCounts?.included || 0,
      excludedGames,
      counts: {
        ...countsByExperiment,
        total: frozen.manifest.totalGamesFound,
      },
    });
  } catch (e) {
    console.error('research stats error:', e);
    sendJSON(res, { error: 'Failed to load frozen research stats' }, 500);
  }
}

function handleGetResearchCompare(res: http.ServerResponse) {
  try {
    const frozen = loadFrozenResearchData();
    const includedByExperiment = Object.fromEntries(
      Object.entries(frozen.manifest.countsByExperiment).map(([key, value]) => [key, value.included])
    );

    sendJSON(res, {
      source: 'frozen-paper-cohort',
      rows: frozen.compareRows,
      cohort: frozen.manifest.comparableCohort,
      excludedGames: 0,
      counts: {
        includedByExperiment,
        totalByExperiment: includedByExperiment,
        total: frozen.manifest.totalGamesFound,
      },
    });
  } catch (e) {
    console.error('research compare error:', e);
    sendJSON(res, { error: 'Failed to load frozen research comparison data' }, 500);
  }
}

// Request handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '/';

  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.slice(4);

    try {
      if (apiPath === '/game/start' && req.method === 'POST') {
        await handleStartGame(req, res);
      } else if (apiPath.match(/^\/game\/[^/]+\/state$/) && req.method === 'GET') {
        const gameId = apiPath.split('/')[2];
        handleGetGameState(res, gameId, parsedUrl.query.soft === '1');
      } else if (apiPath.match(/^\/game\/[^/]+\/human\/play$/) && req.method === 'POST') {
        const gameId = apiPath.split('/')[2];
        await handleHumanPlay(req, res, gameId);
      } else if (apiPath.match(/^\/game\/[^/]+\/human\/challenge$/) && req.method === 'POST') {
        const gameId = apiPath.split('/')[2];
        await handleHumanChallenge(req, res, gameId);
      } else if (apiPath.match(/^\/game\/[^/]+\/step$/) && req.method === 'POST') {
        const gameId = apiPath.split('/')[2];
        const stream = parsedUrl.query.stream === '1';
        await handleNextStep(res, gameId, stream);
      } else if (apiPath.match(/^\/game\/[^/]+\/auto$/) && req.method === 'POST') {
        const gameId = apiPath.split('/')[2];
        const steps = parseInt(parsedUrl.query.steps as string) || 1;
        await handleAutoPlay(res, gameId, steps);
      } else if (apiPath === '/games' && req.method === 'GET') {
        handleGetGames(res);
      } else if (apiPath.match(/^\/games\/[^/]+$/) && req.method === 'GET') {
        const gameId = apiPath.split('/')[2];
        handleGetGame(res, gameId);
      } else if (apiPath === '/stats' && req.method === 'GET') {
        handleGetStats(res, parsedUrl.query.experiment as string);
      } else if (apiPath === '/stats/compare' && req.method === 'GET') {
        handleGetStatsCompare(res);
      } else if (apiPath === '/research/stats' && req.method === 'GET') {
        handleGetResearchStats(res, parsedUrl.query.experiment as string);
      } else if (apiPath === '/research/compare' && req.method === 'GET') {
        handleGetResearchCompare(res);
      } else if (apiPath === '/runtime' && req.method === 'GET') {
        handleGetRuntimeStatus(res);
      } else {
        sendJSON(res, { error: 'Not found' }, 404);
      }
    } catch (e) {
      console.error('API error:', e);
      sendJSON(res, { error: 'Internal server error' }, 500);
    }
    return;
  }

  // Static files
  if (pathname === '/stats.html') {
    sendRedirect(res, `${RESEARCH_APP_URL}/`);
    return;
  }

  if (pathname === '/research' || pathname === '/research/' || pathname.startsWith('/research/')) {
    const redirectedPath = pathname === '/research' ? '/' : pathname.slice('/research'.length) || '/';
    const target = new URL(`${redirectedPath}${parsedUrl.search || ''}`, `${RESEARCH_APP_URL.replace(/\/$/, '')}/`);
    sendRedirect(res, target.toString());
    return;
  }

  let filepath = pathname === '/' ? '/index.html' : pathname;
  filepath = path.join(UI_DIR, filepath);

  if (!filepath.startsWith(UI_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  serveStatic(res, filepath);
});

server.listen(PORT, () => {
  const provider = detectProvider();
  const modeDisplay = getProviderDisplayName(provider);
  console.log(`
╔═══════════════════════════════════════════════════════╗
║      🃏 LLM Bullshit - Interactive Frontend 🃏        ║
╠═══════════════════════════════════════════════════════╣
║  Server running at http://localhost:${PORT}              ║
║                                                       ║
║  • Play against the model cohort                      ║
║  • Or watch full AI tables in spectator mode          ║
║  • Supports session-scoped NVIDIA API keys            ║
║                                                       ║
║  Mode: ${modeDisplay}
╚═══════════════════════════════════════════════════════╝
  `);
});
