import { SLOT_IDS, buildTurnRibbon } from './layout.js';

function byRole(root, role) {
  return root.querySelector(`[data-role="${role}"]`);
}

function setText(element, value) {
  if (element) element.textContent = value ?? '';
}

function clearNode(node) {
  if (node) node.textContent = '';
}

function shortenName(value) {
  if (!value) return 'Unknown';
  return value.length > 24 ? `${value.slice(0, 21)}...` : value;
}

function cleanReasoning(text) {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\[think\][\s\S]*?\[answer\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

function getPlayerName(player) {
  if (player?.displayName) return player.displayName;
  if (player?.modelId) return window.ModelThemes.getTheme(player.modelId).shortName || shortenName(player.modelId);
  return 'Unknown';
}

function getPlayerById(state, playerId) {
  return state?.players?.find((entry) => entry.id === playerId) ?? null;
}

function getHumanAction(state) {
  return state?.awaitingHumanAction || null;
}

function getCurrentTurnPlayerId(state) {
  if (!state?.players?.length) return null;
  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.pendingPlay?.playerId) {
    return state.awaitingHumanAction.pendingPlay.playerId;
  }
  if (state.awaitingHumanAction?.playerId) return state.awaitingHumanAction.playerId;
  if (state.phase === 'challenging') {
    return state.thinkingPlayerId || state.pendingTurn?.playerId || null;
  }
  return state.players[state.currentPlayerIndex]?.id ?? null;
}

function getPortraitState(player, state) {
  if (!player) return 'default';
  if (state?.winner === player.id) return 'win';
  if (player.isEliminated) return 'lose';
  if (state?.phase === 'challenging' && state.pendingTurn?.playerId === player.id) return 'judged';
  if (state?.thinkingPlayerId === player.id) {
    return state.phase === 'challenging' ? 'thinking' : 'judging';
  }
  return 'default';
}

function getSeatStatus(player, state) {
  if (!player) return 'waiting';
  if (state?.winner === player.id) return 'winner';
  if (player.isEliminated) return 'out';
  if (state?.awaitingHumanAction?.type === 'play' && state.awaitingHumanAction.playerId === player.id) return 'play';
  if (state?.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.playerId === player.id) return 'judge';
  if (state?.phase === 'challenging' && state.pendingTurn?.playerId === player.id) return 'defense';
  if (state?.thinkingPlayerId === player.id && state.phase === 'challenging') return 'judge';
  if (getCurrentTurnPlayerId(state) === player.id) return 'turn';
  return '';
}

function getSeatClasses(player, state) {
  const classes = [];
  const currentTurnPlayerId = getCurrentTurnPlayerId(state);
  if (!player) return classes;
  if (state?.winner === player.id) classes.push('is-winner');
  if (player.isEliminated) classes.push('is-eliminated');
  if (state?.phase === 'challenging' && state.pendingTurn?.playerId === player.id) classes.push('is-judged');
  if (state?.thinkingPlayerId === player.id) classes.push('is-thinking');
  if (state?.awaitingHumanAction?.playerId === player.id) classes.push('is-awaiting-human');
  if (currentTurnPlayerId === player.id) classes.push('is-current-turn');
  if (player.role === 'human') classes.push('is-human');
  return classes;
}

function getSeatBadge(player, state) {
  if (!player || !state) return '';
  if (state.winner === player.id) return 'winner';
  if (state.awaitingHumanAction?.type === 'play' && state.awaitingHumanAction.playerId === player.id) return 'your turn';
  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.playerId === player.id) return 'objection?';
  if (state.phase === 'challenging' && state.pendingTurn?.playerId === player.id) return 'defense';
  if (state.phase === 'challenging' && state.thinkingPlayerId === player.id) return 'judge';
  if (getCurrentTurnPlayerId(state) === player.id) return 'acting';
  return '';
}

