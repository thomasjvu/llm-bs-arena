import { SLOT_IDS, buildTurnRibbon, getSlotForPlayer } from './layout.js';

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
  return player?.displayName || shortenName(player?.modelId) || 'Unknown';
}

function getHumanAction(state) {
  return state?.awaitingHumanAction || null;
}

function getCurrentTurnPlayerId(state) {
  if (!state?.players?.length) return null;
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

function getStatusLabel(player, state) {
  if (!player) return 'waiting';
  if (state?.winner === player.id) return 'winner';
  if (player.isEliminated) return 'out';
  if (state?.awaitingHumanAction?.type === 'play' && state.awaitingHumanAction.playerId === player.id) return 'play now';
  if (state?.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.playerId === player.id) return 'decide now';
  if (state?.phase === 'challenging' && state.pendingTurn?.playerId === player.id) return 'defending';
  if (state?.thinkingPlayerId === player.id && state.phase === 'challenging') return 'judging now';
  if (state?.thinkingPlayerId === player.id) return 'thinking';
  if (player.isActive) return 'current turn';
  return 'ready';
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
  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.playerId === player.id) return 'your objection';
  if (state.phase === 'challenging' && state.thinkingPlayerId === player.id) return 'judging';
  if (state.phase === 'challenging' && state.pendingTurn?.playerId === player.id) return 'on defense';
  if (state.phase !== 'challenging' && player.isActive) return 'current turn';
  return '';
}

function getSeatShout(player, state) {
  if (!player || !state) return { text: '', tone: 'neutral' };

  const latestTurn = state.turns?.length ? state.turns[state.turns.length - 1] : null;

  if (state.winner === player.id) {
    return { text: 'winner', tone: 'success' };
  }

  if (state.awaitingHumanAction?.type === 'play' && state.awaitingHumanAction.playerId === player.id) {
    return { text: 'play now', tone: 'neutral' };
  }

  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.playerId === player.id) {
    return { text: 'objection?', tone: 'danger' };
  }

  if (state.phase === 'challenging' && state.pendingTurn?.playerId === player.id) {
    return { text: 'hold it!', tone: 'neutral' };
  }

  if (latestTurn?.challenged) {
    if (latestTurn.challengerId === player.id) {
      return {
        text: latestTurn.challengeCorrect ? 'objection!!' : 'overruled',
        tone: latestTurn.challengeCorrect ? 'danger' : 'neutral',
      };
    }

    if (latestTurn.playerId === player.id) {
      return {
        text: latestTurn.challengeCorrect ? 'exposed' : 'claim stands',
        tone: latestTurn.challengeCorrect ? 'neutral' : 'success',
      };
    }
  }

  if (getCurrentTurnPlayerId(state) === player.id) {
    return {
      text: player.role === 'human' ? 'your move' : 'turn live',
      tone: 'neutral',
    };
  }

  return { text: '', tone: 'neutral' };
}

function getPlayerAction(player, state) {
  if (!player || !state) {
    return { label: '', detail: '', callout: '' };
  }

  if (state.pendingTurn?.playerId === player.id) {
    return {
      label: `${state.pendingTurn.claimedCount} x ${state.pendingTurn.claimedRank} on table`,
      detail: state.phase === 'challenging'
        ? 'Waiting to see whether anyone objects.'
        : cleanReasoning(state.pendingTurn.reasoning),
      callout: state.phase === 'challenging' ? 'objection window open' : 'claim live',
    };
  }

  const latestTurn = [...(state.turns || [])].reverse().find((turn) => turn.playerId === player.id);
  if (latestTurn) {
    return {
      label: latestTurn.challenged
        ? `${latestTurn.claimedCount} x ${latestTurn.claimedRank} challenged`
        : `last claim ${latestTurn.claimedCount} x ${latestTurn.claimedRank}`,
      detail: latestTurn.challenged
        ? latestTurn.challengeCorrect
          ? 'Objection sustained.'
          : 'Objection overruled.'
        : cleanReasoning(latestTurn.reasoning),
      callout: latestTurn.challenged
        ? latestTurn.challengeCorrect
          ? 'objection sustained'
          : 'objection overruled'
        : 'no challenge',
    };
  }

  const latestChallenge = [...(state.turns || [])].reverse().find((turn) => turn.challengerId === player.id);
  if (latestChallenge) {
    return {
      label: latestChallenge.challengeCorrect ? 'raised objection' : 'objection missed',
      detail: latestChallenge.challengeCorrect ? 'Challenge succeeded.' : 'Challenge failed.',
      callout: latestChallenge.challengeCorrect ? 'challenge landed' : 'challenge failed',
    };
  }

  return { label: '', detail: '', callout: '' };
}

