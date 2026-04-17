import { startGame, stepGame, submitHumanPlay, submitHumanChallenge, fetchStats, probeGameState, fetchRuntimeStatus } from './app/api.js';
import { createAudio } from './app/audio.js';
import { createEffects } from './app/effects.js';
import { DEFAULT_SLOT_ID, buildSlotLayout, getSlotForPlayer } from './app/layout.js';
import { bindDom, renderApp, buildTextState } from './app/render.js';
import { loadPreferences, savePreferences } from './app/storage.js';

const dom = bindDom(document);
const effects = createEffects();
const preferences = loadPreferences();
const audio = createAudio({ enabled: preferences.soundEnabled });
const themeIssues = window.ModelThemes?.validateRegistry?.() || [];
const FIXED_HUMAN_NAME = 'You';
const MASKED_SERVER_KEY = '••••••••';

if (themeIssues.length) {
  console.warn('[frontend] theme registry issues:\n' + themeIssues.join('\n'));
}

const app = {
  currentGameId: preferences.activeGameId || null,
  currentState: null,
  previousState: null,
  launcherMode: preferences.mode || 'spectator',
  provider: preferences.provider || 'mock',
  humanName: FIXED_HUMAN_NAME,
  apiKey: '',
  serverApiKeyAvailable: false,
  launcherOpen: !preferences.mode,
  launcherBusy: false,
  launcherError: '',
  utilityOpen: false,
  sidebarTab: 'utility',
  stepBusy: false,
  autoPlaying: false,
  selectedCards: new Set(),
  ephemeralThinkingPlayerId: null,
  transientReveal: null,
  transientRevealTimer: null,
  challengeReveal: null,
  challengeRevealStageTimer: null,
  challengeRevealClearTimer: null,
  spectatorPeekPlayerId: null,
  peekRevealSeq: 0,
  attention: null,
  attentionTimer: null,
  attentionSeq: 0,
  soundEnabled: preferences.soundEnabled !== false,
  resumeAutoPlay: preferences.resumeAutoPlay === true,
  serverTimeOffsetMs: 0,
  messageTimerKey: '',
  messageTimerStartedAt: 0,
  messageTimerNow: 0,
  stats: {
    loading: false,
    error: '',
    meta: 'Open stats to load the current comparable cohort.',
    data: null,
  },
};

function computeMessageTimerKey() {
  if (app.challengeReveal) {
    return [
      'reveal',
      app.challengeReveal.stage,
      app.challengeReveal.primary,
      app.challengeReveal.secondary,
    ].join('|');
  }

  const state = app.currentState;
  if (!state) return '';

  if (state.phase === 'finished') {
    return `finished|${state.gameId}|${state.winner}|${state.totalTurns}`;
  }

  if (state.awaitingHumanAction?.type === 'play') {
    return [
      'manual-play',
      state.gameId,
      state.awaitingHumanAction.playerId,
      state.awaitingHumanAction.currentRank,
      state.totalTurns,
    ].join('|');
  }

  if (state.awaitingHumanAction?.type === 'challenge') {
    const pendingPlay = state.awaitingHumanAction.pendingPlay || {};
    return [
      'manual-challenge',
      state.gameId,
      state.awaitingHumanAction.playerId,
      pendingPlay.playerId || '',
      pendingPlay.claimedCount || '',
      pendingPlay.claimedRank || '',
      state.totalTurns,
    ].join('|');
  }

  if (state.phase === 'challenging' && state.pendingTurn) {
    return [
      'challenge-window',
      state.gameId,
      state.pendingTurn.playerId,
      state.pendingTurn.claimedCount,
      state.pendingTurn.claimedRank,
      state.thinkingPlayerId || '',
      state.totalTurns,
    ].join('|');
  }

  const latestTurn = state.turns?.[state.turns.length - 1];
  if (latestTurn?.challenged) {
    return [
      'resolved-challenge',
      state.gameId,
      latestTurn.turnNumber || state.totalTurns,
      latestTurn.playerId,
      latestTurn.challengerId || '',
      latestTurn.challengeCorrect ? 'correct' : 'wrong',
    ].join('|');
  }

  const thinkerId = app.ephemeralThinkingPlayerId || state.thinkingPlayerId || '';
  if (thinkerId) {
    return ['thinking', state.gameId, thinkerId, state.totalTurns].join('|');
  }

  return [
    'live',
    state.gameId,
    state.players?.[state.currentPlayerIndex]?.id || '',
    state.currentRank || '',
    state.totalTurns,
  ].join('|');
}