function getSeatShout(player, state) {
  if (!player || !state) return '';
  const latestTurn = state.turns?.length ? state.turns[state.turns.length - 1] : null;

  if (state.winner === player.id) return 'winner';
  if (state.awaitingHumanAction?.type === 'play' && state.awaitingHumanAction.playerId === player.id) return 'your move';
  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.playerId === player.id) return 'objection?';
  if (state.phase === 'challenging' && state.pendingTurn?.playerId === player.id) return 'hold it!';

  if (latestTurn?.challenged) {
    if (latestTurn.challengerId === player.id) {
      return latestTurn.challengeCorrect ? 'objection!!' : 'overruled';
    }
    if (latestTurn.playerId === player.id) {
      return latestTurn.challengeCorrect ? 'caught' : 'holds';
    }
  }

  if (getCurrentTurnPlayerId(state) === player.id) {
    return 'acting';
  }

  return '';
}

function renderCard(cardString, showFace = true) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-card';
  wrapper.innerHTML = showFace
    ? window.CardRenderer.getCardSVG(cardString)
    : window.CardRenderer.getCardBackSVG();
  return wrapper;
}

function renderSelectableHand(container, cards, selectedCards, onToggleCard) {
  cards.forEach((card) => {
    const cardEl = renderCard(card, true);
    cardEl.classList.add('is-selectable');
    if (selectedCards.has(card)) {
      cardEl.classList.add('is-selected');
    }
    cardEl.addEventListener('click', () => onToggleCard(card));
    container.appendChild(cardEl);
  });
}

function canPeekSpectatorHand(player, state) {
  return Boolean(!state?.interactive && player?.handVisible && player?.hand?.length);
}

function renderPeekTray(container, root, slotMeta, player, state, app) {
  container.innerHTML = '';
  const alwaysVisibleBacks = !state?.interactive && player?.handVisible && player?.hand?.length;
  const peekable = canPeekSpectatorHand(player, state);
  const isOpen = peekable && app.spectatorPeekPlayerId === player.id;

  root.dataset.peekable = peekable ? 'true' : 'false';
  root.dataset.peekOpen = isOpen ? 'true' : 'false';
  root.dataset.cardsVisible = alwaysVisibleBacks ? 'true' : 'false';

  if (!alwaysVisibleBacks && !isOpen) return;

  player.hand.slice(0, 6).forEach((card) => {
    container.appendChild(renderCard(card, isOpen));
  });

  if (player.hand.length > 6) {
    const extra = document.createElement('div');
    extra.className = 'hand-overflow';
    extra.textContent = `+${player.hand.length - 6}`;
    container.appendChild(extra);
  }
}

function getFlashValue(app, type, targetId = '') {
  const attention = app.attention;
  if (!attention) return '';

  if (type === 'player' && targetId && attention.playerIds?.includes(targetId)) {
    return `${attention.variant || 'turn'}-${attention.seq || 0}`;
  }

  if (type === 'zone' && targetId && attention.zones?.includes(targetId)) {
    return `${attention.variant || 'turn'}-${attention.seq || 0}`;
  }

  return '';
}

