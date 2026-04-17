import { describe, expect, it } from 'vitest';
import { advanceTurn, createGameState, processChallenge, processPlay } from '../engine/game-state.js';
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

  it('builds a current-turn feed for pending claims with explicit pass entries', () => {
    const state = createGameState('spectator-feed-pending', 1, [
      { modelId: 'model-a' },
      { modelId: 'model-b' },
      { modelId: 'model-c' },
      { modelId: 'model-d' },
    ], 5);

    const actor = state.players[0];
    state.currentPlayerIndex = 0;
    state.currentRank = actor.hand[0].rank;

    const turn = processPlay(state, actor.id, [actor.hand[0]], 1, 'claim');
    turn.challengeDecisions?.push({ playerId: state.players[1].id, challenge: false });
    turn.challengeOfferedTo?.push(state.players[1].id);

    const clientState = buildClientGameState({
      state,
      phase: 'challenging',
      pendingTurn: turn,
      challengeQueue: [state.players[2].id, state.players[3].id],
      humanPlayerId: null,
      hidePrivateState: false,
      provider: 'mock',
    });

    expect(clientState.currentTurnFeed).toEqual({
      turnNumber: 1,
      resolved: false,
      entries: [
        {
          seq: 1,
          type: 'claim',
          playerId: actor.id,
          claimedCount: 1,
          claimedRank: state.currentRank,
        },
        {
          seq: 2,
          type: 'pass',
          playerId: state.players[1].id,
          targetPlayerId: actor.id,
          claimedCount: 1,
          claimedRank: state.currentRank,
        },
      ],
    });
  });

  it('builds a resolved current-turn feed for successful challenges', () => {
    const state = createGameState('spectator-feed-resolved', 1, [
      { modelId: 'model-a' },
      { modelId: 'model-b' },
      { modelId: 'model-c' },
      { modelId: 'model-d' },
    ], 9);

    const actor = state.players[0];
    const challenger = state.players[1];
    state.currentPlayerIndex = 0;

    const lieCard = actor.hand.find((card) => card.rank !== state.currentRank)!;
    const turn = processPlay(state, actor.id, [lieCard], 1, 'lie');
    turn.challengeDecisions?.push({ playerId: challenger.id, challenge: true });
    turn.challengeOfferedTo?.push(challenger.id);
    processChallenge(state, turn, challenger.id, 'caught you');
    advanceTurn(state, turn);

    const clientState = buildClientGameState({
      state,
      phase: 'waiting',
      pendingTurn: null,
      challengeQueue: [],
      humanPlayerId: null,
      hidePrivateState: false,
      provider: 'mock',
    });

    expect(clientState.currentTurnFeed).toEqual({
      turnNumber: 1,
      resolved: true,
      entries: [
        {
          seq: 1,
          type: 'claim',
          playerId: actor.id,
          claimedCount: 1,
          claimedRank: state.turns[0].claimedRank,
        },
        {
          seq: 2,
          type: 'challenge',
          playerId: challenger.id,
          targetPlayerId: actor.id,
          claimedCount: 1,
          claimedRank: state.turns[0].claimedRank,
        },
        {
          seq: 3,
          type: 'resolution',
          playerId: challenger.id,
          targetPlayerId: actor.id,
          claimedCount: 1,
          claimedRank: state.turns[0].claimedRank,
          challengeCorrect: true,
          outcome: 'lie_exposed',
        },
      ],
    });
  });
});