function getServerAlignedNow() {
  return Date.now() + app.serverTimeOffsetMs;
}

function getVisibleMessageStartTime() {
  if (app.challengeReveal?.stageStartedAt) {
    return app.challengeReveal.stageStartedAt;
  }
  return app.currentState?.phaseStartedAt || 0;
}

function formatMessageTimerText() {
  if (!app.messageTimerKey || !app.messageTimerStartedAt || app.messageTimerNow < app.messageTimerStartedAt) {
    return '';
  }
  return `${((app.messageTimerNow - app.messageTimerStartedAt) / 1000).toFixed(1)}s`;
}

function syncMessageTimer() {
  const nextKey = computeMessageTimerKey();
  app.messageTimerKey = nextKey;
  app.messageTimerStartedAt = nextKey ? getVisibleMessageStartTime() : 0;
  app.messageTimerNow = nextKey ? getServerAlignedNow() : 0;
}

function supportsHoverPeek() {
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
}

function canOpenSpectatorPeek(playerId) {
  const state = app.currentState;
  if (!playerId || !state) {
    return false;
  }

  const player = state.players?.find((entry) => entry.id === playerId);
  if (!player?.handVisible || !player?.hand?.length) {
    return false;
  }

  if (!state.interactive) {
    return true;
  }

  return state.humanPlayerId === playerId;
}

function setSpectatorPeek(playerId) {
  const nextPlayerId = canOpenSpectatorPeek(playerId) ? playerId : null;
  if (app.spectatorPeekPlayerId === nextPlayerId) return;
  app.spectatorPeekPlayerId = nextPlayerId;
  if (nextPlayerId) {
    app.peekRevealSeq += 1;
  }
  render();
}

function clearSpectatorPeek() {
  if (!app.spectatorPeekPlayerId) return;
  app.spectatorPeekPlayerId = null;
  render();
}

function clearAttention(shouldRender = true) {
  if (app.attentionTimer) {
    window.clearTimeout(app.attentionTimer);
    app.attentionTimer = null;
  }
  app.attention = null;
  if (shouldRender) render();
}

function setAttention({ playerIds = [], zones = [], variant = 'turn' } = {}, duration = 520) {
  clearAttention(false);
  app.attentionSeq += 1;
  app.attention = {
    playerIds,
    zones,
    variant,
    seq: app.attentionSeq,
  };
  render();
  app.attentionTimer = window.setTimeout(() => {
    app.attention = null;
    app.attentionTimer = null;
    render();
  }, duration);
}

function persistPreferences() {
  const next = savePreferences({
    mode: app.launcherMode,
    provider: app.provider,
    humanName: FIXED_HUMAN_NAME,
    soundEnabled: app.soundEnabled,
    activeGameId: app.currentGameId,
    resumeAutoPlay: !app.currentState?.interactive && app.resumeAutoPlay === true,
  });
  app.launcherMode = next.mode || app.launcherMode;
  app.provider = next.provider;
  app.humanName = next.humanName;
  app.soundEnabled = next.soundEnabled;
  app.currentGameId = next.activeGameId;
  app.resumeAutoPlay = next.resumeAutoPlay;
  audio.setEnabled(app.soundEnabled);
}

async function hydrateRuntimeStatus() {
  try {
    const status = await fetchRuntimeStatus();
    app.serverApiKeyAvailable = status?.hasServerApiKey === true;

    if (
      preferences.mode == null &&
      preferences.provider === 'mock' &&
      status?.defaultProvider === 'nim' &&
      !app.currentGameId
    ) {
      app.provider = 'nim';
    }
    render();
  } catch (_error) {
    app.serverApiKeyAvailable = false;
  }
}

function clearStoredGameSession() {
  app.currentGameId = null;
  app.resumeAutoPlay = false;
  persistPreferences();
}

function syncWindowState() {
  const layout = buildSlotLayout(app.currentState);
  window.render_game_to_text = () => buildTextState(app, layout);
  window.advanceTime = (ms = 0) => new Promise((resolve) => window.setTimeout(resolve, ms));
}