function renderSeat(slotDom, slotId, slotMeta, player, state, app) {
  const root = slotDom.root;
  const portrait = slotDom.portrait;
  const shout = slotDom.shout;
  const peek = slotDom.peek;
  const name = slotDom.name;
  const count = slotDom.count;
  const status = slotDom.status;

  root.className = 'cast-seat';
  root.dataset.facing = slotMeta?.facing || 'right';
  root.dataset.position = slotMeta?.stagePosition || slotId;
  root.dataset.section = slotMeta?.section || 'board';

  if (!player) {
    root.dataset.badge = '';
    root.dataset.playerId = '';
    root.dataset.flash = '';
    root.dataset.active = 'false';
    root.dataset.peekable = 'false';
    root.dataset.peekOpen = 'false';
    root.style.removeProperty('--seat-accent');
    root.style.removeProperty('--seat-accent-bright');
    root.style.removeProperty('--seat-secondary');
    root.style.removeProperty('--seat-accent-dim');
    portrait.innerHTML = '';
    clearNode(peek);
    setText(shout, '');
    setText(name, 'empty seat');
    setText(count, '0 cards');
    setText(status, '');
    return;
  }

  const theme = window.ModelThemes.getTheme(player.modelId);
  const portraitState = getPortraitState(player, state);
  const shoutText = getSeatShout(player, state);

  root.dataset.playerId = player.id;
  root.dataset.badge = getSeatBadge(player, state);
  root.style.setProperty('--seat-accent', theme.accent);
  root.style.setProperty('--seat-accent-bright', theme.accentBright);
  root.style.setProperty('--seat-secondary', theme.secondary);
  root.style.setProperty('--seat-accent-dim', theme.accentDim);

  root.dataset.active = state?.currentPlayerIndex != null && state.players?.[state.currentPlayerIndex]?.id === player.id ? 'true' : 'false';
  root.dataset.flash = getFlashValue(app, 'player', player.id);
  portrait.innerHTML = window.ModelThemes.getCharacterImage(
    player.modelId,
    portraitState,
    `${state?.totalTurns || 0}-${portraitState}-${player.handSize}`
  );
  setText(shout, shoutText);
  setText(name, getPlayerName(player));
  setText(count, `${player.handSize} ${player.handSize === 1 ? 'card' : 'cards'}`);
  setText(status, getSeatStatus(player, state));

  getSeatClasses(player, state).forEach((className) => root.classList.add(className));
  renderPeekTray(peek, root, slotMeta, player, state, app);
}

function renderTurnRibbon(container, state) {
  container.innerHTML = '';
  const queue = buildTurnRibbon(state);
  if (!queue.length) {
    container.innerHTML = '<div class="turn-pill">waiting</div>';
    return;
  }

  queue.forEach((entry, index) => {
    const pill = document.createElement('div');
    pill.className = 'turn-pill';
    if (entry.isLead) pill.classList.add('is-lead', 'is-current');
    if (entry.isAwaitingHuman) pill.classList.add('is-awaiting-human');
    if (entry.isEliminated) pill.classList.add('is-eliminated');

    const order = document.createElement('span');
    order.className = 'turn-index';
    order.textContent = String(entry.order);

    const thumb = document.createElement('img');
    thumb.className = 'turn-thumb';
    thumb.src = window.ModelThemes.getThumbnail(entry.modelId);
    thumb.alt = entry.name;

    const label = document.createElement('span');
    label.className = 'turn-label';
    label.textContent = shortenName(entry.name);

    pill.appendChild(order);
    pill.appendChild(thumb);
    pill.appendChild(label);
    container.appendChild(pill);

    if (index < queue.length - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'turn-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      container.appendChild(arrow);
    }
  });
}

function renderPile(container, pileSize) {
  container.innerHTML = '';
  if (!pileSize) {
    container.innerHTML = '<div class="pile-icon pile-icon--empty"></div>';
    return;
  }

  const icon = document.createElement('div');
  icon.className = 'pile-icon';
  icon.dataset.depth =
    pileSize > 10
      ? 'deep'
      : pileSize > 4
        ? 'medium'
        : 'light';

  icon.innerHTML = `
    <span class="pile-sheet"></span>
    <span class="pile-sheet"></span>
    <span class="pile-sheet"></span>
  `;
  container.appendChild(icon);
}

function renderPending(container, state, reveal) {
  container.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'claim-line';

  if (state?.pendingTurn) {
    label.textContent = `${state.pendingTurn.claimedCount} x ${state.pendingTurn.claimedRank} on table`;
  } else if (reveal?.label) {
    label.textContent = reveal.label;
    label.classList.add('claim-line--reveal');
  } else {
    label.textContent = 'table quiet';
  }

  container.appendChild(label);
}

