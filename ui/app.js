// LLM Bullshit - Game Visualizer
// 4-column layout with character portraits and themed backgrounds

// ─── Sound Effects (Web Audio API) ───────────────────────────────────

const SoundFX = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function createBrownNoise(duration) {
    const ac = getCtx();
    const len = ac.sampleRate * duration;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    return src;
  }

  function createNoise(duration) {
    const ac = getCtx();
    const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    return src;
  }

  function cardFlickSound(ac, time, volume) {
    const noise = createBrownNoise(0.08);
    const gain = ac.createGain();
    const lp = ac.createBiquadFilter();
    const hp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(6000, time);
    lp.frequency.exponentialRampToValueAtTime(800, time + 0.06);
    hp.type = 'highpass';
    hp.frequency.value = 300;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    noise.connect(hp).connect(lp).connect(gain).connect(ac.destination);
    noise.start(time);
    noise.stop(time + 0.08);
  }

  return {
    playCard() {
      const ac = getCtx();
      const now = ac.currentTime;
      cardFlickSound(ac, now, 0.4);
      const thud = ac.createOscillator();
      const thudGain = ac.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(180, now + 0.01);
      thud.frequency.exponentialRampToValueAtTime(60, now + 0.08);
      thudGain.gain.setValueAtTime(0.001, now);
      thudGain.gain.linearRampToValueAtTime(0.12, now + 0.012);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      thud.connect(thudGain).connect(ac.destination);
      thud.start(now);
      thud.stop(now + 0.1);
    },

    challenge() {
      // Heavy flat desk slam — massive low-end impact
      const ac = getCtx();
      const now = ac.currentTime;

      // Sub-bass boom — the weight of the slam
      const sub = ac.createOscillator();
      const subGain = ac.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(80, now);
      sub.frequency.exponentialRampToValueAtTime(20, now + 0.4);
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.8, now + 0.003);
      subGain.gain.setValueAtTime(0.7, now + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      sub.connect(subGain).connect(ac.destination);
      sub.start(now);
      sub.stop(now + 0.55);

      // Mid thud for body
      const mid = ac.createOscillator();
      const midGain = ac.createGain();
      const midLP = ac.createBiquadFilter();
      mid.type = 'sine';
      mid.frequency.setValueAtTime(150, now);
      mid.frequency.exponentialRampToValueAtTime(40, now + 0.2);
      midLP.type = 'lowpass';
      midLP.frequency.value = 300;
      midGain.gain.setValueAtTime(0.001, now);
      midGain.gain.linearRampToValueAtTime(0.6, now + 0.003);
      midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      mid.connect(midLP).connect(midGain).connect(ac.destination);
      mid.start(now);
      mid.stop(now + 0.4);

      // Wide noise burst — the crack/slap of hand on desk
      const slap = createBrownNoise(0.15);
      const slapGain = ac.createGain();
      const slapBP = ac.createBiquadFilter();
      slapBP.type = 'bandpass';
      slapBP.frequency.value = 800;
      slapBP.Q.value = 0.5;
      slapGain.gain.setValueAtTime(0.001, now);
      slapGain.gain.linearRampToValueAtTime(0.7, now + 0.001);
      slapGain.gain.setValueAtTime(0.5, now + 0.02);
      slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      slap.connect(slapBP).connect(slapGain).connect(ac.destination);
      slap.start(now);
      slap.stop(now + 0.15);

      // Rattling overtone — desk vibration after slam
      const rattle = ac.createOscillator();
      const rattleGain = ac.createGain();
      const rattleLP = ac.createBiquadFilter();
      rattle.type = 'triangle';
      rattle.frequency.setValueAtTime(55, now + 0.04);
      rattle.frequency.setValueAtTime(50, now + 0.15);
      rattle.frequency.exponentialRampToValueAtTime(35, now + 0.6);
      rattleLP.type = 'lowpass';
      rattleLP.frequency.value = 200;
      rattleGain.gain.setValueAtTime(0.001, now + 0.04);
      rattleGain.gain.linearRampToValueAtTime(0.15, now + 0.06);
      rattleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      rattle.connect(rattleLP).connect(rattleGain).connect(ac.destination);
      rattle.start(now + 0.04);
      rattle.stop(now + 0.65);
    },

    challengeCorrect() {
      const ac = getCtx();
      const now = ac.currentTime;
      [523, 784].forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const lp = ac.createBiquadFilter();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        lp.type = 'lowpass';
        lp.frequency.value = 4000;
        const t = now + i * 0.12;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
        gain.gain.setValueAtTime(0.2, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(lp).connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      });
      const accent = createNoise(0.08);
      const accentGain = ac.createGain();
      const accentHP = ac.createBiquadFilter();
      accentHP.type = 'highpass';
      accentHP.frequency.value = 5000;
      accentGain.gain.setValueAtTime(0.001, now + 0.12);
      accentGain.gain.linearRampToValueAtTime(0.08, now + 0.125);
      accentGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      accent.connect(accentHP).connect(accentGain).connect(ac.destination);
      accent.start(now + 0.12);
      accent.stop(now + 0.2);
    },

    challengeWrong() {
      const ac = getCtx();
      const now = ac.currentTime;
      [392, 233].forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const lp = ac.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.2);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.9, now + i * 0.2 + 0.25);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1200, now + i * 0.2);
        lp.frequency.exponentialRampToValueAtTime(300, now + i * 0.2 + 0.3);
        lp.Q.value = 2;
        const t = now + i * 0.2;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
        gain.gain.setValueAtTime(0.1, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(lp).connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    },

    win() {
      const ac = getCtx();
      const now = ac.currentTime;
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const lp = ac.createBiquadFilter();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        lp.type = 'lowpass';
        lp.frequency.value = 3000;
        const t = now + i * 0.1;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.03);
        gain.gain.setValueAtTime(0.15, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(lp).connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
      const shimmer = createNoise(0.4);
      const shimGain = ac.createGain();
      const shimBP = ac.createBiquadFilter();
      shimBP.type = 'bandpass';
      shimBP.frequency.value = 6000;
      shimBP.Q.value = 3;
      shimGain.gain.setValueAtTime(0.001, now + 0.3);
      shimGain.gain.linearRampToValueAtTime(0.04, now + 0.35);
      shimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      shimmer.connect(shimBP).connect(shimGain).connect(ac.destination);
      shimmer.start(now + 0.3);
      shimmer.stop(now + 0.7);
    },

    cardFlick() {
      const ac = getCtx();
      cardFlickSound(ac, ac.currentTime, 0.15 + Math.random() * 0.15);
    },

    deal() {
      const ac = getCtx();
      const now = ac.currentTime;
      for (let i = 0; i < 7; i++) {
        const t = now + i * 0.055;
        const vol = 0.15 + Math.random() * 0.15;
        cardFlickSound(ac, t, vol);
      }
    },

    // Per-character voice blips — each player gets a distinct voice
    _textBlipLast: 0,
    _voices: [
      { base: 320, range: 60, wave: 'triangle', lp: 1800 },  // player 0: warm low
      { base: 480, range: 80, wave: 'triangle', lp: 2200 },  // player 1: mid bright
      { base: 260, range: 50, wave: 'sine',     lp: 1400 },  // player 2: deep mellow
      { base: 540, range: 90, wave: 'triangle', lp: 2600 },  // player 3: high airy
    ],
    textBlip(playerIndex) {
      const now = performance.now();
      if (now - this._textBlipLast < 55) return; // throttle ~18 blips/sec
      this._textBlipLast = now;

      const ac = getCtx();
      const t = ac.currentTime;
      const voice = this._voices[playerIndex] || this._voices[0];

      // Main tone — warm triangle/sine with pitch wobble
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const lp = ac.createBiquadFilter();

      osc.type = voice.wave;
      const freq = voice.base + (Math.random() - 0.5) * voice.range;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.setValueAtTime(freq * (0.97 + Math.random() * 0.06), t + 0.02);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.88, t + 0.055);

      lp.type = 'lowpass';
      lp.frequency.value = voice.lp;
      lp.Q.value = 0.7;

      // Soft attack, short sustain, gentle decay
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.006);
      gain.gain.setValueAtTime(0.055, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(lp).connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.065);

      // Subtle harmonic overtone for warmth
      const h = ac.createOscillator();
      const hGain = ac.createGain();
      h.type = 'sine';
      h.frequency.setValueAtTime(freq * 1.5, t);
      h.frequency.exponentialRampToValueAtTime(freq * 1.3, t + 0.04);
      hGain.gain.setValueAtTime(0.001, t);
      hGain.gain.linearRampToValueAtTime(0.015, t + 0.008);
      hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      h.connect(hGain).connect(ac.destination);
      h.start(t);
      h.stop(t + 0.05);
    }
  };
})();