function render() {
  syncMessageTimer();
  const layout = buildSlotLayout(app.currentState);
  renderApp(dom, app, layout, toggleSelectedCard);
  syncWindowState();
}

function resetTransientReveal() {
  if (app.transientRevealTimer) {
    window.clearTimeout(app.transientRevealTimer);
    app.transientRevealTimer = null;
  }
  app.transientReveal = null;
}

function setTransientReveal(cards, label = '') {
  resetTransientReveal();
  if (!cards?.length) return;
  app.transientReveal = { cards, label };
  app.transientRevealTimer = window.setTimeout(() => {
    app.transientReveal = null;
    app.transientRevealTimer = null;
    render();
  }, 1500);
}

function clearChallengeReveal(shouldRender = true) {
  if (app.challengeRevealStageTimer) {
    window.clearTimeout(app.challengeRevealStageTimer);
    app.challengeRevealStageTimer = null;
  }
  if (app.challengeRevealClearTimer) {
    window.clearTimeout(app.challengeRevealClearTimer);
    app.challengeRevealClearTimer = null;
  }
  app.challengeReveal = null;
  if (shouldRender) render();
}

function startChallengeReveal({ nextState, resolvedTurn, previousPileSize, nextLayout, flightCount, cards }) {
  clearChallengeReveal(false);

  const claimant = nextState.players.find((player) => player.id === resolvedTurn.playerId);
  const challenger = nextState.players.find((player) => player.id === resolvedTurn.challengerId);
  const winnerId = resolvedTurn.challengeCorrect ? resolvedTurn.challengerId : resolvedTurn.playerId;
  const loserId = resolvedTurn.challengeCorrect ? resolvedTurn.playerId : resolvedTurn.challengerId;
  const winner = nextState.players.find((player) => player.id === winnerId);
  const loser = nextState.players.find((player) => player.id === loserId);
  const loserSlotId = getSlotForPlayer(nextLayout, loserId) || DEFAULT_SLOT_ID;
  const pickupCount = Math.max(1, (previousPileSize || 0) + flightCount);
  const resultSecondary = resolvedTurn.challengeCorrect
    ? `${getFrontendPlayerName(loser)} takes the pile.`
    : nextState.winner === winnerId
      ? `${getFrontendPlayerName(winner)} beats the objection and wins the table.`
      : `${getFrontendPlayerName(winner)} beats the objection.`;

  app.challengeReveal = {
    stage: 'incoming',
    stageStartedAt: nextState.serverNow || getServerAlignedNow(),
    claimantId: resolvedTurn.playerId,
    claimantName: getFrontendPlayerName(claimant),
    challengerId: resolvedTurn.challengerId,
    challengerName: getFrontendPlayerName(challenger),
    winnerId,
    winnerName: getFrontendPlayerName(winner),
    loserId,
    loserName: getFrontendPlayerName(loser),
    challengeCorrect: Boolean(resolvedTurn.challengeCorrect),
    claimantState: resolvedTurn.challengeCorrect ? 'lose' : 'objection_safe',
    challengerState: resolvedTurn.challengeCorrect ? 'objection_correct' : 'lose',
    primary: `${getFrontendPlayerName(challenger)} calls bullshit`,
    secondary: `Resolving ${getFrontendPlayerName(claimant)}'s ${resolvedTurn.claimedCount} x ${resolvedTurn.claimedRank}.`,
  };
  render();

  app.challengeRevealStageTimer = window.setTimeout(() => {
    app.challengeRevealStageTimer = null;
    if (!app.challengeReveal) return;
    app.challengeReveal = {
      ...app.challengeReveal,
      stage: 'resolution',
      stageStartedAt: getServerAlignedNow(),
      primary: `${app.challengeReveal.winnerName} wins objection`,
      secondary: resultSecondary,
    };
    if (cards.length) {
      setTransientReveal(cards, '');
    }
    effects.animateCardFlight(
      dom.pileDisplay,
      dom.slots[loserSlotId]?.root,
      Math.min(4, Math.max(previousPileSize || 1, flightCount)),
      210
    );
    setAttention({
      playerIds: [resolvedTurn.playerId, resolvedTurn.challengerId].filter(Boolean),
      zones: ['claim', 'pile'],
      variant: resolvedTurn.challengeCorrect ? 'danger' : 'success',
    }, 920);
    effects.shakeStage(dom.main, resolvedTurn.challengeCorrect ? 'danger' : 'success');
    audio.playResolution(resolvedTurn.challengeCorrect ? 'lie_exposed' : 'claim_stands');
    audio.playPickup(pickupCount);
    render();
  }, 1150);

  app.challengeRevealClearTimer = window.setTimeout(() => {
    clearChallengeReveal();
  }, 2500);
}

