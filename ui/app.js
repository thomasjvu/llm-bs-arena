import { startGame, stepGame, submitHumanPlay, submitHumanChallenge, fetchStats } from './app/api.js';
import { createEffects } from './app/effects.js';
import { DEFAULT_SLOT_ID, buildSlotLayout, getSlotForPlayer } from './app/layout.js';
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
  utilityOpen: false,
  logOpen: false,
  stepBusy: false,
  autoPlaying: false,
  selectedCards: new Set(),
  ephemeralThinkingPlayerId: null,
  transientReveal: null,
  transientRevealTimer: null,
  spectatorRevealPlayerId: null,
  spectatorPeekPlayerId: null,
  cinematicCue: null,
  cinematicCueTimer: null,
  stats: {
    open: false,
    loading: false,
    error: '',
    meta: 'Open stats to load the current comparable cohort.',
    data: null,
  },
};

function supportsHoverPeek() {
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
}

function canRevealPortrait(playerId) {
  const state = app.currentState;
  if (!playerId || !state || state.interactive) {
    return false;
  }

  const layout = buildSlotLayout(state);
  const slotId = getSlotForPlayer(layout, playerId);
  if (!slotId) return false;
  return layout.slotMeta?.[slotId]?.section === 'judge';
}

function setSpectatorReveal(playerId) {
  const nextPlayerId = canRevealPortrait(playerId) ? playerId : null;
  if (app.spectatorRevealPlayerId === nextPlayerId) return;
  app.spectatorRevealPlayerId = nextPlayerId;
  render();
}

function clearSpectatorReveal() {
  if (!app.spectatorRevealPlayerId) return;
  app.spectatorRevealPlayerId = null;
  render();
}

function canOpenSpectatorPeek(playerId) {
  const state = app.currentState;
  if (!playerId || !state || state.interactive) {
    return false;
  }

  const player = state.players?.find((entry) => entry.id === playerId);
  return Boolean(player?.handVisible && player?.hand?.length);
}

function setSpectatorPeek(playerId) {
  const nextPlayerId = canOpenSpectatorPeek(playerId) ? playerId : null;
  if (app.spectatorPeekPlayerId === nextPlayerId) return;
  app.spectatorPeekPlayerId = nextPlayerId;
  render();
}

function clearSpectatorPeek() {
  if (!app.spectatorPeekPlayerId) return;
  app.spectatorPeekPlayerId = null;
  render();
}

function clearCinematicCue(shouldRender = true) {
  if (app.cinematicCueTimer) {
    window.clearTimeout(app.cinematicCueTimer);
    app.cinematicCueTimer = null;
  }
  app.cinematicCue = null;
  if (shouldRender) render();
}

function setCinematicCue(cue, duration = 1600) {
  clearCinematicCue(false);
  app.cinematicCue = cue;
  render();
  app.cinematicCueTimer = window.setTimeout(() => {
    app.cinematicCue = null;
    app.cinematicCueTimer = null;
    render();
  }, duration);
}

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

  if (next.interactive || !next.players?.some((player) => player.id === app.spectatorRevealPlayerId)) {
    app.spectatorRevealPlayerId = null;
  }
  if (next.interactive || !next.players?.some((player) => player.id === app.spectatorPeekPlayerId)) {
    app.spectatorPeekPlayerId = null;
  }

  handleTransition(previous, next);
  render();
}

function buildCue(layout, playerId, state, text, subtext, variant, portraitState) {
  const player = state.players.find((entry) => entry.id === playerId) ?? null;
  const slotId = getSlotForPlayer(layout, playerId) || DEFAULT_SLOT_ID;
  return {
    playerId,
    label: player ? (player.displayName || player.modelId) : '',
    text,
    subtext,
    variant,
    portraitState,
    facing: layout.slotMeta?.[slotId]?.facing || 'right',
  };
}