// ─── Card Flight Animations ──────────────────────────────────────────

function animateCardsToTarget(sourceEl, targetEl, count, onDone) {
  if (!sourceEl || !targetEl || count <= 0) {
    if (onDone) onDone();
    return;
  }

  const srcRect = sourceEl.getBoundingClientRect();
  const tgtRect = targetEl.getBoundingClientRect();
  let completed = 0;

  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'flying-card';
    card.innerHTML = window.CardRenderer.getCardBackSVG();

    card.style.left = srcRect.left + srcRect.width / 2 - 17 + 'px';
    card.style.top = srcRect.top + srcRect.height / 2 - 24 + 'px';
    card.style.transform = `rotate(${(Math.random() - 0.5) * 15}deg)`;
    document.body.appendChild(card);

    setTimeout(() => {
      card.style.left = tgtRect.left + tgtRect.width / 2 - 17 + (Math.random() - 0.5) * 20 + 'px';
      card.style.top = tgtRect.top + tgtRect.height / 2 - 24 + (Math.random() - 0.5) * 10 + 'px';
      card.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg)`;
      card.style.opacity = '0.7';
    }, 20 + i * 80);

    setTimeout(() => {
      card.remove();
      completed++;
      if (completed === count && onDone) onDone();
    }, 420 + i * 80);
  }
}

// ─── Deal Animation ──────────────────────────────────────────────────

function animateDeal(state) {
  if (!state.players) return;
  const totalCards = state.players.reduce((sum, p) => sum + (p.handSize || 0), 0);
  if (totalCards === 0) return;

  const playerCount = state.players.length;
  const cardsPerPlayer = [];
  state.players.forEach(p => cardsPerPlayer.push(p.handSize || 0));

  const dealOrder = [];
  let maxCards = Math.max(...cardsPerPlayer);
  for (let round = 0; round < maxCards; round++) {
    for (let p = 0; p < playerCount; p++) {
      if (round < cardsPerPlayer[p]) {
        dealOrder.push(p);
      }
    }
  }

  const stagger = 60;
  dealOrder.forEach((playerIdx, i) => {
    setTimeout(() => {
      const handEl = document.querySelector(`.player-hand[data-hand="${playerIdx}"]`);
      const infoEl = document.querySelector(`.player-info[data-player="${playerIdx}"]`);
      const targetEl = handEl || infoEl;
      if (targetEl) {
        animateCardsToTarget(pileDisplay, targetEl, 1);
        SoundFX.cardFlick();
      }
    }, i * stagger);
  });
}

// ─── Phoenix Wright Objection System ─────────────────────────────────

const OBJECTION_WORDS = ['OBJECTION!', 'BULLSHIT!', 'HOLD IT!', 'LIAR!'];
const VERDICT_CORRECT = ['GOTCHA!', 'BUSTED!', 'GUILTY!', 'CAUGHT!'];
const VERDICT_WRONG = ['OVERRULED!', 'WRONG!', 'INNOCENT!', 'OOPS!'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function createSpeedLines(color) {
  const lines = [];
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * 360;
    const x1 = 50 + Math.cos(angle * Math.PI / 180) * 15;
    const y1 = 50 + Math.sin(angle * Math.PI / 180) * 15;
    const x2 = 50 + Math.cos(angle * Math.PI / 180) * 55;
    const y2 = 50 + Math.sin(angle * Math.PI / 180) * 55;
    lines.push(`<line x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" stroke="${color}" stroke-width="2" opacity="${0.15 + Math.random() * 0.2}"/>`);
  }
  return `<svg class="objection-lines" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`;
}