function getPublicResolutionLabel(turn) {
  if (!turn) return '';
  if (!turn.challenged) return 'claim stands';
  return turn.challengeCorrect ? 'lie exposed' : 'truth revealed';
}

function normalizeCard(card) {
  if (typeof card === 'string') return card;
  if (card?.rank && card?.suit) return `${card.rank}${card.suit}`;
  return '';
}

function getFrontendPlayerName(player) {
  if (!player) return 'Unknown';
  if (player.displayName) return player.displayName;
  if (player.modelId) return window.ModelThemes.getTheme(player.modelId).shortName || player.modelId;
  return 'Unknown';
}

function normalizeState(state) {
  return {
    ...state,
    interactive: state?.interactive === true,
    humanPlayerId: state?.humanPlayerId ?? null,
    awaitingHumanAction: state?.awaitingHumanAction ?? null,
    thinkingPlayerId: state?.thinkingPlayerId ?? null,
    winnerName: state?.winnerName ?? null,
    phaseStartedAt: Number(state?.phaseStartedAt) || 0,
    serverNow: Number(state?.serverNow) || 0,
  };
}

function updateMode(mode) {
  app.launcherMode = mode === 'interactive' ? 'interactive' : 'spectator';
  app.provider = app.launcherMode === 'interactive' ? 'nim' : 'mock';
  persistPreferences();
  app.launcherError = '';
  render();
}

function setCurrentState(nextState) {
  const previous = app.currentState;
  const next = normalizeState(nextState);
  if (!previous || previous.gameId !== next.gameId) {
    clearChallengeReveal(false);
  }
  app.previousState = previous;
  app.currentState = next;
  if (next.serverNow > 0) {
    app.serverTimeOffsetMs = next.serverNow - Date.now();
  }
  app.currentGameId = next.gameId;
  app.launcherMode = next.interactive ? 'interactive' : 'spectator';
  app.provider = next.provider || app.provider;
  app.ephemeralThinkingPlayerId = null;

  if (next.interactive || !next.players?.some((player) => player.id === app.spectatorPeekPlayerId)) {
    app.spectatorPeekPlayerId = null;
  }

  handleTransition(previous, next);
  if (next.phase === 'finished') {
    app.resumeAutoPlay = false;
  }
  persistPreferences();
  render();
}

function getNewFeedEntries(previous, next) {
  const previousFeed = previous?.currentTurnFeed;
  const nextFeed = next?.currentTurnFeed;
  if (!nextFeed?.entries?.length) return [];
  if (!previousFeed || previousFeed.turnNumber !== nextFeed.turnNumber) {
    return nextFeed.entries;
  }
  return nextFeed.entries.slice(previousFeed.entries.length);
}