function handleTransition(previous, next) {
  const previousPending = previous?.pendingTurn;
  const nextPending = next?.pendingTurn;
  const nextLayout = buildSlotLayout(next);

  if (!previousPending && nextPending) {
    const slotId = getSlotForPlayer(nextLayout, nextPending.playerId) || DEFAULT_SLOT_ID;
    effects.animateCardFlight(dom.slots[slotId]?.root, dom.pendingDisplay, nextPending.claimedCount || 1);
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
      const challengedPlayer = next.players.find((player) => player.id === resolvedTurn.playerId);
      const challenger = next.players.find((player) => player.id === resolvedTurn.challengerId);

      if (resolvedTurn.challengeCorrect && challenger) {
        setCinematicCue(
          buildCue(
            nextLayout,
            challenger.id,
            next,
            'OBJECTION!!',
            `${challenger.displayName || challenger.modelId} catches ${challengedPlayer?.displayName || challengedPlayer?.modelId}.`,
            'danger',
            'judging'
          ),
          1800
        );
      } else if (challengedPlayer) {
        setCinematicCue(
          buildCue(
            nextLayout,
            challengedPlayer.id,
            next,
            'OVERRULED',
            `${challengedPlayer.displayName || challengedPlayer.modelId}'s claim survives.`,
            'success',
            'default'
          ),
          1600
        );
      }
    } else {
      const actor = next.players.find((player) => player.id === resolvedTurn.playerId);
      if (actor) {
        setCinematicCue(
          buildCue(
            nextLayout,
            actor.id,
            next,
            'CLAIM STANDS',
            `${actor.displayName || actor.modelId} pushes through ${resolvedTurn.claimedCount} x ${resolvedTurn.claimedRank}.`,
            'neutral',
            'default'
          ),
          1200
        );
      }
    }
  }

  if (next.winner && next.winner !== previous?.winner) {
    const winner = next.players.find((player) => player.id === next.winner);
    if (winner) {
      setCinematicCue(
        buildCue(
          nextLayout,
          winner.id,
          next,
          'WINNER',
          `${winner.displayName || winner.modelId} clears the table.`,
          'success',
          'win'
        ),
        2200
      );
    }
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
  app.spectatorRevealPlayerId = null;
  app.spectatorPeekPlayerId = null;
  app.utilityOpen = false;
  clearCinematicCue(false);
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

Object.values(dom.slots).forEach(({ root }) => {
  root.addEventListener('pointerenter', () => {
    if (!supportsHoverPeek()) return;
    setSpectatorReveal(root.dataset.playerId || null);
    setSpectatorPeek(root.dataset.playerId || null);
  });

  root.addEventListener('pointerleave', (event) => {
    if (!supportsHoverPeek()) return;
    if (event.relatedTarget?.closest?.('[data-slot]')) return;
    clearSpectatorReveal();
    clearSpectatorPeek();
  });

  root.addEventListener('click', (event) => {
    if (supportsHoverPeek()) return;
    const playerId = root.dataset.playerId || null;
    const canReveal = canRevealPortrait(playerId);
    const canPeek = canOpenSpectatorPeek(playerId);
    if (!canReveal && !canPeek) return;

    app.spectatorRevealPlayerId = canReveal && app.spectatorRevealPlayerId !== playerId ? playerId : null;
    app.spectatorPeekPlayerId = canPeek && app.spectatorPeekPlayerId !== playerId ? playerId : null;
    render();
    event.stopPropagation();
  });
});

document.addEventListener('click', (event) => {
  if (!supportsHoverPeek()) {
    if (!event.target.closest('[data-slot]')) {
      clearSpectatorReveal();
      clearSpectatorPeek();
    }
  }

  if (!event.target.closest('#utility-drawer') && !event.target.closest('#utility-toggle-btn')) {
    if (app.utilityOpen) {
      app.utilityOpen = false;
      render();
    }
  }
});

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

window.addEventListener('load', () => {
  render();
  if (preferences.mode) {
    void startNewGame();
  }
});