function buildDialogueState(app) {
  const state = app.currentState;
  const awaitingHumanAction = getHumanAction(state);
  const latestTurn = state?.turns?.length ? state.turns[state.turns.length - 1] : null;

  if (!state) {
    return {
      speaker: 'launcher',
      text: 'Choose how you want to experience the table.',
      banner: null,
      runtime: 'idle',
    };
  }

  if (state.phase === 'finished' && state.winnerName) {
    const winner = getPlayerById(state, state.winner);
    return {
      speaker: winner ? getPlayerName(winner) : state.winnerName,
      text: `${winner ? getPlayerName(winner) : state.winnerName} wins the table after ${state.totalTurns} turns.`,
      banner: {
        state: 'sustained',
        label: 'winner',
        copy: 'Use the utility drawer to start a new game.',
      },
      runtime: 'finished',
    };
  }

  if (awaitingHumanAction?.type === 'play') {
    return {
      speaker: awaitingHumanAction.playerName,
      text: `Select 1 to 4 cards and claim ${awaitingHumanAction.currentRank}.`,
      banner: {
        state: 'turn',
        label: 'your move',
        copy: 'Only the count and claimed rank are public.',
      },
      runtime: 'your play',
    };
  }

  if (awaitingHumanAction?.type === 'challenge' && awaitingHumanAction.pendingPlay) {
    return {
      speaker: getPlayerName(awaitingHumanAction.pendingPlay),
      text: `${getPlayerName(awaitingHumanAction.pendingPlay)} says ${awaitingHumanAction.pendingPlay.claimedCount} x ${awaitingHumanAction.pendingPlay.claimedRank}. Call bullshit or pass.`,
      banner: {
        state: 'objection',
        label: 'objection!!',
        copy: 'Challenge window is open.',
      },
      runtime: 'your call',
    };
  }

  if (state.phase === 'challenging' && state.pendingTurn) {
    const player = state.players.find((entry) => entry.id === state.pendingTurn.playerId);
    return {
      speaker: getPlayerName(player),
      text: `${getPlayerName(player)} is under cross-examination for ${state.pendingTurn.claimedCount} x ${state.pendingTurn.claimedRank}.`,
      banner: {
        state: 'objection',
        label: 'cross-examination',
        copy: 'Waiting for objections to resolve.',
      },
      runtime: 'challenge window',
    };
  }

  if (latestTurn?.challenged) {
    const challenger = state.players.find((entry) => entry.id === latestTurn.challengerId);
    const player = state.players.find((entry) => entry.id === latestTurn.playerId);
    return {
      speaker: latestTurn.challengeCorrect ? getPlayerName(challenger) : getPlayerName(player),
      text: latestTurn.challengeCorrect
        ? `${getPlayerName(challenger)} exposes the lie.`
        : `${getPlayerName(player)} survives the objection.`,
      banner: {
        state: latestTurn.challengeCorrect ? 'sustained' : 'overruled',
        label: latestTurn.challengeCorrect ? 'sustained' : 'overruled',
        copy: `${getPlayerName(player)} claimed ${latestTurn.claimedCount} x ${latestTurn.claimedRank}.`,
      },
      runtime: latestTurn.challengeCorrect ? 'caught' : 'claim stands',
    };
  }

  if (app.ephemeralThinkingPlayerId) {
    const thinker = state.players.find((entry) => entry.id === app.ephemeralThinkingPlayerId);
    return {
      speaker: getPlayerName(thinker),
      text: `${getPlayerName(thinker)} is preparing a play.`,
      banner: {
        state: 'turn',
        label: 'thinking',
        copy: `Required claim: ${state.currentRank}.`,
      },
      runtime: 'thinking',
    };
  }

  const current = state.players[state.currentPlayerIndex];
  return {
    speaker: getPlayerName(current),
    text: `${getPlayerName(current)} is up. Required claim: ${state.currentRank}.`,
    banner: {
      state: 'turn',
      label: 'turn live',
      copy: `Pile size: ${state.pileSize} cards.`,
    },
    runtime: app.autoPlaying ? 'auto running' : 'live',
  };
}

