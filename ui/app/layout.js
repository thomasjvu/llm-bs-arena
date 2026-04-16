export const SLOT_IDS = ['active', 'sidebar-0', 'sidebar-1', 'sidebar-2'];

function getFocusPlayerId(state) {
  if (!state?.players?.length) return null;
  if (state.phase === 'challenging' && state.pendingTurn?.playerId) {
    return state.pendingTurn.playerId;
  }
  if (state.awaitingHumanAction?.type === 'play') {
    return state.awaitingHumanAction.playerId;
  }
  if (state.thinkingPlayerId) {
    return state.thinkingPlayerId;
  }
  return state.players[state.currentPlayerIndex]?.id ?? state.players[0]?.id ?? null;
}

function getTurnLeadPlayerId(state) {
  if (!state?.players?.length) return null;
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
  const focusPlayerId = getFocusPlayerId(state);
  if (!players.length || !focusPlayerId) {
    return {
      activePlayerId: null,
      orderedPlayerIds: [],
      slots: Object.fromEntries(SLOT_IDS.map((slotId) => [slotId, null])),
      playerToSlot: new Map(),
    };
  }

  const focusIndex = Math.max(0, players.findIndex((player) => player.id === focusPlayerId));
  const orderedPlayerIds = players.map((_, offset) => players[(focusIndex + offset) % players.length].id);
  const slots = {};
  const playerToSlot = new Map();

  SLOT_IDS.forEach((slotId, index) => {
    const playerId = orderedPlayerIds[index] ?? null;
    slots[slotId] = playerId;
    if (playerId) {
      playerToSlot.set(playerId, slotId);
    }
  });

  return {
    activePlayerId: orderedPlayerIds[0] ?? null,
    orderedPlayerIds,
    slots,
    playerToSlot,
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
      isLead: offset === 0,
      isAwaitingHuman: state.awaitingHumanAction?.playerId === player.id,
      isEliminated: player.isEliminated,
    };
  });
}
