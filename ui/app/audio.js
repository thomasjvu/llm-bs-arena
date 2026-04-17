function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createAudio({ enabled = true } = {}) {
  let context = null;
  let unlocked = false;
  let soundEnabled = enabled !== false;

  function getContext() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!context) {
      context = new AudioContextCtor();
    }
    return context;
  }

  async function unlock() {
    const audioContext = getContext();
    if (!audioContext) return false;

    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();

      unlocked = true;
      return true;
    } catch (_error) {
      return false;
    }
  }

  function isReady() {
    return Boolean(unlocked && soundEnabled && getContext());
  }

  function setEnabled(value) {
    soundEnabled = value !== false;
  }

  function playTone({
    frequency = 440,
    duration = 0.12,
    type = 'square',
    volume = 0.06,
    when = 0,
    attack = 0.01,
    release = 0.09,
    sweepTo = null,
  } = {}) {
    if (!isReady()) return;

    const audioContext = getContext();
    const now = audioContext.currentTime + when;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (Number.isFinite(sweepTo)) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(duration, attack + release));

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  function playPass(when = 0) {
    playTone({ frequency: 880, sweepTo: 1040, duration: 0.08, type: 'triangle', volume: 0.034, when, attack: 0.003, release: 0.035 });
    playTone({ frequency: 1180, sweepTo: 1320, duration: 0.06, type: 'sine', volume: 0.02, when: when + 0.018, attack: 0.002, release: 0.028 });
  }

  function playChallenge() {
    playTone({ frequency: 960, sweepTo: 720, duration: 0.11, type: 'square', volume: 0.074, attack: 0.002, release: 0.034 });
    playTone({ frequency: 1440, sweepTo: 980, duration: 0.095, type: 'triangle', volume: 0.046, when: 0.018, attack: 0.002, release: 0.03 });
    playTone({ frequency: 620, sweepTo: 430, duration: 0.13, type: 'sawtooth', volume: 0.03, when: 0.012, attack: 0.003, release: 0.04 });
  }

  function playResolution(kind = 'claim_stands') {
    if (kind === 'lie_exposed') {
      playTone({ frequency: 420, sweepTo: 220, duration: 0.2, type: 'square', volume: 0.07, attack: 0.003, release: 0.06 });
      playTone({ frequency: 620, sweepTo: 340, duration: 0.16, type: 'triangle', volume: 0.046, when: 0.016, attack: 0.002, release: 0.04 });
      playTone({ frequency: 180, sweepTo: 110, duration: 0.24, type: 'sawtooth', volume: 0.032, when: 0.05, attack: 0.003, release: 0.05 });
      return;
    }

    if (kind === 'false_challenge') {
      playTone({ frequency: 420, sweepTo: 620, duration: 0.12, type: 'triangle', volume: 0.05, attack: 0.002, release: 0.04 });
      playTone({ frequency: 660, sweepTo: 980, duration: 0.11, type: 'square', volume: 0.05, when: 0.02, attack: 0.002, release: 0.04 });
      playTone({ frequency: 980, sweepTo: 1260, duration: 0.09, type: 'sine', volume: 0.026, when: 0.046, attack: 0.002, release: 0.03 });
      return;
    }

    playTone({ frequency: 520, sweepTo: 700, duration: 0.12, type: 'triangle', volume: 0.038, attack: 0.003, release: 0.04 });
    playTone({ frequency: 760, sweepTo: 980, duration: 0.09, type: 'sine', volume: 0.02, when: 0.022, attack: 0.002, release: 0.03 });
  }

  function playPickup(cardCount = 1) {
    const total = clamp(Math.round(cardCount) || 1, 1, 18);
    const cadence = total > 10 ? 0.022 : total > 5 ? 0.028 : 0.036;

    for (let index = 0; index < total; index += 1) {
      const when = index * cadence;
      const baseFrequency = 720 + (index % 5) * 32;
      playTone({
        frequency: baseFrequency,
        sweepTo: baseFrequency + 78,
        duration: 0.05,
        type: 'square',
        volume: 0.032,
        when,
        attack: 0.003,
        release: 0.028,
      });
    }
  }

  return {
    unlock,
    setEnabled,
    playPass,
    playChallenge,
    playResolution,
    playPickup,
  };
}