function buildLogEntries(state) {
  const entries = [];
  if (!state) return entries;
  const includeNotes = !state.interactive;

  if (state.pendingTurn) {
    entries.push({
      tone: 'live',
      title: `${getPlayerName(state.players.find((player) => player.id === state.pendingTurn.playerId))} claims ${state.pendingTurn.claimedCount} x ${state.pendingTurn.claimedRank}`,
      detail: state.awaitingHumanAction?.type === 'challenge'
        ? 'Objection window is open.'
        : 'Challenge checks are in progress.',
      note: includeNotes ? cleanReasoning(state.pendingTurn.reasoning) : '',
    });
  }

  [...(state.turns || [])].reverse().forEach((turn) => {
    const playerName = getPlayerName(state.players.find((player) => player.id === turn.playerId));
    const challengerName = getPlayerName(state.players.find((player) => player.id === turn.challengerId));
    entries.push({
      tone: turn.challenged ? (turn.challengeCorrect ? 'danger' : 'success') : 'neutral',
      title: turn.challenged
        ? `${challengerName} challenged ${playerName}`
        : `${playerName} claimed ${turn.claimedCount} x ${turn.claimedRank}`,
      detail: turn.challenged
        ? `${challengerName} was ${turn.challengeCorrect ? 'right' : 'wrong'}.`
        : 'No one challenged.',
      note: includeNotes ? (cleanReasoning(turn.reasoning) || cleanReasoning(turn.challengeReasoning)) : '',
    });
  });

  return entries.slice(0, 18);
}

function createStatRows(statsObj) {
  return Object.values(statsObj || {}).sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.challengeAccuracy - a.challengeAccuracy;
  });
}

function renderDialogue(dom, app) {
  const state = app.currentState;
  const dialogue = buildDialogueState(app);

  setText(dom.phaseKicker, dialogue.speaker);
  setText(dom.phaseMain, dialogue.text);
  setText(dom.modeChip, state?.interactive ? 'interactive' : (app.launcherMode || 'spectator'));
  setText(dom.providerChip, app.provider);
  setText(dom.runtimeChip, dialogue.runtime);

  if (dialogue.banner) {
    dom.challengeBanner.hidden = false;
    dom.challengeBanner.classList.remove('is-empty');
    dom.challengeBanner.dataset.state = dialogue.banner.state;
    setText(dom.challengeLabel, dialogue.banner.label);
    setText(dom.challengeCopy, dialogue.banner.copy);
  } else {
    dom.challengeBanner.hidden = false;
    dom.challengeBanner.classList.add('is-empty');
    dom.challengeBanner.dataset.state = '';
    setText(dom.challengeLabel, '');
    setText(dom.challengeCopy, '');
  }
}

function renderCommandPanel(dom, app, onToggleCard) {
  const state = app.currentState;
  const awaitingHumanAction = getHumanAction(state);
  dom.commandPanel.hidden = !awaitingHumanAction;
  dom.dialogueHand.innerHTML = '';

  if (!awaitingHumanAction) {
    dom.selectedCards.innerHTML = '';
    return;
  }

  setText(dom.commandMode, state.provider || app.provider);

  if (awaitingHumanAction.type === 'play') {
    const humanPlayer = state.players.find((player) => player.id === awaitingHumanAction.playerId);
    setText(dom.commandTitle, 'your play');
    setText(dom.commandRank, `claim ${awaitingHumanAction.currentRank}`);
    setText(dom.commandCopy, 'Pick 1 to 4 cards. The audience only sees the count and claimed rank.');
    dom.playButtons.hidden = false;
    dom.challengeButtons.hidden = true;
    dom.submitPlayBtn.disabled = app.selectedCards.size < 1 || app.selectedCards.size > 4;
    dom.clearPlayBtn.disabled = app.selectedCards.size === 0;

    if (humanPlayer?.handVisible) {
      renderSelectableHand(dom.dialogueHand, humanPlayer.hand, app.selectedCards, onToggleCard);
    }

    dom.selectedCards.innerHTML = app.selectedCards.size
      ? [...app.selectedCards].map((card) => `<span class="selected-pill">${card}</span>`).join('')
      : '<span class="selected-pill selected-pill--muted">no cards selected</span>';
    return;
  }

  const pendingPlay = awaitingHumanAction.pendingPlay;
  setText(dom.commandTitle, 'your challenge');
  setText(dom.commandRank, pendingPlay ? `${pendingPlay.claimedCount} x ${pendingPlay.claimedRank}` : '');
  setText(
    dom.commandCopy,
    pendingPlay
      ? `${getPlayerName(pendingPlay)} says they played ${pendingPlay.claimedCount} x ${pendingPlay.claimedRank}.`
      : 'Decide whether to call bullshit.'
  );
  dom.playButtons.hidden = true;
  dom.challengeButtons.hidden = false;
  dom.selectedCards.innerHTML = '<span class="selected-pill selected-pill--muted">challenge window open</span>';
}