function handleTransition(previous, next) {
  const previousPending = previous?.pendingTurn;
  const nextPending = next?.pendingTurn;
  const nextLayout = buildSlotLayout(next);
  const newFeedEntries = previous ? getNewFeedEntries(previous, next) : [];
  const challengeEntry = newFeedEntries.find((entry) => entry.type === 'challenge');

  if (challengeEntry) {
    setAttention({
      playerIds: [challengeEntry.playerId, challengeEntry.targetPlayerId].filter(Boolean),
      zones: ['claim'],
      variant: 'danger',
    }, 720);
    effects.shakeStage(dom.main, 'danger');
    audio.playChallenge();
  }

  if (!previousPending && nextPending) {
    const slotId = getSlotForPlayer(nextLayout, nextPending.playerId) || DEFAULT_SLOT_ID;
    effects.animateCardFlight(dom.slots[slotId]?.root, dom.pendingDisplay, nextPending.claimedCount || 1);
    setAttention({
      playerIds: [nextPending.playerId],
      zones: ['claim'],
      variant: 'turn',
    });
  }

  const resolvedTurn = previousPending && !nextPending && next.turns?.length
    ? next.turns[next.turns.length - 1]
    : null;

  if (previousPending && !nextPending && resolvedTurn) {
    const cards = (resolvedTurn.actualCards || []).map(normalizeCard).filter(Boolean);
    const flightCount = Math.max(resolvedTurn.claimedCount || 1, cards.length || 1);
    effects.animateCardFlight(dom.pendingDisplay, dom.pileDisplay, flightCount);

    if (resolvedTurn.challenged) {
      startChallengeReveal({
        nextState: next,
        resolvedTurn,
        previousPileSize: previous?.pileSize || 0,
        nextLayout,
        flightCount,
        cards,
      });
    } else {
      if (cards.length) {
        setTransientReveal(cards, getPublicResolutionLabel(resolvedTurn));
      }
      setAttention({
        playerIds: [resolvedTurn.playerId].filter(Boolean),
        zones: ['claim', 'pile'],
        variant: 'turn',
      });
      audio.playResolution('claim_stands');
    }
  }

  if (next.winner && next.winner !== previous?.winner && !resolvedTurn?.challenged) {
    setAttention({
      playerIds: [next.winner],
      zones: ['claim', 'pile'],
      variant: 'winner',
    }, 900);
    effects.shakeStage(dom.main, 'success');
  }

  if (next.awaitingHumanAction?.type !== 'play') {
    app.selectedCards.clear();
  }
}

function toggleSelectedCard(card) {
  const awaitingHumanAction = app.currentState?.awaitingHumanAction;
  if (awaitingHumanAction?.type !== 'play') return;

  if (app.selectedCards.has(card)) {
    app.selectedCards.delete(card);
  } else if (app.selectedCards.size < 4) {
    app.selectedCards.add(card);
  }
  render();
}

async function startNewGame() {
  app.launcherBusy = true;
  app.launcherError = '';
  app.selectedCards.clear();
  app.spectatorPeekPlayerId = null;
  app.peekRevealSeq = 0;
  app.utilityOpen = false;
  app.resumeAutoPlay = false;
  clearAttention(false);
  resetTransientReveal();
  clearChallengeReveal(false);
  stopAutoPlay(false);
  render();

  try {
    persistPreferences();
    const state = await startGame({
      experimentId: Number(dom.experimentSelect.value),
      mode: app.launcherMode,
      provider: app.provider,
      apiKey: app.apiKey.trim(),
      humanName: app.humanName,
    });

    app.launcherBusy = false;
    app.launcherOpen = false;
    setCurrentState(state);

    if (state.phase !== 'finished' && !state.awaitingHumanAction) {
      void startAutoPlay();
    } else {
      persistPreferences();
    }
  } catch (error) {
    app.launcherBusy = false;
    app.launcherOpen = true;
    app.launcherError = error instanceof Error ? error.message : String(error);
    render();
  }
}

async function stepOnce() {
  if (!app.currentGameId || app.stepBusy || app.currentState?.awaitingHumanAction) {
    return false;
  }

  app.stepBusy = true;
  app.launcherError = '';
  render();

  try {
    const state = await stepGame(app.currentGameId, {
      onThinking(event) {
        app.ephemeralThinkingPlayerId = event.playerId || null;
        render();
      },
    });
    setCurrentState(state);
    return true;
  } catch (error) {
    app.launcherError = error instanceof Error ? error.message : String(error);
    if (String(app.launcherError).includes('Game not found')) {
      clearStoredGameSession();
    }
    render();
    return false;
  } finally {
    app.stepBusy = false;
    app.ephemeralThinkingPlayerId = null;
    render();
  }
}

async function startAutoPlay() {
  if (app.autoPlaying || !app.currentGameId) return;
  app.autoPlaying = true;
  app.resumeAutoPlay = !app.currentState?.interactive;
  persistPreferences();
  render();

  try {
    while (app.autoPlaying && app.currentGameId) {
      const state = app.currentState;
      if (!state || state.phase === 'finished' || state.awaitingHumanAction) {
        break;
      }

      const progressed = await stepOnce();
      if (!progressed) {
        break;
      }

      if (!app.autoPlaying) {
        break;
      }
      if (app.currentState?.phase === 'finished' || app.currentState?.awaitingHumanAction) {
        break;
      }
      while (app.autoPlaying && app.challengeReveal) {
        await window.advanceTime(80);
      }
      if (!app.autoPlaying || app.currentState?.phase === 'finished' || app.currentState?.awaitingHumanAction) {
        break;
      }

      const pauseMs = app.currentState?.interactive
        ? 550
        : app.currentState?.phase === 'challenging'
          ? 1200
          : 900;
      await window.advanceTime(pauseMs);
    }
  } finally {
    app.autoPlaying = false;
    app.resumeAutoPlay = false;
    persistPreferences();
    render();
  }
}