function showObjection(text, cssClass, whoName, lineColor) {
  const overlay = document.createElement('div');
  overlay.className = 'objection-overlay';

  overlay.innerHTML = `
    <div class="objection-bg"></div>
    ${createSpeedLines(lineColor)}
    <div class="objection-banner">
      <div class="objection-who">${whoName}</div>
      <div class="objection-text ${cssClass}">${text}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Screen shake
  document.querySelector('.game-container').classList.add('screen-shake');
  setTimeout(() => document.querySelector('.game-container').classList.remove('screen-shake'), 300);

  // Fade out and remove — hold longer for dramatic effect
  setTimeout(() => {
    overlay.classList.add('fading');
    setTimeout(() => overlay.remove(), 500);
  }, 2400);
}

function showChallengeCallout(challengerEl, isCorrect) {
  // Get challenger name from the column
  const col = challengerEl?.closest?.('.player-column') || challengerEl;
  const nameEl = col?.querySelector?.('.player-name');
  const who = nameEl?.textContent || '???';

  showObjection(pick(OBJECTION_WORDS), 'obj-call', who, 'rgba(255,68,68,0.4)');

  setTimeout(() => {
    if (isCorrect) {
      SoundFX.challengeCorrect();
      showObjection(pick(VERDICT_CORRECT), 'obj-correct', 'the cards reveal...', 'rgba(68,255,170,0.4)');
    } else {
      SoundFX.challengeWrong();
      showObjection(pick(VERDICT_WRONG), 'obj-wrong', 'the cards reveal...', 'rgba(255,170,68,0.4)');
    }
  }, 2900);
}

// ─── App State & Constants ───────────────────────────────────────────

const API_BASE = 'http://localhost:3001/api';

let currentGameId = null;
let autoPlayAbort = null;
let isAutoPlaying = false;
let previousState = null;
let _activeVoiceIndex = 0;

// DOM Elements
const newGameBtn = document.getElementById('new-game-btn');
const autoPlayBtn = document.getElementById('auto-play-btn');
const stepBtn = document.getElementById('step-btn');
const experimentSelect = document.getElementById('experiment-select');
const thoughtLog = document.getElementById('thought-log');
const pileDisplay = document.getElementById('pile-display');
const pendingDisplay = document.getElementById('pending-display');
const currentRankDisplay = document.getElementById('current-rank');
const gamePhaseDisplay = document.getElementById('game-phase');
const winnerOverlay = document.getElementById('winner-overlay');
const winnerName = document.getElementById('winner-name');
const thoughtModal = document.getElementById('thought-modal');
const logToggleBtn = document.getElementById('log-toggle-btn');
const logCloseBtn = document.getElementById('log-close-btn');
const roundNumberDisplay = document.getElementById('round-number');
const turnQueueDisplay = document.getElementById('turn-queue');

// ─── Theme Application ──────────────────────────────────────────────

function applyModelThemes(players, currentPlayerIndex = 0) {
  const cacheBust = Date.now();
  
  // Determine which player is in the active column
  const activePlayerIdx = currentPlayerIndex !== undefined ? currentPlayerIndex : 0;
  
  // Apply to active column (current player)
  if (players[activePlayerIdx]) {
    const player = players[activePlayerIdx];
    const charEl = document.getElementById('char-active');
    if (charEl) {
      const imageHtml = window.ModelThemes.getCharacterImage(player.modelId, 'default', cacheBust);
      if (imageHtml) {
        charEl.innerHTML = imageHtml;
      }
    }
    const titleEl = document.getElementById('title-active');
    if (titleEl) {
      const theme = window.ModelThemes.getTheme(player.modelId);
      titleEl.textContent = theme.title;
      titleEl.style.color = '#000000';
    }
  }
  
  // Apply to other-players columns (0, 1, 2) - all players except current
  let otherIndex = 0;
  for (let i = 0; i < players.length; i++) {
    if (i === activePlayerIdx) continue;
    if (otherIndex >= 3) break;
    
    const player = players[i];
    const charEl = document.getElementById(`char-${otherIndex}`);
    if (charEl) {
      const imageHtml = window.ModelThemes.getCharacterImage(player.modelId, 'default', cacheBust);
      if (imageHtml) {
        charEl.innerHTML = imageHtml;
      }
    }
    const titleEl = document.getElementById(`title-${otherIndex}`);
    if (titleEl) {
      const theme = window.ModelThemes.getTheme(player.modelId);
      titleEl.textContent = theme.title;
      titleEl.style.color = '#000000';
    }
    otherIndex++;
  }
}

// ─── Active Player Swap ────────────────────────────────────────────

function swapActivePlayer(state) {
  const currentPlayerIndex = state.currentPlayerIndex;
  const players = state.players;
  if (!players || players.length < 4) return;
  
  const cacheBust = Date.now();
  
  // Get current player (who should be in active column)
  const currentPlayer = players[currentPlayerIndex];
  if (!currentPlayer) return;
  
  // Move current player to active column
  const activeColumn = document.querySelector('.player-column.active-column');
  if (activeColumn) {
    const activeCharEl = activeColumn.querySelector('.character-image');
    const activeTitleEl = activeColumn.querySelector('.character-title');
    const activeInfoEl = activeColumn.querySelector('.player-info');
    const activeHandEl = activeColumn.querySelector('.player-hand');
    
    if (activeCharEl) {
      activeCharEl.id = 'char-active';
      activeCharEl.innerHTML = window.ModelThemes.getCharacterImage(currentPlayer.modelId, 'default', cacheBust) || '';
    }
    if (activeTitleEl) {
      activeTitleEl.id = 'title-active';
      const theme = window.ModelThemes.getTheme(currentPlayer.modelId);
      activeTitleEl.textContent = theme.title;
      activeTitleEl.style.color = '#000000';
    }
    if (activeInfoEl) {
      activeInfoEl.dataset.player = 'active';
    }
    if (activeHandEl) {
      activeHandEl.dataset.hand = 'active';
    }
    
    // Copy player info
    if (activeInfoEl) {
      activeInfoEl.querySelector('.player-name').textContent = shortenModelName(currentPlayer.modelId);
      activeInfoEl.querySelector('.card-count span').textContent = currentPlayer.handSize;
    }
  }
  
  // Move other 3 players to the stack
  let otherIndex = 0;
  for (let i = 0; i < players.length; i++) {
    if (i === currentPlayerIndex) continue;
    if (otherIndex >= 3) break;
    
    const player = players[i];
    const column = document.querySelector(`.other-players-column .player-column[data-column="${otherIndex}"]`);
    if (!column) continue;
    
    const charEl = column.querySelector('.character-image');
    const titleEl = column.querySelector('.character-title');
    const infoEl = column.querySelector('.player-info');
    const handEl = column.querySelector('.player-hand');
    
    if (charEl) {
      charEl.id = `char-${otherIndex}`;
      charEl.innerHTML = window.ModelThemes.getCharacterImage(player.modelId, 'default', cacheBust) || '';
    }
    if (titleEl) {
      titleEl.id = `title-${otherIndex}`;
      const theme = window.ModelThemes.getTheme(player.modelId);
      titleEl.textContent = theme.title;
      titleEl.style.color = '#000000';
    }
    if (infoEl) {
      infoEl.dataset.player = otherIndex;
      infoEl.querySelector('.player-name').textContent = shortenModelName(player.modelId);
      infoEl.querySelector('.card-count span').textContent = player.handSize;
    }
    if (handEl) {
      handEl.dataset.hand = otherIndex;
    }
    
    otherIndex++;
  }
}

function clearColumnStates() {
  document.querySelectorAll('.player-column').forEach(col => {
    col.classList.remove('is-thinking', 'is-challenging', 'is-winner', 'is-eliminated', 'is-accused', 'is-challenger');
  });
}

function updateCharacterImage(playerIndex, player, state) {
  // Handle 'active' column (current player in large column)
  if (playerIndex === 'active') {
    const charEl = document.getElementById('char-active');
    if (!charEl) return;
    
    const modelId = player.modelId;
    const cacheBust = Date.now();
    
    let imageState = 'default';
    const isWinner = state.winner === player.id;
    const isThinking = player.id === state.thinkingPlayerId;
    
    if (isWinner) {
      imageState = 'win';
    } else if (player.isEliminated) {
      imageState = 'lose';
    } else if (state.phase === 'challenging' && state.pendingTurn) {
      // During challenge phase, the active player (who just played) is being judged
      // The thinking player (challenger) is deciding whether to call BS
      const isChallenger = player.id === state.thinkingPlayerId;
      
      if (isChallenger) {
        imageState = 'thinking'; // challenger deciding to call BS
      } else {
        imageState = 'judged'; // the player whose play is being judged
      }
    } else if (isThinking) {
      imageState = 'judging'; // thinking about what to play
    }
    
    const imageHtml = window.ModelThemes.getCharacterImage(modelId, imageState, cacheBust);
    if (imageHtml) {
      charEl.innerHTML = imageHtml;
    }
    return;
  }
  
  const charEl = document.getElementById(`char-${playerIndex}`);
  if (!charEl) return;

  const modelId = player.modelId;
  const cacheBust = Date.now();
  
  let imageState = 'default';
  
  const isWinner = state.winner === player.id;
  const isThinking = player.id === state.thinkingPlayerId;
  
  if (isWinner) {
    imageState = 'win';
  } else if (player.isEliminated) {
    imageState = 'lose';
  } else if (state.phase === 'challenging' && state.pendingTurn) {
    const accusedPlayerId = state.pendingTurn.playerId;
    const thinkingPlayerId = state.thinkingPlayerId;
    
    if (player.id === accusedPlayerId) {
      imageState = 'judged';
    } else if (player.id === thinkingPlayerId) {
      imageState = 'thinking'; // this player is the challenger
    } else {
      imageState = 'default';
    }
  } else if (isThinking) {
    imageState = 'judging';
  }
  
  const imageHtml = window.ModelThemes.getCharacterImage(modelId, imageState, cacheBust);
  if (imageHtml) {
    charEl.innerHTML = imageHtml;
  }
}

function clearJudgingIndicators() {
  document.querySelectorAll('.judging-indicator').forEach(el => {
    el.classList.remove('visible');
  });
}

function showJudgingIndicator(playerIndex, type) {
  const indicatorId = type === 'accused' ? `judging-${playerIndex}` : `judging-challenger-${playerIndex}`;
  const indicator = document.getElementById(indicatorId);
  if (indicator) {
    indicator.classList.add('visible');
  }
  
  const column = document.querySelector(`.player-column[data-column="${playerIndex}"]`);
  if (column) {
    column.classList.add(type === 'accused' ? 'is-accused' : 'is-challenger');
  }
}

// ─── Speech Bubble System ────────────────────────────────────────────

function showSpeechBubble(playerIndex, text, type = 'default', duration = 3000) {
  const speechEl = document.getElementById(`speech-${playerIndex}`);
  if (!speechEl) return;
  
  const contentEl = speechEl.querySelector('.speech-content');
  contentEl.textContent = text;
  
  speechEl.className = 'speech-bubble visible';
  if (type === 'challenge') {
    speechEl.classList.add('challenge-bubble');
  } else if (type === 'play') {
    speechEl.classList.add('play-bubble');
  }
  
  // Clear any existing timeout
  if (speechEl._timeout) {
    clearTimeout(speechEl._timeout);
  }
  
  // Auto-hide after duration
  speechEl._timeout = setTimeout(() => {
    speechEl.classList.remove('visible');
  }, duration);
}

function hideAllSpeechBubbles() {
  document.querySelectorAll('.speech-bubble').forEach(el => {
    el.classList.remove('visible');
  });
}

// ─── Round Counter ───────────────────────────────────────────────────

function updateRoundCounter(turnNumber) {
  if (roundNumberDisplay) {
    roundNumberDisplay.textContent = turnNumber || 1;
    
    // Add a quick animation effect
    roundNumberDisplay.style.transform = 'scale(1.3)';
    setTimeout(() => {
      roundNumberDisplay.style.transform = 'scale(1)';
    }, 200);
  }
}

// ─── Turn Order Timeline ─────────────────────────────────────────────

function updateTurnQueue(state) {
  if (!turnQueueDisplay || !state.players) return;
  
  const currentPlayerIndex = state.currentPlayerIndex;
  const players = state.players;
  const isChallengePhase = state.phase === 'challenging';
  const thinkingPlayerId = state.thinkingPlayerId;
  
  // Determine who is "current" based on phase
  // During challenge phase, the challenger is being queried, so they're "current"
  // During waiting/playing phase, the currentPlayerIndex is "current"
  let currentIndex = currentPlayerIndex;
  if (isChallengePhase && thinkingPlayerId) {
    const thinkingIndex = players.findIndex(p => p.id === thinkingPlayerId);
    if (thinkingIndex >= 0) {
      currentIndex = thinkingIndex;
    }
  }
  
  // Build queue: current + next 3 players (skipping eliminated)
  const queue = [];
  let idx = currentIndex;
  
  for (let i = 0; i < Math.min(4, players.length); i++) {
    // Find next non-eliminated player
    let attempts = 0;
    while (attempts < players.length) {
      const player = players[idx];
      if (!player.isEliminated) {
        queue.push({
          playerIndex: idx,
          player: player,
          isCurrent: i === 0,
          isChallenge: isChallengePhase && i === 0
        });
        idx = (idx + 1) % players.length;
        break;
      }
      idx = (idx + 1) % players.length;
      attempts++;
    }
    if (attempts >= players.length) break;
  }
  
  // Render queue
  turnQueueDisplay.innerHTML = queue.map((item, i) => {
    const name = shortenModelName(item.player.modelId);
    const thumbnail = window.ModelThemes.getThumbnail(item.player.modelId);
    const isLast = i === queue.length - 1;
    const challengeIndicator = item.isChallenge ? ' 🔍' : '';
    
    return `
      <div class="turn-queue-item ${item.isCurrent ? 'current' : 'upcoming'}" title="${item.isChallenge ? 'Deciding whether to challenge' : (item.isCurrent ? 'Current turn' : 'Upcoming')}">
        <img class="turn-queue-avatar" src="${thumbnail}" alt="${name}" />
        <div class="turn-queue-name">${name}${challengeIndicator}</div>
      </div>
      ${!isLast ? '<div class="turn-queue-arrow">→</div>' : ''}
    `;
  }).join('');
}

// Helpers
function shortenModelName(name) {
  if (!name) return '???';
  const parts = name.split('/');
  const full = parts[parts.length - 1];
  return full.length > 16 ? full.substring(0, 14) + '…' : full;
}

function createCardElement(cardStr, showFace = true) {
  const div = document.createElement('div');
  div.className = 'card-mini';
  div.innerHTML = showFace
    ? window.CardRenderer.getCardSVG(cardStr)
    : window.CardRenderer.getCardBackSVG();
  return div;
}

// Initialize game
newGameBtn.addEventListener('click', startNewGame);
autoPlayBtn.addEventListener('click', toggleAutoPlay);
stepBtn.addEventListener('click', stepGame);

// Log drawer toggle
logToggleBtn.addEventListener('click', () => {
  thoughtModal.classList.toggle('drawer-hidden');
});
logCloseBtn.addEventListener('click', () => {
  thoughtModal.classList.add('drawer-hidden');
});

async function startNewGame() {
  const experimentId = parseInt(experimentSelect.value);

  try {
    newGameBtn.disabled = true;
    previousState = null;

    const response = await fetch(`${API_BASE}/game/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experimentId })
    });

    const data = await response.json();
    currentGameId = data.gameId;

    autoPlayBtn.disabled = false;
    stepBtn.disabled = false;

    thoughtLog.innerHTML = '<div class="empty-thought">game started — click step or auto to begin...</div>';

    // Apply visual themes to columns based on which models are playing
    if (data.players) {
      applyModelThemes(data.players, data.currentPlayerIndex);
    }

    // Initialize round counter and turn queue
    if (roundNumberDisplay) {
      roundNumberDisplay.textContent = '1';
    }
    updateTurnQueue(data);

    // Render state and animate deal
    renderGameState(data);
    animateDeal(data);

  } catch (error) {
    console.error('Failed to start game:', error);
    newGameBtn.disabled = false;
  }
}