function renderLog(dom, state) {
  const entries = buildLogEntries(state);
  if (!entries.length) {
    dom.logList.innerHTML = '<div class="drawer-empty">Start a game to see the public action log.</div>';
    return;
  }

  dom.logList.innerHTML = '';
  entries.forEach((entry) => {
    const item = document.createElement('article');
    item.className = `log-entry log-entry--${entry.tone}`;

    const title = document.createElement('div');
    title.className = 'log-title';
    title.textContent = entry.title;

    const detail = document.createElement('div');
    detail.className = 'log-detail';
    detail.textContent = entry.detail;

    item.appendChild(title);
    item.appendChild(detail);

    if (entry.note) {
      const note = document.createElement('div');
      note.className = 'log-note';
      note.textContent = entry.note;
      item.appendChild(note);
    }

    dom.logList.appendChild(item);
  });
}

function renderStats(dom, statsState) {
  setText(dom.statsMeta, statsState.meta);
  dom.statsDrawer.hidden = !statsState.open;
  if (!statsState.open) return;

  if (statsState.loading) {
    dom.statsEmpty.hidden = false;
    dom.statsEmpty.textContent = 'Loading leaderboard...';
    dom.statsTableWrap.hidden = true;
    return;
  }

  if (statsState.error) {
    dom.statsEmpty.hidden = false;
    dom.statsEmpty.textContent = statsState.error;
    dom.statsTableWrap.hidden = true;
    return;
  }

  const rows = createStatRows(statsState.data);
  if (!rows.length) {
    dom.statsEmpty.hidden = false;
    dom.statsEmpty.textContent = 'No comparable completed games found yet.';
    dom.statsTableWrap.hidden = true;
    return;
  }

  dom.statsBody.innerHTML = rows.map((stat, index) => {
    const theme = window.ModelThemes.getTheme(stat.modelId);
    return `
      <tr>
        <td>#${index + 1}</td>
        <td>
          <div class="stats-model">
            <span class="stats-dot" style="background:${theme.accent};"></span>
            <span>${shortenName(stat.modelId)}</span>
          </div>
        </td>
        <td>${formatPercent(stat.winRate)}</td>
        <td>${stat.wins}/${stat.gamesPlayed}</td>
        <td>${formatPercent(stat.lieFrequency)}</td>
        <td>${formatPercent(stat.lieSuccessRate)}</td>
        <td>${formatPercent(stat.paranoiaFrequency)}</td>
        <td>${formatPercent(stat.challengeAccuracy)}</td>
      </tr>
    `;
  }).join('');

  dom.statsEmpty.hidden = true;
  dom.statsTableWrap.hidden = false;
}

function renderLauncher(dom, app) {
  const canClose = Boolean(app.currentState);
  dom.launcher.hidden = !app.launcherOpen;
  dom.launcherCloseBtn.hidden = !canClose;
  dom.providerSelect.value = app.provider;
  dom.humanNameInput.value = app.humanName;
  dom.apiKeyInput.value = app.apiKey;
  dom.launchButton.disabled = app.launcherBusy;
  dom.launcherError.hidden = !app.launcherError;
  setText(dom.launcherError, app.launcherError);

  dom.launcherModeButtons.forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.launchMode === app.launcherMode);
  });

  const interactive = app.launcherMode === 'interactive';
  dom.humanNameField.hidden = !interactive;
  dom.apiKeyField.hidden = app.provider !== 'nim';

  if (interactive) {
    setText(
      dom.launcherNote,
      app.provider === 'nim'
        ? 'Live play uses a session-scoped API key. If the server already has a configured key, this field can stay blank.'
        : 'Mock mode lets you rehearse the interaction flow without live model calls.'
    );
  } else {
    setText(
      dom.launcherNote,
      app.provider === 'mock'
        ? 'Watch Demo starts a self-running mock table immediately.'
        : 'Spectator mode will autoplay the live cohort while keeping the browser UI passive.'
    );
  }
}