function stopAutoPlay(shouldRender = true) {
  app.autoPlaying = false;
  app.resumeAutoPlay = false;
  persistPreferences();
  if (shouldRender) render();
}

async function submitPlay() {
  if (!app.currentGameId || app.selectedCards.size === 0) return;

  dom.submitPlayBtn.disabled = true;
  dom.clearPlayBtn.disabled = true;

  try {
    const state = await submitHumanPlay(app.currentGameId, [...app.selectedCards]);
    app.selectedCards.clear();
    setCurrentState(state);
    if (state.phase !== 'finished' && !state.awaitingHumanAction) {
      void startAutoPlay();
    }
  } catch (error) {
    app.launcherError = error instanceof Error ? error.message : String(error);
    if (String(app.launcherError).includes('Game not found')) {
      clearStoredGameSession();
    }
    render();
  }
}

async function submitChallengeDecision(challenge) {
  if (!app.currentGameId) return;

  dom.challengeBtn.disabled = true;
  dom.passBtn.disabled = true;

  try {
    const state = await submitHumanChallenge(app.currentGameId, challenge);
    setCurrentState(state);
    if (state.phase !== 'finished' && !state.awaitingHumanAction) {
      void startAutoPlay();
    }
  } catch (error) {
    app.launcherError = error instanceof Error ? error.message : String(error);
    if (String(app.launcherError).includes('Game not found')) {
      clearStoredGameSession();
    }
    render();
  } finally {
    dom.challengeBtn.disabled = false;
    dom.passBtn.disabled = false;
  }
}

async function refreshStats() {
  app.stats.loading = true;
  app.stats.error = '';
  app.stats.meta = `Loading experiment ${dom.experimentSelect.value} leaderboard...`;
  render();

  try {
    const data = await fetchStats(dom.experimentSelect.value);
    const completedGames = data.counts?.[dom.experimentSelect.value] ?? 0;
    const cohortText = data.cohort
      ? `schema v${data.cohort.schemaVersion} • ${data.cohort.provider} • ${data.cohort.promptVersion}`
      : 'no comparable cohort yet';
    const excludedText = data.excludedGames ? ` • excluded ${data.excludedGames} mixed games` : '';

    app.stats.loading = false;
    app.stats.data = data.stats;
    app.stats.meta = `exp ${dom.experimentSelect.value} • ${completedGames} completed games • ${cohortText}${excludedText}`;
    render();
  } catch (error) {
    app.stats.loading = false;
    app.stats.error = error instanceof Error ? error.message : String(error);
    app.stats.data = null;
    app.stats.meta = 'leaderboard unavailable';
    render();
  }
}

async function restoreGameSessionOnLoad() {
  render();

  if (!preferences.activeGameId) {
    app.launcherOpen = true;
    render();
    return;
  }

  try {
    const probe = await probeGameState(preferences.activeGameId);
    if (!probe?.found || !probe.state) {
      throw new Error('Game not found');
    }
    const state = probe.state;
    app.launcherOpen = false;
    clearChallengeReveal(false);
    setCurrentState(state);

    if (!state.interactive && preferences.resumeAutoPlay && state.phase !== 'finished' && !state.awaitingHumanAction) {
      void startAutoPlay();
    }
  } catch (_error) {
    clearStoredGameSession();
    app.currentState = null;
    app.previousState = null;
    app.launcherOpen = true;
    app.launcherError = '';
    render();
  }
}