async function stepGame() {
  if (!currentGameId) return;

  try {
    stepBtn.disabled = true;

    const response = await fetch(`${API_BASE}/game/${currentGameId}/step?stream=1`, {
      method: 'POST'
    });

    if (response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
      await consumeSSEStream(response);
    } else {
      const data = await response.json();
      if (data.error) { logError(data.error, data.details); stepBtn.disabled = false; return; }
      if (data.stepInProgress) { stepBtn.disabled = false; return; }
      renderGameState(data);
    }

    if (previousState?.phase !== 'finished') {
      stepBtn.disabled = false;
    }

  } catch (error) {
    console.error('Step failed:', error);
    logError('Network error', error.message);
    stepBtn.disabled = false;
  }
}

function toggleAutoPlay() {
  if (isAutoPlaying) {
    stopAutoPlay();
  } else {
    startAutoPlay();
  }
}

async function startAutoPlay() {
  isAutoPlaying = true;
  autoPlayAbort = new AbortController();
  const autoLabel = autoPlayBtn.querySelector('span');
  if (autoLabel) autoLabel.textContent = 'stop';
  stepBtn.disabled = true;

  const signal = autoPlayAbort.signal;
  let consecutiveErrors = 0;

  while (isAutoPlaying && currentGameId) {
    try {
      const response = await fetch(`${API_BASE}/game/${currentGameId}/step?stream=1`, {
        method: 'POST',
        signal
      });

      if (!isAutoPlaying) break;

      if (response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
        await consumeSSEStream(response);
        consecutiveErrors = 0;
      } else {
        const data = await response.json();

        if (data.stepInProgress) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        if (data.error) {
          consecutiveErrors++;
          // Check if adapter was reset and provide better message
          if (data.resetAdapter) {
            logError('API connection reset', 'Connection was unstable and has been reset. Retrying...');
            // Give the adapter a moment to stabilize
            await new Promise(r => setTimeout(r, 5000));
          } else {
            logError(`API error (attempt ${consecutiveErrors})`, data.details || data.error);
          }
          if (consecutiveErrors >= 5) { logError('Giving up', 'Too many consecutive errors'); break; }
          if (!data.resetAdapter) {
            await new Promise(r => setTimeout(r, 3000 * consecutiveErrors));
          }
          continue;
        }

        consecutiveErrors = 0;
        renderGameState(data);
      }

      if (previousState?.phase === 'finished') break;

      await new Promise(r => setTimeout(r, 600));
    } catch (error) {
      if (error.name === 'AbortError') break;
      consecutiveErrors++;
      console.error(`Auto step failed (${consecutiveErrors}):`, error);
      if (consecutiveErrors >= 5) { logError('Giving up', 'Too many network errors'); break; }
      logError(`Network error (attempt ${consecutiveErrors})`, error.message);
      await new Promise(r => setTimeout(r, 3000 * consecutiveErrors));
    }
  }

  stopAutoPlay();
}

