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

  function playChallenge() {
    playTone({ frequency: 240, sweepTo: 132, duration: 0.22, type: 'sawtooth', volume: 0.075, attack: 0.005, release: 0.08 });
    playTone({ frequency: 640, sweepTo: 410, duration: 0.16, type: 'square', volume: 0.06, when: 0.025, attack: 0.004, release: 0.05 });
    playTone({ frequency: 860, sweepTo: 720, duration: 0.09, type: 'triangle', volume: 0.028, when: 0.065, attack: 0.002, release: 0.03 });
  }

  function playResolution(kind = 'claim_stands') {
    if (kind === 'lie_exposed') {
      playTone({ frequency: 340, sweepTo: 156, duration: 0.24, type: 'triangle', volume: 0.068, attack: 0.004, release: 0.08 });
      playTone({ frequency: 188, sweepTo: 96, duration: 0.28, type: 'square', volume: 0.052, when: 0.02, attack: 0.004, release: 0.08 });
      playTone({ frequency: 124, sweepTo: 86, duration: 0.18, type: 'sawtooth', volume: 0.03, when: 0.08, attack: 0.003, release: 0.04 });
      return;
    }

    playTone({ frequency: 360, sweepTo: 560, duration: 0.18, type: 'triangle', volume: 0.062, attack: 0.004, release: 0.06 });
    playTone({ frequency: 520, sweepTo: 760, duration: 0.2, type: 'square', volume: 0.052, when: 0.02, attack: 0.004, release: 0.06 });
    playTone({ frequency: 740, sweepTo: 930, duration: 0.1, type: 'triangle', volume: 0.026, when: 0.07, attack: 0.002, release: 0.03 });
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
    playChallenge,
    playResolution,
    playPickup,
  };
}