export function bindDom(documentRef = document) {
  const slots = Object.fromEntries(
    SLOT_IDS.map((slotId) => {
      const root = documentRef.querySelector(`[data-slot="${slotId}"]`);
      return [slotId, {
        root,
        portrait: byRole(root, 'portrait'),
        shout: byRole(root, 'shout'),
        peek: byRole(root, 'peek'),
        name: byRole(root, 'name'),
        count: byRole(root, 'count'),
        status: byRole(root, 'status'),
      }];
    })
  );

  return {
    root: documentRef.getElementById('app-shell'),
    utilityDrawer: documentRef.getElementById('utility-drawer'),
    utilityToggleBtn: documentRef.getElementById('utility-toggle-btn'),
    utilityCloseBtn: documentRef.getElementById('utility-close-btn'),
    modeChip: documentRef.getElementById('mode-chip'),
    providerChip: documentRef.getElementById('provider-chip'),
    runtimeChip: documentRef.getElementById('runtime-chip'),
    phaseKicker: documentRef.getElementById('phase-kicker'),
    phaseMain: documentRef.getElementById('phase-main'),
    challengeBanner: documentRef.getElementById('challenge-banner'),
    challengeLabel: documentRef.getElementById('challenge-label'),
    challengeCopy: documentRef.getElementById('challenge-copy'),
    roundNumber: documentRef.getElementById('round-number'),
    currentRank: documentRef.getElementById('current-rank'),
    pileCount: documentRef.getElementById('pile-count'),
    pileDisplay: documentRef.getElementById('pile-display'),
    pendingDisplay: documentRef.getElementById('pending-display'),
    turnRibbon: documentRef.getElementById('turn-ribbon'),
    slots,
    commandPanel: documentRef.getElementById('command-panel'),
    commandTitle: documentRef.getElementById('human-action-title'),
    commandRank: documentRef.getElementById('human-action-rank'),
    commandMode: documentRef.getElementById('human-action-mode'),
    commandCopy: documentRef.getElementById('human-action-copy'),
    dialogueHand: documentRef.getElementById('dialogue-hand'),
    selectedCards: documentRef.getElementById('selected-cards'),
    playButtons: documentRef.getElementById('human-play-buttons'),
    challengeButtons: documentRef.getElementById('human-challenge-buttons'),
    submitPlayBtn: documentRef.getElementById('submit-play-btn'),
    clearPlayBtn: documentRef.getElementById('clear-play-btn'),
    challengeBtn: documentRef.getElementById('challenge-btn'),
    passBtn: documentRef.getElementById('pass-btn'),
    logDrawer: documentRef.getElementById('log-drawer'),
    logList: documentRef.getElementById('log-list'),
    logCloseBtn: documentRef.getElementById('log-close-btn'),
    statsDrawer: documentRef.getElementById('stats-drawer'),
    statsMeta: documentRef.getElementById('stats-meta'),
    statsBody: documentRef.getElementById('stats-body'),
    statsEmpty: documentRef.getElementById('stats-empty'),
    statsTableWrap: documentRef.getElementById('stats-table-wrap'),
    statsRefreshBtn: documentRef.getElementById('stats-refresh-btn'),
    statsCloseBtn: documentRef.getElementById('stats-close-btn'),
    launcher: documentRef.getElementById('launcher-overlay'),
    launcherCloseBtn: documentRef.getElementById('launcher-close-btn'),
    launcherModeButtons: [...documentRef.querySelectorAll('[data-launch-mode]')],
    providerSelect: documentRef.getElementById('provider-select'),
    humanNameInput: documentRef.getElementById('human-name-input'),
    apiKeyInput: documentRef.getElementById('api-key-input'),
    humanNameField: documentRef.getElementById('human-name-field'),
    apiKeyField: documentRef.getElementById('api-key-field'),
    launcherNote: documentRef.getElementById('launcher-note'),
    launcherError: documentRef.getElementById('launcher-error'),
    launchButton: documentRef.getElementById('launch-btn'),
    newGameBtn: documentRef.getElementById('new-game-btn'),
    stepBtn: documentRef.getElementById('step-btn'),
    autoPlayBtn: documentRef.getElementById('auto-play-btn'),
    setupToggleBtn: documentRef.getElementById('setup-toggle-btn'),
    logToggleBtn: documentRef.getElementById('log-toggle-btn'),
    statsToggleBtn: documentRef.getElementById('stats-toggle-btn'),
    experimentSelect: documentRef.getElementById('experiment-select'),
  };
}