function stopAutoPlay() {
  isAutoPlaying = false;
  const autoLabel2 = autoPlayBtn.querySelector('span');
  if (autoLabel2) autoLabel2.textContent = 'auto';
  stepBtn.disabled = false;

  if (autoPlayAbort) {
    autoPlayAbort.abort();
    autoPlayAbort = null;
  }
}

// ─── SSE Stream Handling ──────────────────────────────────────────────

async function consumeSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      let eventType = null;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event: ')) {
          eventType = trimmed.slice(7);
        } else if (trimmed.startsWith('data: ') && eventType) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            handleSSEEvent(eventType, data);
          } catch (e) {
            console.warn('SSE parse error:', trimmed);
          }
          eventType = null;
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
    throw error;
  }
}

function handleSSEEvent(eventType, data) {
  switch (eventType) {
    case 'thinking': {
      const playerIndex = previousState?.players?.findIndex(p => p.id === data.playerId);
      const currentPlayerIndex = previousState?.currentPlayerIndex;
      
      if (playerIndex != null && playerIndex >= 0) {
        clearStreamText();
        _activeVoiceIndex = playerIndex;
        
        // Clear this player's action display for fresh thinking
        const actionId = (playerIndex === currentPlayerIndex) ? 'action-active' : `action-${playerIndex}`;
        const actionEl = document.getElementById(actionId);
        if (actionEl) actionEl.innerHTML = '';

        // Use stream-active for current player, otherwise use indexed stream
        const streamId = (playerIndex === currentPlayerIndex) ? 'stream-active' : `stream-${playerIndex}`;
        const streamEl = document.getElementById(streamId);
        if (streamEl) {
          streamEl.textContent = '';
          streamEl.classList.add('active');
        }
      }
      break;
    }
    case 'token': {
      const activeStream = document.querySelector('.stream-text.active');
      if (activeStream) {
        activeStream.textContent += data.text;
        activeStream.scrollTop = activeStream.scrollHeight;
        SoundFX.textBlip(_activeVoiceIndex);
      }
      break;
    }
    case 'complete': {
      clearStreamText();
      renderGameState(data);
      break;
    }
    case 'error': {
      clearStreamText();
      logError(data.error || 'Stream error', data.details);
      break;
    }
    case 'blocked': {
      console.log('Step already in progress');
      break;
    }
  }
}

