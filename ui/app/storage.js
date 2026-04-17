const STORAGE_KEY = 'llm-bullshit.frontend.preferences.v2';

const DEFAULTS = {
  mode: null,
  provider: 'mock',
  humanName: 'you',
  soundEnabled: true,
  activeGameId: null,
  resumeAutoPlay: false,
};

function normalizeMode(value) {
  return value === 'interactive' || value === 'spectator' ? value : null;
}

function normalizeProvider(value) {
  return value === 'nim' ? 'nim' : 'mock';
}

function normalizeHumanName(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : DEFAULTS.humanName;
}

function normalizeSoundEnabled(value) {
  return value === false ? false : true;
}

function normalizeActiveGameId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeResumeAutoPlay(value) {
  return value === true;
}

export function loadPreferences() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULTS };
    }
    const parsed = JSON.parse(raw);
    return {
      mode: normalizeMode(parsed.mode),
      provider: normalizeProvider(parsed.provider),
      humanName: normalizeHumanName(parsed.humanName),
      soundEnabled: normalizeSoundEnabled(parsed.soundEnabled),
      activeGameId: normalizeActiveGameId(parsed.activeGameId),
      resumeAutoPlay: normalizeResumeAutoPlay(parsed.resumeAutoPlay),
    };
  } catch (_error) {
    return { ...DEFAULTS };
  }
}

export function savePreferences(preferences) {
  const next = {
    mode: normalizeMode(preferences.mode),
    provider: normalizeProvider(preferences.provider),
    humanName: normalizeHumanName(preferences.humanName),
    soundEnabled: normalizeSoundEnabled(preferences.soundEnabled),
    activeGameId: normalizeActiveGameId(preferences.activeGameId),
    resumeAutoPlay: normalizeResumeAutoPlay(preferences.resumeAutoPlay),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getDefaultPreferences() {
  return { ...DEFAULTS };
}