Object.values(dom.slots).forEach(({ root }) => {
  root.addEventListener('pointerenter', () => {
    if (!supportsHoverPeek()) return;
    setSpectatorPeek(root.dataset.playerId || null);
  });

  root.addEventListener('pointerleave', (event) => {
    if (!supportsHoverPeek()) return;
    if (event.relatedTarget?.closest?.('[data-slot]')) return;
    clearSpectatorPeek();
  });

  root.addEventListener('click', (event) => {
    if (supportsHoverPeek()) return;
    const playerId = root.dataset.playerId || null;
    const canPeek = canOpenSpectatorPeek(playerId);
    if (!canPeek) return;

    app.spectatorPeekPlayerId = canPeek && app.spectatorPeekPlayerId !== playerId ? playerId : null;
    if (app.spectatorPeekPlayerId) {
      app.peekRevealSeq += 1;
    }
    render();
    event.stopPropagation();
  });
});

document.addEventListener('click', (event) => {
  if (!supportsHoverPeek()) {
    if (!event.target.closest('[data-slot]')) {
      clearSpectatorPeek();
    }
  }
});

document.addEventListener('pointerdown', () => {
  void audio.unlock();
}, { passive: true });

document.addEventListener('keydown', () => {
  void audio.unlock();
}, { passive: true });

dom.launcherModeButtons.forEach((button) => {
  button.addEventListener('click', () => updateMode(button.dataset.launchMode));
});

dom.providerSelect.addEventListener('change', () => {
  app.provider = dom.providerSelect.value === 'nim' ? 'nim' : 'mock';
  persistPreferences();
  app.launcherError = '';
  render();
});

dom.apiKeyInput.addEventListener('input', () => {
  app.apiKey = dom.apiKeyInput.value === MASKED_SERVER_KEY ? '' : dom.apiKeyInput.value;
  app.launcherError = '';
});

dom.apiKeyInput.addEventListener('focus', () => {
  if (app.provider !== 'nim') return;
  if (app.apiKey) return;
  if (!app.serverApiKeyAvailable) return;
  if (dom.apiKeyInput.value === MASKED_SERVER_KEY) {
    dom.apiKeyInput.value = '';
  }
});

dom.apiKeyInput.addEventListener('blur', () => {
  if (!app.apiKey) render();
});

dom.launchButton.addEventListener('click', () => {
  void startNewGame();
});

dom.launcherCloseBtn.addEventListener('click', () => {
  if (!app.currentState) return;
  app.launcherOpen = false;
  app.launcherError = '';
  render();
});

dom.utilityToggleBtn.addEventListener('click', () => {
  app.utilityOpen = !app.utilityOpen;
  render();
});

dom.utilityCloseBtn.addEventListener('click', () => {
  app.utilityOpen = false;
  render();
});

dom.setupToggleBtn.addEventListener('click', () => {
  app.launcherOpen = true;
  app.utilityOpen = false;
  app.launcherError = '';
  render();
});

dom.sidebarTabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    app.utilityOpen = true;
    app.sidebarTab = button.dataset.sidebarTab || 'utility';
    render();
  });
});

dom.newGameBtn.addEventListener('click', () => {
  if (!app.launcherMode) {
    app.launcherOpen = true;
    render();
    return;
  }
  void startNewGame();
});

dom.stepBtn.addEventListener('click', () => {
  void stepOnce();
});

dom.autoPlayBtn.addEventListener('click', () => {
  if (app.autoPlaying) {
    stopAutoPlay();
  } else {
    void startAutoPlay();
  }
});

dom.clearPlayBtn.addEventListener('click', () => {
  app.selectedCards.clear();
  render();
});

dom.submitPlayBtn.addEventListener('click', () => {
  void submitPlay();
});

dom.challengeBtn.addEventListener('click', () => {
  void submitChallengeDecision(true);
});

dom.passBtn.addEventListener('click', () => {
  void submitChallengeDecision(false);
});

if (dom.statsRefreshBtn) {
  dom.statsRefreshBtn.addEventListener('click', () => {
    void refreshStats();
  });
}

dom.experimentSelect.addEventListener('change', () => {
  render();
});

dom.soundToggleBtn.addEventListener('click', () => {
  app.soundEnabled = !app.soundEnabled;
  audio.setEnabled(app.soundEnabled);
  persistPreferences();
  render();
});

window.addEventListener('load', () => {
  void hydrateRuntimeStatus();
  void restoreGameSessionOnLoad();
});

window.setInterval(() => {
  if (document.hidden) return;
  if (!app.currentState && !app.messageTimerKey) return;
  syncMessageTimer();
  if (dom.phaseTimer) {
    dom.phaseTimer.textContent = formatMessageTimerText();
  }
}, 100);
