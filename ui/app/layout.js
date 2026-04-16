export const DEFAULT_SLOT_ID = 'cast-0';
export const SLOT_IDS = ['cast-0', 'cast-1', 'cast-2', 'cast-3'];

const SLOT_META = {
  'cast-0': {
    stagePosition: 'actor-left',
    section: 'actor',
    facing: 'right',
  },
  'cast-1': {
    stagePosition: 'judge-top',
    section: 'judge',
    facing: 'left',
  },
  'cast-2': {
    stagePosition: 'judge-mid',
    section: 'judge',
    facing: 'left',
  },
  'cast-3': {
    stagePosition: 'judge-bottom',
    section: 'judge',
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

export function buildSlotLayout(state) {
  const players = state?.players ?? [];
  const activePlayerId = getActiveSpeakerId(state);
  const activeIndex = players.findIndex((player) => player.id === activePlayerId);
  const judgePlayers = activeIndex >= 0
    ? [
        ...players.slice(activeIndex + 1),
        ...players.slice(0, activeIndex),
      ]
    : players.slice(1);
  const stageOrder = [
    activeIndex >= 0 ? players[activeIndex] : players[0],
    ...judgePlayers,
  ].filter(Boolean);
  const slots = Object.fromEntries(SLOT_IDS.map((slotId, index) => [slotId, stageOrder[index]?.id ?? null]));
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
  if (!players.length || !leadPlayerId) return [];

  const leadIndex = Math.max(0, players.findIndex((player) => player.id === leadPlayerId));
  return players.map((_, offset) => {
    const player = players[(leadIndex + offset) % players.length];
    return {
      id: player.id,
      name: player.displayName || player.modelId,
      modelId: player.modelId,
      order: offset + 1,
      isLead: offset === 0,
      isAwaitingHuman: state.awaitingHumanAction?.playerId === player.id,
      isEliminated: player.isEliminated,
    };
  });
}