function buildLogEntries(state) {
  const entries = [];
  if (!state) return entries;

  if (state.pendingTurn) {
    entries.push({
      tone: 'live',
      title: `claim: ${getPlayerName(state.players.find((player) => player.id === state.pendingTurn.playerId))} put down ${state.pendingTurn.claimedCount} x ${state.pendingTurn.claimedRank}`,
      detail: state.awaitingHumanAction?.type === 'challenge'
        ? 'Objection window is open.'
        : 'Challenge checks are in progress.',
      note: cleanReasoning(state.pendingTurn.reasoning),
    });
  }

  [...(state.turns || [])].reverse().forEach((turn) => {
    const playerName = getPlayerName(state.players.find((player) => player.id === turn.playerId));
    const challengerName = getPlayerName(state.players.find((player) => player.id === turn.challengerId));
    entries.push({
      tone: turn.challenged ? (turn.challengeCorrect ? 'danger' : 'success') : 'neutral',
      title: turn.challenged
        ? `objection: ${challengerName} challenged ${playerName}`
        : `${playerName} claimed ${turn.claimedCount} x ${turn.claimedRank}`,
      detail: turn.challenged
        ? `${challengerName} challenged and was ${turn.challengeCorrect ? 'right' : 'wrong'}.`
        : 'No one challenged.',
      note: cleanReasoning(turn.reasoning) || cleanReasoning(turn.challengeReasoning),
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

function renderHiddenHand(container, count) {
  const visibleCards = Math.min(count, 8);
  for (let index = 0; index < visibleCards; index += 1) {
    const cardEl = renderCard('back', false);
    cardEl.classList.add('is-hidden-card');
    container.appendChild(cardEl);
  }
  if (count > visibleCards) {
    const extra = document.createElement('div');
    extra.className = 'hand-overflow';
    extra.textContent = `+${count - visibleCards}`;
    container.appendChild(extra);
  }
}

function renderPlayerHand(container, player, state, selectedCards, onToggleCard) {
  container.innerHTML = '';
  if (!player) return;

  const awaitingHumanAction = getHumanAction(state);
  const canSelect =
    awaitingHumanAction?.type === 'play' &&
    awaitingHumanAction.playerId === player.id &&
    player.handVisible;

  if (!player.handVisible) {
    renderHiddenHand(container, player.handSize);
    return;
  }

  if (!player.hand?.length) {
    const empty = document.createElement('div');
    empty.className = 'hand-empty';
    empty.textContent = 'hand clear';
    container.appendChild(empty);
    return;
  }

  if (canSelect) {
    renderSelectableHand(container, player.hand, selectedCards, onToggleCard);
    return;
  }

  player.hand.forEach((card) => {
    container.appendChild(renderCard(card, true));
  });
}

function renderSlot(slotDom, slotId, player, state, onToggleCard, selectedCards) {
  const root = slotDom.root;
  const bg = slotDom.bg;
  const portrait = slotDom.portrait;
  const shout = slotDom.shout;
  const title = slotDom.title;
  const name = slotDom.name;
  const count = slotDom.count;
  const status = slotDom.status;
  const callout = slotDom.callout;
  const action = slotDom.action;
  const reasoning = slotDom.reasoning;
  const hand = slotDom.hand;

  root.className = slotId === 'active' ? 'seat-card seat-card--active' : 'seat-card seat-card--side';

  if (!player) {
    root.dataset.badge = '';
    bg.style.background = '';
    portrait.innerHTML = '';
    setText(shout, '');
    if (shout) shout.dataset.tone = '';
    setText(title, 'standby');
    setText(name, 'empty seat');
    setText(count, '0 cards');
    setText(status, 'waiting');
    clearNode(callout);
    clearNode(action);
    clearNode(reasoning);
    hand.innerHTML = '';
    return;
  }

  const theme = window.ModelThemes.getTheme(player.modelId);
  const actionState = getPlayerAction(player, state);
  const shoutState = getSeatShout(player, state);
  const portraitState = getPortraitState(player, state);

  bg.style.background = theme.bg;
  root.style.setProperty('--seat-accent', theme.accent);
  root.style.setProperty('--seat-accent-bright', theme.accentBright);
  root.style.setProperty('--seat-secondary', theme.secondary);
  root.style.setProperty('--seat-accent-dim', theme.accentDim);
  root.dataset.badge = getSeatBadge(player, state);
  portrait.innerHTML = window.ModelThemes.getCharacterImage(
    player.modelId,
    portraitState,
    `${state?.totalTurns || 0}-${portraitState}-${player.handSize}`
  );
  setText(shout, shoutState.text);
  if (shout) shout.dataset.tone = shoutState.text ? shoutState.tone : '';
  setText(title, '');
  setText(name, getPlayerName(player));
  setText(count, `${player.handSize} ${player.handSize === 1 ? 'card' : 'cards'}`);
  setText(status, getStatusLabel(player, state));
  setText(callout, shoutState.text ? '' : actionState.callout);
  setText(action, actionState.label);
  setText(reasoning, actionState.detail);

  getSeatClasses(player, state).forEach((className) => root.classList.add(className));
  renderPlayerHand(hand, player, state, selectedCards, onToggleCard);
}

function renderTurnRibbon(container, state) {
  container.innerHTML = '';
  const queue = buildTurnRibbon(state);
  if (!queue.length) {
    container.innerHTML = '<div class="turn-pill">waiting for table</div>';
    return;
  }

  queue.forEach((entry) => {
    const pill = document.createElement('div');
    pill.className = 'turn-pill';
    if (entry.isLead) pill.classList.add('is-lead');
    if (entry.isLead) pill.classList.add('is-current');
    if (entry.isAwaitingHuman) pill.classList.add('is-awaiting-human');
    if (entry.isEliminated) pill.classList.add('is-eliminated');

    const thumb = document.createElement('img');
    thumb.className = 'turn-thumb';
    thumb.src = window.ModelThemes.getThumbnail(entry.modelId);
    thumb.alt = entry.name;

    const label = document.createElement('span');
    label.textContent = shortenName(entry.name);

    pill.appendChild(thumb);
    pill.appendChild(label);
    container.appendChild(pill);
  });
}

function renderPile(container, pile) {
  container.innerHTML = '';
  const visible = (pile || []).slice(-5);
  if (!visible.length) {
    container.innerHTML = '<div class="pile-placeholder">table clear</div>';
    return;
  }
  visible.forEach((card) => container.appendChild(renderCard(card, false)));
}

function renderPending(container, state, reveal) {
  container.innerHTML = '';

  if (state?.pendingTurn) {
    const count = state.pendingTurn.claimedCount || state.pendingTurn.actualCards?.length || 1;
    for (let index = 0; index < count; index += 1) {
      container.appendChild(renderCard('back', false));
    }
    return;
  }

  if (reveal?.cards?.length) {
    reveal.cards.forEach((card) => container.appendChild(renderCard(card, true)));
    return;
  }

  container.innerHTML = '<div class="pending-placeholder">awaiting claim</div>';
}

function renderPhase(dom, app) {
  const state = app.currentState;
  const awaitingHumanAction = getHumanAction(state);
  const latestTurn = state?.turns?.length ? state.turns[state.turns.length - 1] : null;
  let kicker = 'launcher';
  let main = 'Choose how you want to experience the table.';
  let runtime = 'idle';
  let bannerState = '';

  if (state) {
    kicker = state.interactive ? 'play vs models' : 'watch demo';
    runtime = app.autoPlaying ? 'auto running' : 'live';

    if (state.phase === 'finished' && state.winnerName) {
      main = `${state.winnerName} won the table after ${state.totalTurns} turns.`;
      runtime = 'finished';
    } else if (awaitingHumanAction?.type === 'play') {
      main = `Your turn. Select 1 to 4 cards and claim ${awaitingHumanAction.currentRank}.`;
      runtime = 'your play';
    } else if (awaitingHumanAction?.type === 'challenge' && awaitingHumanAction.pendingPlay) {
      const pendingPlayer = getPlayerName(awaitingHumanAction.pendingPlay);
      main = `${pendingPlayer} claims ${awaitingHumanAction.pendingPlay.claimedCount} x ${awaitingHumanAction.pendingPlay.claimedRank}. Challenge or pass.`;
      runtime = 'your call';
      bannerState = 'objection';
    } else if (state.phase === 'challenging' && state.pendingTurn) {
      main = `${getPlayerName(state.players.find((player) => player.id === state.pendingTurn.playerId))} is being judged.`;
      runtime = 'challenge window';
      bannerState = 'objection';
    } else if (app.ephemeralThinkingPlayerId) {
      const thinker = state.players.find((player) => player.id === app.ephemeralThinkingPlayerId);
      main = `${getPlayerName(thinker)} is thinking.`;
      runtime = 'thinking';
      bannerState = 'turn';
    } else {
      const current = state.players[state.currentPlayerIndex];
      main = `${getPlayerName(current)} is up. Required rank: ${state.currentRank}.`;
      bannerState = 'turn';
    }
  }

  setText(dom.phaseKicker, kicker);
  setText(dom.phaseMain, main);
  setText(dom.modeChip, state?.interactive ? 'interactive' : (app.launcherMode || 'spectator'));
  setText(dom.providerChip, app.provider);
  setText(dom.runtimeChip, runtime);

  if (awaitingHumanAction?.type === 'challenge' && awaitingHumanAction.pendingPlay) {
    dom.challengeBanner.hidden = false;
    dom.challengeBanner.dataset.state = 'objection';
    setText(dom.challengeLabel, 'objection!!');
    setText(
      dom.challengeCopy,
      `${getPlayerName(awaitingHumanAction.pendingPlay)} says ${awaitingHumanAction.pendingPlay.claimedCount} x ${awaitingHumanAction.pendingPlay.claimedRank}. Decide whether to object.`
    );
  } else if (state?.phase === 'challenging' && state.pendingTurn) {
    dom.challengeBanner.hidden = false;
    dom.challengeBanner.dataset.state = 'objection';
    setText(dom.challengeLabel, 'objection pending');
    setText(
      dom.challengeCopy,
      `${getPlayerName(state.players.find((player) => player.id === state.pendingTurn.playerId))} is waiting on challenge checks.`
    );
  } else if (latestTurn?.challenged) {
    const challengerName = getPlayerName(state.players.find((player) => player.id === latestTurn.challengerId));
    const playerName = getPlayerName(state.players.find((player) => player.id === latestTurn.playerId));
    dom.challengeBanner.hidden = false;
    dom.challengeBanner.dataset.state = latestTurn.challengeCorrect ? 'sustained' : 'overruled';
    setText(dom.challengeLabel, latestTurn.challengeCorrect ? 'sustained' : 'overruled');
    setText(
      dom.challengeCopy,
      `${challengerName} challenged ${playerName}'s ${latestTurn.claimedCount} x ${latestTurn.claimedRank}.`
    );
  } else if (state) {
    const currentTurnPlayer = state.players.find((player) => player.id === getCurrentTurnPlayerId(state));
    dom.challengeBanner.hidden = false;
    dom.challengeBanner.dataset.state = bannerState || 'turn';
    setText(dom.challengeLabel, 'turn live');
    setText(
      dom.challengeCopy,
      state.awaitingHumanAction?.type === 'play'
        ? `${getPlayerName(currentTurnPlayer)} must play ${state.currentRank}.`
        : `${getPlayerName(currentTurnPlayer)} is acting now.`
    );
  } else {
    dom.challengeBanner.hidden = true;
    dom.challengeBanner.dataset.state = '';
    setText(dom.challengeLabel, '');
    setText(dom.challengeCopy, '');
  }
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

function renderCommandDock(dom, app) {
  const state = app.currentState;
  const awaitingHumanAction = getHumanAction(state);
  dom.commandDock.hidden = !awaitingHumanAction;

  if (!awaitingHumanAction) {
    return;
  }

  setText(dom.commandMode, state.provider || app.provider);

  if (awaitingHumanAction.type === 'play') {
    setText(dom.commandTitle, 'your play');
    setText(dom.commandRank, `claim ${awaitingHumanAction.currentRank}`);
    setText(dom.commandCopy, 'Pick 1 to 4 cards from your visible hand. The table only sees the count and claimed rank.');
    dom.playButtons.hidden = false;
    dom.challengeButtons.hidden = true;
    dom.submitPlayBtn.disabled = app.selectedCards.size < 1 || app.selectedCards.size > 4;
    dom.clearPlayBtn.disabled = app.selectedCards.size === 0;
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

export function bindDom(documentRef = document) {
  const slots = Object.fromEntries(
    SLOT_IDS.map((slotId) => {
      const root = documentRef.querySelector(`[data-slot="${slotId}"]`);
      return [slotId, {
        root,
        bg: byRole(root, 'bg'),
        portrait: byRole(root, 'portrait'),
        shout: byRole(root, 'shout'),
        title: byRole(root, 'title'),
        name: byRole(root, 'name'),
        count: byRole(root, 'count'),
        status: byRole(root, 'status'),
        callout: byRole(root, 'callout'),
        action: byRole(root, 'action'),
        reasoning: byRole(root, 'reasoning'),
        hand: byRole(root, 'hand'),
      }];
    })
  );

  return {
    root: documentRef.getElementById('app-shell'),
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
    commandDock: documentRef.getElementById('human-action-panel'),
    commandTitle: documentRef.getElementById('human-action-title'),
    commandRank: documentRef.getElementById('human-action-rank'),
    commandMode: documentRef.getElementById('human-action-mode'),
    commandCopy: documentRef.getElementById('human-action-copy'),
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
    winnerModal: documentRef.getElementById('winner-modal'),
    winnerName: documentRef.getElementById('winner-name'),
    winnerCloseBtn: documentRef.getElementById('winner-close-btn'),
  };
}

export function renderApp(dom, app, layout, onToggleCard) {
  const state = app.currentState;
  const viewState = state
    ? { ...state, thinkingPlayerId: app.ephemeralThinkingPlayerId ?? state.thinkingPlayerId }
    : null;

  dom.root.dataset.mode = viewState?.interactive ? 'interactive' : (app.launcherMode || 'spectator');

  renderPhase(dom, { ...app, currentState: viewState });

  setText(dom.roundNumber, String((viewState?.totalTurns || 0) + 1));
  setText(dom.currentRank, viewState?.currentRank || 'A');
  setText(dom.pileCount, `${viewState?.pileSize || 0} ${(viewState?.pileSize || 0) === 1 ? 'card' : 'cards'}`);
  renderPile(dom.pileDisplay, viewState?.pile || []);
  renderPending(dom.pendingDisplay, viewState, app.transientReveal);
  renderTurnRibbon(dom.turnRibbon, viewState);

  SLOT_IDS.forEach((slotId) => {
    const playerId = layout.slots[slotId];
    const player = viewState?.players?.find((entry) => entry.id === playerId) ?? null;
    renderSlot(dom.slots[slotId], slotId, player, viewState, onToggleCard, app.selectedCards);
  });

  renderCommandDock(dom, app);
  renderLog(dom, viewState);
  dom.logDrawer.hidden = !app.logOpen;
  renderStats(dom, app.stats);
  renderLauncher(dom, app);

  dom.stepBtn.disabled = !app.currentGameId || app.autoPlaying || Boolean(viewState?.awaitingHumanAction) || app.stepBusy;
  dom.autoPlayBtn.disabled = !app.currentGameId || viewState?.phase === 'finished' || app.stepBusy || Boolean(viewState?.awaitingHumanAction);
  setText(dom.autoPlayBtn, app.autoPlaying ? 'stop' : 'auto');

  if (viewState?.phase === 'finished' && viewState.winnerName && app.showWinnerModal) {
    dom.winnerModal.hidden = false;
    setText(dom.winnerName, viewState.winnerName);
  } else {
    dom.winnerModal.hidden = true;
  }
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
    slots: SLOT_IDS.map((slotId) => {
      const playerId = layout.slots[slotId];
      const player = state?.players?.find((entry) => entry.id === playerId);
      return {
        slotId,
        playerId,
        name: getPlayerName(player),
        handSize: player?.handSize || 0,
        visible: Boolean(player?.handVisible),
        status: player ? getStatusLabel(player, state) : 'empty',
      };
    }),
    selectedCards: [...app.selectedCards],
    transientReveal: app.transientReveal,
  });
}