function clearStreamText() {
  document.querySelectorAll('.stream-text').forEach(el => {
    el.classList.remove('active');
    setTimeout(() => {
      if (!el.classList.contains('active')) el.textContent = '';
    }, 300);
  });
}

// ─── Structured Action Display ────────────────────────────────

function clearAllActions() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`action-${i}`);
    if (el) el.innerHTML = '';
  }
}

function showPlayAction(playerIndex, claimedCount, claimedRank, reasoning) {
  const el = document.getElementById(`action-${playerIndex}`);
  if (!el) return;

  let html = `<div class="action-claim"><span class="claim-count">${claimedCount}×</span> <span class="claim-rank">${claimedRank}</span></div>`;
  if (reasoning && reasoning !== 'No reasoning provided') {
    const clean = cleanReasoning(reasoning);
    if (clean) html += `<div class="action-reasoning">${clean}</div>`;
  }
  el.innerHTML = html;
}

function showChallengeAction(playerIndex, challenged, reasoning) {
  const el = document.getElementById(`action-${playerIndex}`);
  if (!el) return;

  if (challenged) {
    let html = `<div class="action-verdict verdict-challenge">calls BS!</div>`;
    if (reasoning) {
      const clean = cleanReasoning(reasoning);
      if (clean) html += `<div class="action-reasoning">${clean}</div>`;
    }
    el.innerHTML = html;
  } else {
    el.innerHTML = `<div class="action-verdict verdict-pass">pass</div>`;
  }
}

function cleanReasoning(text) {
  if (!text) return '';
  // Strip [think]...[answer] wrapper if present
  let clean = text.replace(/^\[think\][\s\S]*?\[answer\]\s*/i, '');
  // Strip any remaining JSON-like content
  clean = clean.replace(/\{[\s\S]*\}/g, '').trim();
  // Strip <think> tags
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Truncate
  if (clean.length > 120) clean = clean.substring(0, 117) + '...';
  return clean;
}

function logError(title, detail) {
  const entry = document.createElement('div');
  entry.className = 'turn-entry';
  entry.innerHTML = `<div class="turn-line" style="color: #ff6b6b;">x ${title}</div>` +
    (detail ? `<div class="turn-thought" style="color: #ff6b6b;">${detail}</div>` : '');
  thoughtLog.insertBefore(entry, thoughtLog.firstChild);
  gamePhaseDisplay.textContent = 'error — check log';
}

// ─── Render Game State ───────────────────────────────────────────────

