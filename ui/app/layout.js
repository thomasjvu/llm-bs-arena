export const DEFAULT_SLOT_ID = 'cast-0';
export const SLOT_IDS = ['cast-0', 'cast-1', 'cast-2', 'cast-3'];

const SLOT_META = {
  'cast-0': {
    stagePosition: 'seat-0',
    section: 'board',
    facing: 'right',
  },
  'cast-1': {
    stagePosition: 'seat-1',
    section: 'board',
    facing: 'right',
  },
  'cast-2': {
    stagePosition: 'seat-2',
    section: 'board',
    facing: 'left',
  },
  'cast-3': {
    stagePosition: 'seat-3',
    section: 'board',
    facing: 'left',
  },
};

function getActiveSpeakerId(state) {
  if (!state?.players?.length) return null;
  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.pendingPlay?.playerId) {
    return state.awaitingHumanAction.pendingPlay.playerId;
  }
  if (state.awaitingHumanAction?.playerId) {
    return state.awaitingHumanAction.playerId;
  }
  if (state.phase === 'challenging' && state.pendingTurn?.playerId) {
    return state.pendingTurn.playerId;
  }
  if (state.thinkingPlayerId) {
    return state.thinkingPlayerId;
  }
  return state.players[state.currentPlayerIndex]?.id ?? state.players[0]?.id ?? null;
}

function getTurnLeadPlayerId(state) {
  if (!state?.players?.length) return null;
  if (state.awaitingHumanAction?.type === 'challenge' && state.awaitingHumanAction.pendingPlay?.playerId) {
    return state.awaitingHumanAction.pendingPlay.playerId;
  }
  if (state.awaitingHumanAction?.playerId) {
    return state.awaitingHumanAction.playerId;
  }
  if (state.thinkingPlayerId) {
    return state.thinkingPlayerId;
  }
  return state.players[state.currentPlayerIndex]?.id ?? state.players[0]?.id ?? null;
}

function getTurnJudgePlayerId(state) {
  if (!state?.players?.length) return null;
  if (state.awaitingHumanAction?.type === 'challenge') {
    return state.awaitingHumanAction.playerId ?? null;
  }
  if (state.phase === 'challenging') {
    return state.thinkingPlayerId ?? null;
  }
  return null;
}

export function buildSlotLayout(state) {
  const players = state?.players ?? [];
  const activePlayerId = getActiveSpeakerId(state);
  const slots = Object.fromEntries(SLOT_IDS.map((slotId, index) => [slotId, players[index]?.id ?? null]));
  const playerToSlot = new Map();

  SLOT_IDS.forEach((slotId) => {
    const playerId = slots[slotId];
    if (playerId) {
      playerToSlot.set(playerId, slotId);
    }
  });

  return {
    activePlayerId,
    orderedPlayerIds: players.map((player) => player.id),
    slots,
    playerToSlot,
    slotMeta: SLOT_META,
  };
}

export function getSlotForPlayer(layout, playerId) {
  return layout?.playerToSlot?.get(playerId) ?? null;
}

export function buildTurnRibbon(state) {
  const players = state?.players ?? [];
  const leadPlayerId = getTurnLeadPlayerId(state);
  const judgePlayerId = getTurnJudgePlayerId(state);
  if (!players.length || !leadPlayerId) return [];

  const leadIndex = Math.max(0, players.findIndex((player) => player.id === leadPlayerId));
  return players.map((_, offset) => {
    const player = players[(leadIndex + offset) % players.length];
    const role = player.id === judgePlayerId
      ? 'judge'
      : player.id === leadPlayerId
        ? 'leader'
        : 'standby';
    return {
      id: player.id,
      name: player.displayName || player.modelId,
      modelId: player.modelId,
      order: offset + 1,
      isLead: offset === 0,
      isAwaitingHuman: state.awaitingHumanAction?.playerId === player.id,
      isEliminated: player.isEliminated,
      role,
      roleLabel: role === 'judge' ? 'JUDGE' : role === 'leader' ? 'LEADER' : 'STANDBY',
    };
  });
}
