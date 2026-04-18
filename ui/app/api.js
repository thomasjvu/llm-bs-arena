const API_BASE = '/api';

async function parseJson(response) {
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

async function consumeEventStream(response, handlers = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalState = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      let eventName = null;
      let payload = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventName = line.slice(7);
        } else if (line.startsWith('data: ')) {
          payload += line.slice(6);
        }
      }

      if (!eventName) continue;
      const data = payload ? JSON.parse(payload) : {};

      if (eventName === 'thinking') {
        handlers.onThinking?.(data);
        continue;
      }

      if (eventName === 'token') {
        handlers.onToken?.(data);
        continue;
      }

      if (eventName === 'error') {
        throw new Error(data.error || data.details || 'Streaming step failed');
      }

      if (eventName === 'complete') {
        finalState = data;
        handlers.onComplete?.(data);
      }
    }
  }

  return finalState;
}

export async function startGame(options) {
  const response = await fetch(`${API_BASE}/game/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      experimentId: options.experimentId,
      interactive: options.mode === 'interactive',
      provider: options.provider,
      apiKey: options.provider === 'nim' ? options.apiKey : '',
      humanName: options.humanName,
      persistLogs: false,
    }),
  });
  return parseJson(response);
}

export async function stepGame(gameId, handlers = {}) {
  const response = await fetch(`${API_BASE}/game/${gameId}/step?stream=1`, {
    method: 'POST',
  });

  if (response.headers.get('content-type')?.includes('text/event-stream') && response.body) {
    const state = await consumeEventStream(response, handlers);
    if (state) return state;
    throw new Error('Step stream ended without a final game state');
  }

  return parseJson(response);
}

export async function fetchGameState(gameId) {
  const response = await fetch(`${API_BASE}/game/${gameId}/state`, {
    method: 'GET',
  });
  return parseJson(response);
}

export async function probeGameState(gameId) {
  const response = await fetch(`${API_BASE}/game/${gameId}/state?soft=1`, {
    method: 'GET',
  });
  return parseJson(response);
}

export async function submitHumanPlay(gameId, cardsToPlay) {
  const response = await fetch(`${API_BASE}/game/${gameId}/human/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardsToPlay }),
  });
  return parseJson(response);
}

export async function submitHumanChallenge(gameId, challenge) {
  const response = await fetch(`${API_BASE}/game/${gameId}/human/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge }),
  });
  return parseJson(response);
}

export async function fetchStats(experimentId) {
  const response = await fetch(`${API_BASE}/stats?experiment=${experimentId}`);
  return parseJson(response);
}

export async function fetchStatsCompare() {
  const response = await fetch(`${API_BASE}/stats/compare`);
  return parseJson(response);
}

export async function fetchResearchStats(experimentId) {
  const response = await fetch(`${API_BASE}/research/stats?experiment=${experimentId}`);
  return parseJson(response);
}

export async function fetchResearchCompare() {
  const response = await fetch(`${API_BASE}/research/compare`);
  return parseJson(response);
}

export async function fetchRuntimeStatus() {
  const response = await fetch(`${API_BASE}/runtime`, {
    method: 'GET',
  });
  return parseJson(response);
}
