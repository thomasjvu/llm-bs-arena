import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { GameState, ExperimentId, MODELS, Card, Turn } from './types/game.js';
import { createGameState, getCurrentPlayer, getOtherPlayers, processPlay, processChallenge, advanceTurn, checkWinner, finalizeGame, getNextRank } from './engine/game-state.js';
import { TurnManager, LLMAdapter } from './engine/turn-manager.js';
import { MockLLMAdapter } from './llm/llm-adapter.js';
import { APIConnectionError as FeatherlessAPIConnectionError } from './llm/featherless-api.js';
import { APIConnectionError as ChutesAPIConnectionError } from './llm/chutes-api.js';
import { APIConnectionError as NimAPIConnectionError } from './llm/nim-api.js';
import { buildRunMetadata, detectProvider, createAdapter as createProviderAdapter, getProviderDisplayName, Provider } from './llm/provider.js';
import { GameLogger, selectComparableGameCohort } from './logging/game-logger.js';
import { calculateAllStats } from './metrics/player-stats.js';
import { normalizePlaySelection } from './engine/play-rules.js';

const PORT = 3001;
const UI_DIR = path.join(process.cwd(), 'ui');
const LOGS_DIR = path.join(process.cwd(), 'logs/games');

// Active games with step-by-step execution
interface ActiveGame {
  state: GameState;
  adapter: LLMAdapter;
  pendingTurn: Turn | null;
  challengeQueue: string[]; // Player IDs who can still challenge
  phase: 'waiting' | 'playing' | 'challenging' | 'finished';
  lastUpdate: number;
  stepInProgress: boolean; // Lock to prevent concurrent step calls
  errorCount: number; // Track consecutive errors for this game
  lastErrorTime: number; // Time of last error
}

const activeGames = new Map<string, ActiveGame>();

// MIME types
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

function getProvider(): Provider {
  return detectProvider();
}