function renderGameState(state) {
  // Diff previous state to detect events
  // Use totalTurns if available (server limits turns sent for performance)
  const prevTurnCount = previousState?.totalTurns || previousState?.turns?.length || 0;
  const newTurnCount = state.totalTurns || state.turns?.length || 0;
  const turnsArray = state.turns || [];
  const newTurn = newTurnCount > prevTurnCount ? turnsArray[turnsArray.length - 1] : null;

  const hadPending = previousState?.pendingTurn != null;
  const hasPending = state.pendingTurn != null;
  const pendingJustAppeared = !hadPending && hasPending;
  const pendingJustResolved = hadPending && !hasPending && newTurn;

  let activePlayerIndex = null;
  const playerId = newTurn?.playerId || state.pendingTurn?.playerId;
  if (playerId) {
    activePlayerIndex = state.players.findIndex(p => p.id === playerId);
  }

  // Swap active player to large column
  if (activePlayerIndex !== null && activePlayerIndex >= 0) {
    swapActivePlayer(state);
    
    // Render cards for active player
    const activeHandEl = document.querySelector('.player-hand[data-hand="active"]');
    const currentPlayer = state.players[activePlayerIndex];
    if (activeHandEl && currentPlayer && currentPlayer.hand) {
      activeHandEl.innerHTML = '';
      currentPlayer.hand.forEach(cardStr => {
        activeHandEl.appendChild(createCardElement(cardStr, true));
      });
    }
    
    // Update character image for active player
    updateCharacterImage('active', currentPlayer, state);
  }

  // Update round counter - use totalTurns if available (server sends limited turns for performance)
  const currentTurnNumber = state.totalTurns || state.turns?.length || 0;
  const prevTurnNumber = previousState?.totalTurns || previousState?.turns?.length || 0;
  if (currentTurnNumber > 0 && (!previousState || prevTurnNumber !== currentTurnNumber)) {
    updateRoundCounter(currentTurnNumber + 1);
  }

  // Update turn order timeline
  updateTurnQueue(state);

  // Show structured play/challenge actions in player columns
  if (pendingJustAppeared && state.pendingTurn) {
    clearAllActions();
    hideAllSpeechBubbles();
    if (activePlayerIndex !== null && activePlayerIndex >= 0) {
      showPlayAction(activePlayerIndex, state.pendingTurn.claimedCount, state.pendingTurn.claimedRank, state.pendingTurn.reasoning);
      // Show speech bubble for play
      const claimText = `Playing ${state.pendingTurn.claimedCount} ${state.pendingTurn.claimedRank}'s`;
      showSpeechBubble(activePlayerIndex, claimText, 'play');
    }
  }

  if (pendingJustResolved && newTurn) {
    // Show the play on the player's column
    const playerIdx = state.players.findIndex(p => p.id === newTurn.playerId);
    if (playerIdx >= 0) {
      showPlayAction(playerIdx, newTurn.claimedCount, newTurn.claimedRank, newTurn.reasoning);
    }
    // Show challenge result if it happened
    if (newTurn.challenged) {
      const challengerIdx = state.players.findIndex(p => p.id === newTurn.challengerId);
      if (challengerIdx >= 0) {
        showChallengeAction(challengerIdx, true, newTurn.challengeReasoning);
        // Show speech bubble for challenge
        showSpeechBubble(challengerIdx, "I call BS!", 'challenge');
      }
    }
  }

  // Sound effects + BS callouts
  if (pendingJustAppeared) {
    SoundFX.playCard();
    if (activePlayerIndex !== null && activePlayerIndex >= 0) {
      const handEl = document.querySelector(`.player-hand[data-hand="${activePlayerIndex}"]`);
      const infoEl = document.querySelector(`.player-info[data-player="${activePlayerIndex}"]`);
      const sourceEl = handEl && handEl.children.length > 0 ? handEl : infoEl;
      const cardCount = state.pendingTurn.actualCards?.length || state.pendingTurn.claimedCount || 1;
      animateCardsToTarget(sourceEl, pendingDisplay, cardCount);
    }
  }

  if (pendingJustResolved) {
    if (newTurn.challenged) {
      SoundFX.challenge();
      const challengerIndex = state.players.findIndex(p => p.id === newTurn.challengerId);
      // Use the column element for callout positioning
      const challengerCol = document.querySelector(`.player-column[data-column="${challengerIndex}"]`);
      showChallengeCallout(challengerCol, newTurn.challengeCorrect);
      flipPendingCards(newTurn, state);
    } else {
      flipPendingCards(newTurn, state);
    }
  }

  if (state.winner && state.phase === 'finished' && !previousState?.winner) {
    setTimeout(() => SoundFX.win(), 300);
  }

  // Update column states
  clearColumnStates();
  clearJudgingIndicators();
  const thinkingId = state.thinkingPlayerId || null;
  
  // Determine judging state during challenge phase
  let accusedPlayerIndex = null;
  let challengerPlayerIndex = null;
  
  if (state.phase === 'challenging' && state.pendingTurn) {
    // The player who just played is being judged
    accusedPlayerIndex = state.players.findIndex(p => p.id === state.pendingTurn.playerId);
  }
  
  if (state.phase === 'challenging' && thinkingId) {
    // The thinking player is the challenger
    challengerPlayerIndex = state.players.findIndex(p => p.id === thinkingId);
  }

  state.players.forEach((player, i) => {
    const infoEl = document.querySelector(`.player-info[data-player="${i}"]`);
    const handEl = document.querySelector(`.player-hand[data-hand="${i}"]`);
    const column = document.querySelector(`.player-column[data-column="${i}"]`);

    if (infoEl) {
      infoEl.querySelector('.player-name').textContent = shortenModelName(player.modelId);
      infoEl.querySelector('.card-count span').textContent = player.handSize;

      const isThinking = player.id === thinkingId;
      const isChallengePhase = state.phase === 'challenging';
      const isWinner = state.winner === player.id;
      const isAccused = i === accusedPlayerIndex;
      const isChallenger = i === challengerPlayerIndex;

      infoEl.classList.toggle('active', player.isActive && !isThinking && !isChallengePhase);
      infoEl.classList.toggle('thinking', isThinking && !isChallengePhase);
      infoEl.classList.toggle('challenging', isThinking && isChallengePhase);
      infoEl.classList.toggle('winner', isWinner);

      // Column-level state classes
      if (column) {
        column.classList.toggle('is-thinking', isThinking && !isChallengePhase);
        column.classList.toggle('is-challenging', isThinking && isChallengePhase);
        column.classList.toggle('is-winner', isWinner);
        column.classList.toggle('is-accused', isAccused);
        column.classList.toggle('is-challenger', isChallenger);
      }

      // Update character image based on state
      updateCharacterImage(i, player, state);
      
      // Show judging indicators
      if (isAccused && isChallengePhase) {
        showJudgingIndicator(i, 'accused');
      }
      if (isChallenger && isChallengePhase) {
        showJudgingIndicator(i, 'challenger');
      }

      // Status label
      const statusEl = infoEl.querySelector('.player-status');
      if (statusEl) {
        if (isWinner) {
          statusEl.textContent = 'winner';
          statusEl.className = 'player-status';
          statusEl.style.color = 'var(--mint)';
        } else if (isChallenger && isChallengePhase) {
          statusEl.textContent = 'judging...';
          statusEl.className = 'player-status status-challenging';
          statusEl.style.color = '';
        } else if (isAccused && isChallengePhase) {
          statusEl.textContent = 'being judged!';
          statusEl.className = 'player-status';
          statusEl.style.color = 'var(--pink)';
        } else if (isThinking && !isChallengePhase) {
          statusEl.textContent = 'thinking...';
          statusEl.className = 'player-status status-thinking';
          statusEl.style.color = '';
        } else if (player.isActive && isChallengePhase) {
          statusEl.textContent = 'awaiting verdict';
          statusEl.className = 'player-status status-challenging';
          statusEl.style.color = '';
        } else {
          statusEl.textContent = '';
          statusEl.className = 'player-status';
          statusEl.style.color = '';
        }
      }
    }

    if (handEl) {
      handEl.innerHTML = '';
      if (player.hand && player.hand.length > 0) {
        player.hand.forEach(cardStr => {
          handEl.appendChild(createCardElement(cardStr, true));
        });
      }
    }
  });

  // Update pile
  pileDisplay.innerHTML = '';
  const pileSize = state.pileSize || 0;
  const cardsToShow = Math.min(pileSize, 3);
  for (let i = 0; i < cardsToShow; i++) {
    pileDisplay.appendChild(createCardElement('back', false));
  }
  document.querySelector('.pile-count').textContent = pileSize;

  // Update pending cards
  if (hasPending && !pendingJustResolved) {
    renderPendingCards(state.pendingTurn);
  } else if (!hasPending) {
    if (!pendingJustResolved) {
      pendingDisplay.innerHTML = '';
    }
  }

  if (pendingJustAppeared && state.pendingTurn) {
    renderPendingTurnLog(state.pendingTurn, state.players);
  }

  // Update current rank
  currentRankDisplay.textContent = state.currentRank || 'A';

  // Update phase display with clearer messaging
  if (state.phase === 'finished') {
    gamePhaseDisplay.innerHTML = 'game over';
  } else if (state.phase === 'waiting' && thinkingId) {
    const thinkingPlayer = state.players.find(p => p.id === thinkingId);
    const name = shortenModelName(thinkingPlayer?.modelId);
    gamePhaseDisplay.innerHTML = `<span class="phase-model">${name}</span><span class="phase-action">is playing...</span>`;
  } else if (state.phase === 'challenging' && thinkingId && state.pendingTurn) {
    const thinkingPlayer = state.players.find(p => p.id === thinkingId);
    const accusedPlayer = state.players.find(p => p.id === state.pendingTurn.playerId);
    const challengerName = shortenModelName(thinkingPlayer?.modelId);
    const accusedName = shortenModelName(accusedPlayer?.modelId);
    gamePhaseDisplay.innerHTML = `<span class="phase-model">${challengerName}</span><span class="phase-action">judging ${accusedName}'s play...</span>`;
  } else if (state.phase === 'challenging') {
    gamePhaseDisplay.innerHTML = 'challenge phase...';
  } else {
    gamePhaseDisplay.innerHTML = 'waiting for play...';
  }

  // Update turn log
  if (state.turns && state.turns.length > 0) {
    renderTurnLog(state.turns, state.players);
  }

  // Handle winner
  if (state.winner && state.phase === 'finished') {
    const winner = state.players.find(p => p.id === state.winner);
    showWinner(winner);
  }

  previousState = JSON.parse(JSON.stringify(state));
}

