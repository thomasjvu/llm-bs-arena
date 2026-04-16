import { startGame, stepGame, submitHumanPlay, submitHumanChallenge, fetchStats } from './app/api.js';
import { createEffects } from './app/effects.js';
import { buildSlotLayout, getSlotForPlayer } from './app/layout.js';
import { bindDom, renderApp, buildTextState } from './app/render.js';
import { loadPreferences, savePreferences } from './app/storage.js';

const dom = bindDom(document);
const effects = createEffects();
const themeIssues = window.ModelThemes?.validateRegistry?.() || [];

if (themeIssues.length) {
  console.warn('[frontend] theme registry issues:\n' + themeIssues.join('\n'));
}

const preferences = loadPreferences();

const app = {
  currentGameId: null,
  currentState: null,
  previousState: null,
  launcherMode: preferences.mode || 'spectator',
  provider: preferences.provider || 'mock',
  humanName: preferences.humanName || 'you',
  apiKey: '',
  launcherOpen: !preferences.mode,
  launcherBusy: false,
  launcherError: '',
  logOpen: false,
  stepBusy: false,
  autoPlaying: false,
  selectedCards: new Set(),
  ephemeralThinkingPlayerId: null,
  showWinnerModal: false,
  transientReveal: null,
  transientRevealTimer: null,
  stats: {
    open: false,
    loading: false,
    error: '',
    meta: 'Open stats to load the current comparable cohort.',
    data: null,
  },
};

function persistPreferences() {
  const next = savePreferences({
    mode: app.launcherMode,
    provider: app.provider,
    humanName: app.humanName,
  });
  app.launcherMode = next.mode || app.launcherMode;
  app.provider = next.provider;
  app.humanName = next.humanName;
}

function syncWindowState() {
  const layout = buildSlotLayout(app.currentState);
  window.render_game_to_text = () => buildTextState(app, layout);
  window.advanceTime = (ms = 0) => new Promise((resolve) => window.setTimeout(resolve, ms));
}

function render() {
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

function normalizeCard(card) {
  if (typeof card === 'string') return card;
  if (card?.rank && card?.suit) return `${card.rank}${card.suit}`;
  return '';
}

function normalizeState(state) {
  return {
    ...state,
    interactive: state?.interactive === true,
    humanPlayerId: state?.humanPlayerId ?? null,
    awaitingHumanAction: state?.awaitingHumanAction ?? null,
    thinkingPlayerId: state?.thinkingPlayerId ?? null,
    winnerName: state?.winnerName ?? null,
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
  app.previousState = previous;
  app.currentState = next;
  app.currentGameId = next.gameId;
  app.ephemeralThinkingPlayerId = null;
  handleTransition(previous, next);
  render();
}

function handleTransition(previous, next) {
  const previousPending = previous?.pendingTurn;
  const nextPending = next?.pendingTurn;
  const nextLayout = buildSlotLayout(next);

  if (!previousPending && nextPending) {
    const slotId = getSlotForPlayer(nextLayout, nextPending.playerId) || 'active';
    const sourceHand = dom.slots[slotId]?.hand;
    effects.animateCardFlight(sourceHand, dom.pendingDisplay, nextPending.claimedCount || 1);
  }

  const resolvedTurn = previousPending && !nextPending && next.turns?.length
    ? next.turns[next.turns.length - 1]
    : null;

  if (previousPending && !nextPending && resolvedTurn) {
    const cards = (resolvedTurn.actualCards || []).map(normalizeCard).filter(Boolean);
    if (cards.length) {
      setTransientReveal(cards, resolvedTurn.wasLie ? 'lie exposed' : 'truth revealed');
    }

    if (resolvedTurn.challenged) {
      const actorSlot = getSlotForPlayer(nextLayout, resolvedTurn.playerId) || 'active';
      const challengerSlot = getSlotForPlayer(nextLayout, resolvedTurn.challengerId) || 'active';
      effects.showBurst(
        resolvedTurn.challengeCorrect ? dom.slots[challengerSlot]?.root : dom.slots[actorSlot]?.root,
        resolvedTurn.challengeCorrect ? 'OBJECTION!!' : 'OVERRULED',
        resolvedTurn.challengeCorrect ? 'danger' : 'success'
      );
    } else {
      const actorSlot = getSlotForPlayer(nextLayout, resolvedTurn.playerId) || 'active';
      effects.showBurst(dom.slots[actorSlot]?.root, 'CLAIM STANDS', 'neutral');
    }
  }

  if (next.winner && next.winner !== previous?.winner) {
    app.showWinnerModal = true;
    const winnerSlot = getSlotForPlayer(nextLayout, next.winner) || 'active';
    effects.showBurst(dom.slots[winnerSlot]?.root, 'WINNER', 'success');
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
  app.showWinnerModal = false;
  app.selectedCards.clear();
  resetTransientReveal();
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

      await window.advanceTime(550);
    }
  } finally {
    app.autoPlaying = false;
    render();
  }
}

function stopAutoPlay(shouldRender = true) {
  app.autoPlaying = false;
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
    render();
  } finally {
    dom.challengeBtn.disabled = false;
    dom.passBtn.disabled = false;
  }
}

async function refreshStats() {
  app.stats.loading = true;
  app.stats.error = '';
  app.stats.open = true;
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

dom.launcherModeButtons.forEach((button) => {
  button.addEventListener('click', () => updateMode(button.dataset.launchMode));
});

dom.providerSelect.addEventListener('change', () => {
  app.provider = dom.providerSelect.value === 'nim' ? 'nim' : 'mock';
  persistPreferences();
  app.launcherError = '';
  render();
});

dom.humanNameInput.addEventListener('input', () => {
  app.humanName = dom.humanNameInput.value.trim() || 'you';
  persistPreferences();
  render();
});

dom.apiKeyInput.addEventListener('input', () => {
  app.apiKey = dom.apiKeyInput.value;
  app.launcherError = '';
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

dom.setupToggleBtn.addEventListener('click', () => {
  app.launcherOpen = true;
  app.launcherError = '';
  render();
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

dom.logToggleBtn.addEventListener('click', () => {
  app.logOpen = !app.logOpen;
  render();
});

dom.logCloseBtn.addEventListener('click', () => {
  app.logOpen = false;
  render();
});

dom.statsToggleBtn.addEventListener('click', () => {
  app.stats.open = !app.stats.open;
  render();
  if (app.stats.open) {
    void refreshStats();
  }
});

dom.statsCloseBtn.addEventListener('click', () => {
  app.stats.open = false;
  render();
});

dom.statsRefreshBtn.addEventListener('click', () => {
  void refreshStats();
});

dom.experimentSelect.addEventListener('change', () => {
  if (app.stats.open) {
    void refreshStats();
  }
});

dom.winnerCloseBtn.addEventListener('click', () => {
  app.showWinnerModal = false;
  render();
});

window.addEventListener('load', () => {
  render();
  if (preferences.mode) {
    void startNewGame();
  }
});
