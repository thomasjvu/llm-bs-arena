import { describe, expect, it } from 'vitest';
import { createGameState, processPlay } from '../engine/game-state.js';
import { buildClientGameState } from '../server-state.js';

describe('server client state shaping', () => {
  it('hides non-human hands and private reasoning while exposing a human challenge window', () => {
    const state = createGameState('interactive-ui', 1, [
      { modelId: 'human/player', displayName: 'you', role: 'human' },
      { modelId: 'model-a' },
      { modelId: 'model-b' },
      { modelId: 'model-c' },
    ], 7);

    const human = state.players.find((player) => player.role === 'human');
    const actor = state.players.find((player) => player.id !== human?.id)!;
    state.currentPlayerIndex = state.players.findIndex((player) => player.id === actor.id);
    state.currentRank = actor.hand[0].rank;

    const turn = processPlay(state, actor.id, [actor.hand[0]], 1, 'Private model reasoning');

    const clientState = buildClientGameState({
      state,
      phase: 'challenging',
      pendingTurn: turn,
      challengeQueue: [human!.id],
      humanPlayerId: human!.id,
      hidePrivateState: true,
      provider: 'mock',
    });

    const visibleHuman = clientState.players.find((player) => player.id === human!.id);
    const hiddenOpponent = clientState.players.find((player) => player.id === actor.id);

    expect(visibleHuman?.handVisible).toBe(true);
    expect(visibleHuman?.hand.length).toBeGreaterThan(0);
    expect(hiddenOpponent?.handVisible).toBe(false);
    expect(hiddenOpponent?.hand).toEqual([]);
    expect(clientState.pendingTurn?.reasoning).toBe('');
    expect(clientState.awaitingHumanAction).toEqual({
      type: 'challenge',
      playerId: human!.id,
      playerName: 'you',
      pendingPlay: {
        playerId: actor.id,
        modelId: actor.modelId,
        displayName: actor.displayName,
        claimedCount: 1,
        claimedRank: state.currentRank,
      },
    });
    expect(clientState.thinkingPlayerId).toBeNull();
  });

  it('surfaces a human play window when the current player is human', () => {
    const state = createGameState('interactive-ui-play', 1, [
      { modelId: 'human/player', displayName: 'you', role: 'human' },
      { modelId: 'model-a' },
      { modelId: 'model-b' },
      { modelId: 'model-c' },
    ], 11);

    const human = state.players.find((player) => player.role === 'human')!;
    state.currentPlayerIndex = state.players.findIndex((player) => player.id === human.id);

    const clientState = buildClientGameState({
      state,
      phase: 'waiting',
      pendingTurn: null,
      challengeQueue: [],
      humanPlayerId: human.id,
      hidePrivateState: true,
      provider: 'mock',
    });

    expect(clientState.awaitingHumanAction).toEqual({
      type: 'play',
      playerId: human.id,
      playerName: 'you',
      currentRank: state.currentRank,
    });
    expect(clientState.players.filter((player) => player.id !== human.id).every((player) => player.hand.length === 0)).toBe(true);
  });
});