// ─── Pending Cards ───────────────────────────────────────────────────

function renderPendingCards(pendingTurn) {
  if (!pendingTurn) {
    pendingDisplay.innerHTML = '';
    return;
  }

  if (pendingDisplay.children.length > 0) return;

  const cardCount = pendingTurn.actualCards?.length || pendingTurn.claimedCount || 1;
  const actualCards = pendingTurn.actualCards || [];

  for (let i = 0; i < cardCount; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'pending-card-wrapper';

    const inner = document.createElement('div');
    inner.className = 'pending-card-inner';

    const back = document.createElement('div');
    back.className = 'pending-card-back';
    back.innerHTML = window.CardRenderer.getCardBackSVG();

    const front = document.createElement('div');
    front.className = 'pending-card-front';
    if (actualCards[i]) {
      const cardStr = actualCards[i].rank + actualCards[i].suit;
      front.innerHTML = window.CardRenderer.getCardSVG(cardStr);
    } else {
      front.innerHTML = window.CardRenderer.getCardBackSVG();
    }

    inner.appendChild(back);
    inner.appendChild(front);
    wrapper.appendChild(inner);
    pendingDisplay.appendChild(wrapper);
  }
}

function renderPendingTurnLog(pendingTurn, players) {
  const player = players.find(p => p.id === pendingTurn.playerId);
  const playerName = shortenModelName(player?.modelId);
  const num = '?';

  const entry = document.createElement('div');
  entry.className = 'turn-entry pending-entry';
  entry.dataset.pendingPlayerId = pendingTurn.playerId;

  let html = `<div class="turn-line"><span class="turn-number">#${num}</span>  <span class="turn-player">${playerName}</span>  <span class="turn-action">→ ${pendingTurn.claimedCount}× ${pendingTurn.claimedRank}</span>  <span class="badge-pending">awaiting...</span></div>`;

  if (pendingTurn.reasoning && pendingTurn.reasoning !== 'No reasoning provided') {
    const shortened = pendingTurn.reasoning.length > 120
      ? pendingTurn.reasoning.substring(0, 117) + '...'
      : pendingTurn.reasoning;
    html += `<div class="turn-thought">"${shortened}"</div>`;
  }

  entry.innerHTML = html;
  thoughtLog.insertBefore(entry, thoughtLog.firstChild);
}

function flipPendingCards(resolvedTurn, state) {
  const cards = pendingDisplay.querySelectorAll('.pending-card-inner');
  if (cards.length === 0) {
    pendingDisplay.innerHTML = '';
    return;
  }

  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add('flipped'), i * 100);
  });

  const flipDuration = 500 + (cards.length - 1) * 100;

  setTimeout(() => {
    if (resolvedTurn.challenged) {
      const loserId = resolvedTurn.challengeCorrect ? resolvedTurn.playerId : resolvedTurn.challengerId;
      const loserIndex = state.players.findIndex(p => p.id === loserId);
      const loserHand = document.querySelector(`.player-hand[data-hand="${loserIndex}"]`);
      const loserInfo = document.querySelector(`.player-info[data-player="${loserIndex}"]`);
      const loserEl = loserHand || loserInfo;
      const totalCards = Math.min(cards.length + (previousState?.pileSize || 0), 6);
      animateCardsToTarget(pendingDisplay, loserEl, totalCards, () => {
        pendingDisplay.innerHTML = '';
      });
    } else {
      animateCardsToTarget(pendingDisplay, pileDisplay, cards.length, () => {
        pendingDisplay.innerHTML = '';
      });
    }
  }, flipDuration + 200);

  const pendingEntry = thoughtLog.querySelector('.pending-entry');
  if (pendingEntry) pendingEntry.remove();
}

// ─── Turn Log ────────────────────────────────────────────────────────

function renderTurnLog(turns, players) {
  const existingCount = thoughtLog.querySelectorAll('.turn-entry').length;

  if (existingCount === 0) {
    thoughtLog.innerHTML = '';
  }

  for (let i = existingCount; i < turns.length; i++) {
    const turn = turns[i];
    const player = players.find(p => p.id === turn.playerId);
    const playerName = shortenModelName(player?.modelId);

    const entry = document.createElement('div');
    entry.className = 'turn-entry';

    const num = turn.turnNumber || i + 1;
    const badge = turn.wasLie
      ? '<span class="badge-lie">lie</span>'
      : '<span class="badge-truth">truth</span>';

    let html = `<div class="turn-line"><span class="turn-number">#${num}</span>  <span class="turn-player">${playerName}</span>  <span class="turn-action">→ ${turn.claimedCount}× ${turn.claimedRank}</span>  ${badge}</div>`;

    if (turn.reasoning && turn.reasoning !== 'No reasoning provided') {
      const shortened = turn.reasoning.length > 120
        ? turn.reasoning.substring(0, 117) + '...'
        : turn.reasoning;
      html += `<div class="turn-thought">"${shortened}"</div>`;
    }

    if (turn.challenged) {
      const challenger = players.find(p => p.id === turn.challengerId);
      const challengerName = shortenModelName(challenger?.modelId);
      const resultClass = turn.challengeCorrect ? 'challenge-correct' : 'challenge-wrong';
      const resultText = turn.challengeCorrect ? 'caught it!' : 'wrong call!';
      html += `<div class="challenge-line ${resultClass}">${challengerName} called BS — ${resultText}</div>`;

      if (turn.challengeReasoning) {
        const shortened = turn.challengeReasoning.length > 120
          ? turn.challengeReasoning.substring(0, 117) + '...'
          : turn.challengeReasoning;
        html += `<div class="turn-thought">"${shortened}"</div>`;
      }
    }

    entry.innerHTML = html;
    thoughtLog.insertBefore(entry, thoughtLog.firstChild);
  }
}

function showWinner(player) {
  winnerName.textContent = shortenModelName(player?.modelId);
  winnerOverlay.style.display = 'flex';

  stopAutoPlay();
  autoPlayBtn.disabled = true;
  stepBtn.disabled = true;
  newGameBtn.disabled = false;
}

document.querySelector('.winner-overlay .btn').addEventListener('click', () => {
  winnerOverlay.style.display = 'none';
  currentGameId = null;
});