// Create LLM adapter
function createAdapter(): LLMAdapter {
  const provider = getProvider();

  if (provider === 'mock') {
    console.log('[server] Using mock LLM adapter');
    return new MockLLMAdapter(0.4, 0.25);
  }

  return createProviderAdapter(provider);
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

// Format card for sending to client
function formatCard(card: Card): string {
  return `${card.rank}${card.suit}`;
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

// Maximum turns to send to client to prevent performance issues in long games
const MAX_CLIENT_TURNS = 100;

// Get visible state for UI (shows all hands for spectator view)
function getFullGameState(game: ActiveGame) {
  const state = game.state;

  // Determine who is currently "thinking" (next to be queried by the server)
  let thinkingPlayerId: string | null = null;
  if (game.phase === 'waiting') {
    thinkingPlayerId = getCurrentPlayer(state).id;
  } else if (game.phase === 'challenging' && game.challengeQueue.length > 0) {
    thinkingPlayerId = game.challengeQueue[0];
  }

  // Limit turns sent to client for performance in long-running games
  // Always keep all turns internally for game logic, but only send recent ones to UI
  const totalTurns = state.turns.length;
  const recentTurns = totalTurns > MAX_CLIENT_TURNS 
    ? state.turns.slice(totalTurns - MAX_CLIENT_TURNS)
    : state.turns;

  return {
    gameId: state.gameId,
    experimentId: state.experimentId,
    phase: game.phase,
    players: state.players.map((p, i) => ({
      id: p.id,
      modelId: p.modelId,
      hand: p.hand.map(formatCard),
      handSize: p.hand.length,
      isActive: i === state.currentPlayerIndex,
      isEliminated: p.isEliminated,
    })),
    currentPlayerIndex: state.currentPlayerIndex,
    currentRank: state.currentRank,
    pile: state.pile.map(formatCard),
    pileSize: state.pile.length,
    turns: recentTurns,
    totalTurns: totalTurns, // Send actual count for display purposes
    pendingTurn: game.pendingTurn,
    winner: state.winner,
    winnerModel: state.winner ? state.players.find(p => p.id === state.winner)?.modelId : null,
    thinkingPlayerId,
  };
}

// Start a new game
async function handleStartGame(req: http.IncomingMessage, res: http.ServerResponse) {
  const body = await parseBody(req);
  const experimentId = (body.experimentId || 1) as ExperimentId;

  // Pick 4 random models
  const shuffled = [...MODELS].sort(() => Math.random() - 0.5);
  const players = shuffled.slice(0, 4);

  const gameId = `game_${Date.now()}`;
  const state = createGameState(gameId, experimentId, players);
  const adapter = createAdapter();

  const provider = getProvider();
  state.metadata = buildRunMetadata(provider);
  console.log(`\n[game] New game ${gameId} (experiment ${experimentId}, adapter: ${provider.toUpperCase()})`);
  console.log(`[game] Players: ${players.join(', ')}`);

  const game: ActiveGame = {
    state,
    adapter,
    pendingTurn: null,
    challengeQueue: [],
    phase: 'waiting',
    lastUpdate: Date.now(),
    stepInProgress: false,
    errorCount: 0,
    lastErrorTime: 0,
  };

  activeGames.set(gameId, game);

  sendJSON(res, getFullGameState(game));
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
      console.log(`[step] Turn ${game.state.turns.length + 1} — ${currentPlayer.modelId} is playing (rank: ${game.state.currentRank}, hand: ${currentPlayer.hand.length} cards)`);

      const visibleState = {
        hand: currentPlayer.hand,
        currentRank: game.state.currentRank,
        pileSize: game.state.pile.length,
        otherPlayersCounts: Object.fromEntries(
          game.state.players
            .filter(p => p.id !== currentPlayer.id && !p.isEliminated)
            .map(p => [p.modelId, p.hand.length])
        ),
        recentTurns: game.state.turns.slice(-5),
      };

      if (stream) sendSSE(res, 'thinking', { playerId: currentPlayer.id, modelId: currentPlayer.modelId, type: 'play' });

      console.log(`[step]   Calling ${currentPlayer.modelId} for play decision...`);
      const startTime = Date.now();
      const onToken = stream ? (text: string) => sendSSE(res, 'token', { text }) : undefined;
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

      game.pendingTurn = turn;
      game.challengeQueue = getOtherPlayers(game.state).map(p => p.id);
      game.phase = 'challenging';
      game.lastUpdate = Date.now();
    }
    // Phase: challenging -> check each challenger
    else if (game.phase === 'challenging' && game.pendingTurn) {
      if (game.challengeQueue.length === 0) {
        // No one challenged, advance turn
        console.log(`[step]   No challenge — turn accepted`);
        advanceTurn(game.state, game.pendingTurn);
        game.pendingTurn = null;
        game.phase = 'waiting';

        // Check for winner
        const winner = checkWinner(game.state);
        if (winner) {
          const winnerPlayer = game.state.players.find(p => p.id === winner);
          console.log(`[step] 🏆 WINNER: ${winnerPlayer?.modelId} after ${game.state.turns.length} turns`);
          finalizeGame(game.state, winner);
          game.phase = 'finished';

          // Save game log
          const log = logger.stateToLog(game.state);
          logger.saveGameLog(log);
        }
      } else {
        // Get next challenger's decision
        const challengerId = game.challengeQueue.shift()!;
        const challenger = game.state.players.find(p => p.id === challengerId)!;
        const currentPlayer = getCurrentPlayer(game.state);
        game.pendingTurn.challengeOfferedTo ??= [];
        game.pendingTurn.challengeOfferedTo.push(challenger.id);

        console.log(`[step]   Asking ${challenger.modelId} whether to challenge...`);
        if (stream) sendSSE(res, 'thinking', { playerId: challenger.id, modelId: challenger.modelId, type: 'challenge' });

        const visibleState = {
          hand: challenger.hand,
          currentRank: game.state.currentRank,
          pileSize: game.state.pile.length - game.pendingTurn.actualCards.length,
          otherPlayersCounts: Object.fromEntries(
            game.state.players
              .filter(p => p.id !== challenger.id && !p.isEliminated)
              .map(p => [p.modelId, p.hand.length])
          ),
          recentTurns: game.state.turns.slice(-5),
        };

        const startTime = Date.now();
        const onToken = stream ? (text: string) => sendSSE(res, 'token', { text }) : undefined;
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

        if (challengeResponse.challenge) {
          // Challenge happened!
          const correct = game.pendingTurn.wasLie;
          console.log(`[step]   Challenge ${correct ? 'CORRECT (was a lie)' : 'WRONG (was truthful)'}`);
          // Attach challenge token usage
          game.pendingTurn.challengeResponseTimeMs = challengeResponse.responseTimeMs;
          game.pendingTurn.challengeTokenUsage = challengeResponse.tokenUsage;
          processChallenge(game.state, game.pendingTurn, challenger.id, challengeResponse.reasoning);
          advanceTurn(game.state, game.pendingTurn);
          game.pendingTurn = null;
          game.challengeQueue = [];
          game.phase = 'waiting';

          // Check for winner
          const winner = checkWinner(game.state);
          if (winner) {
            const winnerPlayer = game.state.players.find(p => p.id === winner);
            console.log(`[step] 🏆 WINNER: ${winnerPlayer?.modelId} after ${game.state.turns.length} turns`);
            finalizeGame(game.state, winner);
            game.phase = 'finished';
            const log = logger.stateToLog(game.state);
            logger.saveGameLog(log);
          }
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
    const isConnectionError = error instanceof FeatherlessAPIConnectionError ||
                              error instanceof ChutesAPIConnectionError ||
                              error instanceof NimAPIConnectionError ||
                              errorStr.includes('API connection unstable') ||
                              errorStr.includes('TimeoutError') ||
                              errorStr.includes('terminated');
    
    if (isConnectionError) {
      console.log('[step] Connection issue detected, resetting adapter...');
      // Create a new adapter with fresh connection
      game.adapter = createAdapter();
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
function handleGetGameState(res: http.ServerResponse, gameId: string) {
  const game = activeGames.get(gameId);
  if (!game) {
    sendJSON(res, { error: 'Game not found' }, 404);
    return;
  }
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
    await handleNextStepInternal(game);
  }

  sendJSON(res, getFullGameState(game));
}

async function handleNextStepInternal(game: ActiveGame) {
  if (game.phase === 'finished') return;

  if (game.phase === 'waiting') {
    const currentPlayer = getCurrentPlayer(game.state);
    console.log(`[auto] Turn ${game.state.turns.length + 1} — ${currentPlayer.modelId} playing (rank: ${game.state.currentRank})`);

    const visibleState = {
      hand: currentPlayer.hand,
      currentRank: game.state.currentRank,
      pileSize: game.state.pile.length,
      otherPlayersCounts: Object.fromEntries(
        game.state.players
          .filter(p => p.id !== currentPlayer.id && !p.isEliminated)
          .map(p => [p.modelId, p.hand.length])
      ),
      recentTurns: game.state.turns.slice(-5),
    };

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
    console.log(`[auto]   ${turn.claimedCount}× ${turn.claimedRank} (${turn.wasLie ? 'LIE' : 'TRUTH'})`);

    game.pendingTurn = turn;
    game.challengeQueue = getOtherPlayers(game.state).map(p => p.id);
    game.phase = 'challenging';
  }

  // Process all challenges
  while (game.phase === 'challenging' && game.pendingTurn && game.challengeQueue.length > 0) {
    const challengerId = game.challengeQueue.shift()!;
    const challenger = game.state.players.find(p => p.id === challengerId)!;
    const currentPlayer = getCurrentPlayer(game.state);
    game.pendingTurn.challengeOfferedTo ??= [];
    game.pendingTurn.challengeOfferedTo.push(challenger.id);

    console.log(`[auto]   Asking ${challenger.modelId} to challenge...`);

    const visibleState = {
      hand: challenger.hand,
      currentRank: game.state.currentRank,
      pileSize: game.state.pile.length - game.pendingTurn.actualCards.length,
      otherPlayersCounts: Object.fromEntries(
        game.state.players
          .filter(p => p.id !== challenger.id && !p.isEliminated)
          .map(p => [p.modelId, p.hand.length])
      ),
      recentTurns: game.state.turns.slice(-5),
    };

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

    if (challengeResponse.challenge) {
      const correct = game.pendingTurn.wasLie;
      console.log(`[auto]   Challenge ${correct ? 'CORRECT' : 'WRONG'}`);
      game.pendingTurn.challengeResponseTimeMs = challengeResponse.responseTimeMs;
      game.pendingTurn.challengeTokenUsage = challengeResponse.tokenUsage;
      processChallenge(game.state, game.pendingTurn, challenger.id, challengeResponse.reasoning);
      game.challengeQueue = [];
      break;
    }
  }

  if (game.phase === 'challenging' && game.pendingTurn) {
    console.log(`[auto]   No challenge — accepted`);
    advanceTurn(game.state, game.pendingTurn);
    game.pendingTurn = null;
    game.phase = 'waiting';

    const winner = checkWinner(game.state);
    if (winner) {
      const winnerPlayer = game.state.players.find(p => p.id === winner);
      console.log(`[auto] 🏆 WINNER: ${winnerPlayer?.modelId} after ${game.state.turns.length} turns`);
      finalizeGame(game.state, winner);
      game.phase = 'finished';
      const log = logger.stateToLog(game.state);
      logger.saveGameLog(log);
    }
  }

  game.lastUpdate = Date.now();
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
      counts: { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) },
    });
  } catch (e) {
    sendJSON(res, { error: 'Failed to load stats' }, 500);
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
        handleGetGameState(res, gameId);
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
  const provider = getProvider();
  const modeDisplay = getProviderDisplayName(provider);
  console.log(`
╔═══════════════════════════════════════════════════════╗
║         🃏 LLM Bullshit - Game Visualizer 🃏          ║
╠═══════════════════════════════════════════════════════╣
║  Server running at http://localhost:${PORT}              ║
║                                                       ║
║  • Watch games play out turn by turn                  ║
║  • See each player's cards                            ║
║  • Read the LLMs' thoughts as they decide             ║
║                                                       ║
║  Mode: ${modeDisplay}
╚═══════════════════════════════════════════════════════╝
  `);
});