export function renderApp(dom, app, layout, onToggleCard) {
  const state = app.currentState;
  const viewState = state
    ? { ...state, thinkingPlayerId: app.ephemeralThinkingPlayerId ?? state.thinkingPlayerId }
    : null;

  dom.root.dataset.mode = viewState?.interactive ? 'interactive' : (app.launcherMode || 'spectator');

  renderDialogue(dom, { ...app, currentState: viewState });
  setText(dom.roundNumber, String((viewState?.totalTurns || 0) + 1));
  setText(dom.currentRank, viewState?.currentRank || 'A');
  setText(dom.pileCount, `${viewState?.pileSize || 0} ${(viewState?.pileSize || 0) === 1 ? 'card' : 'cards'}`);
  dom.pendingDisplay.dataset.flash = getFlashValue(app, 'zone', 'claim');
  dom.pileDisplay.dataset.flash = getFlashValue(app, 'zone', 'pile');
  renderPile(dom.pileDisplay, viewState?.pileSize || 0);
  renderPending(dom.pendingDisplay, viewState, app.transientReveal);
  renderTurnRibbon(dom.turnRibbon, viewState);

  SLOT_IDS.forEach((slotId) => {
    const playerId = layout.slots[slotId];
    const player = viewState?.players?.find((entry) => entry.id === playerId) ?? null;
    renderSeat(dom.slots[slotId], slotId, layout.slotMeta?.[slotId], player, viewState, app);
  });

  renderCommandPanel(dom, app, onToggleCard);
  renderLog(dom, viewState);
  dom.logDrawer.hidden = !app.logOpen;
  renderStats(dom, app.stats);
  renderLauncher(dom, app);

  dom.utilityDrawer.hidden = !app.utilityOpen;
  dom.stepBtn.disabled = !app.currentGameId || app.autoPlaying || Boolean(viewState?.awaitingHumanAction) || app.stepBusy;
  dom.autoPlayBtn.disabled = !app.currentGameId || viewState?.phase === 'finished' || app.stepBusy || Boolean(viewState?.awaitingHumanAction);
  setText(dom.autoPlayBtn, app.autoPlaying ? 'stop' : 'auto');
}

export function buildTextState(app, layout) {
  const state = app.currentState;
  return JSON.stringify({
    mode: state?.interactive ? 'interactive' : 'spectator',
    phase: state?.phase || 'idle',
    currentRank: state?.currentRank || null,
    pileSize: state?.pileSize || 0,
    awaitingHumanAction: state?.awaitingHumanAction || null,
    activePlayerId: layout.activePlayerId,
    utilityOpen: app.utilityOpen,
    attention: app.attention ? {
      playerIds: app.attention.playerIds,
      zones: app.attention.zones,
      variant: app.attention.variant,
    } : null,
    slots: SLOT_IDS.map((slotId) => {
      const playerId = layout.slots[slotId];
      const player = state?.players?.find((entry) => entry.id === playerId);
      return {
        slotId,
        playerId,
        stagePosition: layout.slotMeta?.[slotId]?.stagePosition || slotId,
        facing: layout.slotMeta?.[slotId]?.facing || 'forward',
        name: getPlayerName(player),
        handSize: player?.handSize || 0,
        visible: Boolean(player?.handVisible),
        peekOpen: app.spectatorPeekPlayerId === playerId,
        status: player ? getSeatStatus(player, state) : 'empty',
      };
    }),
    selectedCards: [...app.selectedCards],
    transientReveal: app.transientReveal,
  });
}
