import { parseCard } from '../engine/deck.js';
import { MAX_CARDS_PER_PLAY } from '../engine/play-rules.js';
import { LLMAdapter } from '../engine/turn-manager.js';
import {
  ChallengeAction,
  EnvAction,
  PendingPlaySummary,
  PlayerObservation,
  PolicyAdapter,
  PublicState,
  TurnSummary,
} from '../env/types.js';
import { BASELINE_MODELS, ChallengeResponse, PlayTurnResponse, RANKS, Rank, Turn } from '../types/game.js';

const RANK_ORDER = new Map(RANKS.map((rank, index) => [rank, index]));
const SUIT_ORDER = new Map(['C', 'D', 'H', 'S'].map((suit, index) => [suit, index]));

function sortCardStrings(cards: string[]): string[] {
  return [...cards].sort((left, right) => {
    const parsedLeft = parseCard(left);
    const parsedRight = parseCard(right);

    if (!parsedLeft || !parsedRight) {
      return left.localeCompare(right);
    }

    const rankDelta = (RANK_ORDER.get(parsedLeft.rank) ?? 0) - (RANK_ORDER.get(parsedRight.rank) ?? 0);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return (SUIT_ORDER.get(parsedLeft.suit) ?? 0) - (SUIT_ORDER.get(parsedRight.suit) ?? 0);
  });
}

function countRankInHand(hand: string[], rank: string): number {
  return hand.filter((card) => parseCard(card)?.rank === rank).length;
}

function rankCounts(hand: string[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of hand) {
    const parsed = parseCard(card);
    if (!parsed) {
      continue;
    }
    counts.set(parsed.rank, (counts.get(parsed.rank) ?? 0) + 1);
  }
  return counts;
}

function enumerateValidPlays(hand: string[]): string[][] {
  const plays: string[][] = [];
  const limit = Math.min(MAX_CARDS_PER_PLAY, hand.length);

  const choose = (start: number, chosen: string[]) => {
    if (chosen.length > 0) {
      plays.push([...chosen]);
    }
    if (chosen.length === limit) {
      return;
    }

    for (let index = start; index < hand.length; index++) {
      chosen.push(hand[index]);
      choose(index + 1, chosen);
      chosen.pop();
    }
  };

  choose(0, []);
  return plays;
}

function getPendingPlay(publicState: PublicState): PendingPlaySummary {
  if (!publicState.pendingPlay) {
    throw new Error('Challenge decisions require a pending play in public state');
  }
  return publicState.pendingPlay;
}

function getPlayerHandSize(publicState: PublicState, playerId: string): number | undefined {
  return publicState.players.find((player) => player.playerId === playerId)?.handSize;
}

function mapVisibleTurnSummary(turn: Turn): TurnSummary {
  return {
    turnNumber: turn.turnNumber,
    playerId: turn.playerId,
    modelId: turn.playerId,
    claimedRank: turn.claimedRank,
    claimedCount: turn.claimedCount,
    challenged: turn.challenged,
    challengerId: turn.challengerId,
    challengerModelId: turn.challengerId,
    challengeCorrect: turn.challengeCorrect,
    pileAfterTurn: turn.pileAfterTurn,
    handSizesAfterTurn: { ...turn.handSizesAfterTurn },
  };
}

function buildPlayObservation(
  playerId: string,
  modelId: string,
  visibleState: Parameters<LLMAdapter['getPlayDecision']>[2]
): PlayerObservation {
  return {
    playerId,
    modelId,
    hand: sortCardStrings(visibleState.hand.map((card) => `${card.rank}${card.suit}`)),
    currentRank: visibleState.currentRank,
    pileSize: visibleState.pileSize,
    otherPlayers: Object.entries(visibleState.otherPlayersCounts).map(([otherModelId, handSize]) => ({
      playerId: otherModelId,
      modelId: otherModelId,
      handSize,
    })),
    recentTurns: visibleState.recentTurns.map(mapVisibleTurnSummary),
    phase: 'play',
    expectedActorId: playerId,
    expectedActorModelId: modelId,
    isActingPlayer: true,
  };
}

function buildChallengeObservation(
  challengerId: string,
  modelId: string,
  visibleState: Parameters<LLMAdapter['getChallengeDecision']>[2],
  publicState: PublicState
): PlayerObservation {
  return {
    playerId: challengerId,
    modelId,
    hand: sortCardStrings(visibleState.hand.map((card) => `${card.rank}${card.suit}`)),
    currentRank: visibleState.currentRank,
    pileSize: visibleState.pileSize,
    otherPlayers: Object.entries(visibleState.otherPlayersCounts).map(([otherModelId, handSize]) => ({
      playerId: otherModelId,
      modelId: otherModelId,
      handSize,
    })),
    recentTurns: visibleState.recentTurns.map(mapVisibleTurnSummary),
    phase: 'challenge',
    expectedActorId: challengerId,
    expectedActorModelId: modelId,
    pendingPlay: publicState.pendingPlay,
    isActingPlayer: true,
  };
}

function buildPlayPublicState(
  playerId: string,
  modelId: string,
  experimentId: number,
  visibleState: Parameters<LLMAdapter['getPlayDecision']>[2]
): PublicState {
  const players = [
    {
      playerId,
      modelId,
      handSize: visibleState.hand.length,
      isCurrentPlayer: true,
      isExpectedActor: true,
    },
    ...Object.entries(visibleState.otherPlayersCounts).map(([otherModelId, handSize]) => ({
      playerId: otherModelId,
      modelId: otherModelId,
      handSize,
      isCurrentPlayer: false,
      isExpectedActor: false,
    })),
  ];

  return {
    gameId: 'local-policy-play',
    experimentId: experimentId as 0 | 1 | 2 | 3,
    currentPlayerId: playerId,
    currentPlayerModelId: modelId,
    currentRank: visibleState.currentRank,
    pileSize: visibleState.pileSize,
    players,
    phase: 'play',
    expectedActorId: playerId,
    expectedActorModelId: modelId,
    lastTurn: visibleState.recentTurns.length > 0 ? mapVisibleTurnSummary(visibleState.recentTurns[visibleState.recentTurns.length - 1]) : undefined,
    totalTurns: visibleState.recentTurns.length,
    done: false,
  };
}

function buildChallengePublicState(
  challengerId: string,
  modelId: string,
  experimentId: number,
  visibleState: Parameters<LLMAdapter['getChallengeDecision']>[2],
  lastPlay: Parameters<LLMAdapter['getChallengeDecision']>[3]
): PublicState {
  const players = [
    {
      playerId: lastPlay.playerId,
      modelId: lastPlay.playerId,
      handSize: visibleState.otherPlayersCounts[lastPlay.playerId] ?? 0,
      isCurrentPlayer: true,
      isExpectedActor: false,
    },
    {
      playerId: challengerId,
      modelId,
      handSize: visibleState.hand.length,
      isCurrentPlayer: false,
      isExpectedActor: true,
    },
    ...Object.entries(visibleState.otherPlayersCounts)
      .filter(([otherModelId]) => otherModelId !== lastPlay.playerId)
      .map(([otherModelId, handSize]) => ({
        playerId: otherModelId,
        modelId: otherModelId,
        handSize,
        isCurrentPlayer: false,
        isExpectedActor: false,
      })),
  ];

  return {
    gameId: 'local-policy-challenge',
    experimentId: experimentId as 0 | 1 | 2 | 3,
    currentPlayerId: lastPlay.playerId,
    currentPlayerModelId: lastPlay.playerId,
    currentRank: visibleState.currentRank,
    pileSize: visibleState.pileSize + lastPlay.claimedCount,
    players,
    phase: 'challenge',
    expectedActorId: challengerId,
    expectedActorModelId: modelId,
    pendingPlay: {
      playerId: lastPlay.playerId,
      modelId: lastPlay.playerId,
      claimedRank: lastPlay.claimedRank as Rank,
      claimedCount: lastPlay.claimedCount,
      challengeOfferedTo: [challengerId],
      challengeRemaining: [challengerId],
    },
    lastTurn: visibleState.recentTurns.length > 0 ? mapVisibleTurnSummary(visibleState.recentTurns[visibleState.recentTurns.length - 1]) : undefined,
    totalTurns: visibleState.recentTurns.length,
    done: false,
  };
}

export class ScriptedPolicy implements PolicyAdapter {
  act(observation: PlayerObservation, publicState: PublicState): EnvAction {
    if (publicState.phase === 'play') {
      const truthfulCards = observation.hand.filter((card) => parseCard(card)?.rank === observation.currentRank);

      if (truthfulCards.length > 0) {
        const cards =
          observation.hand.length <= MAX_CARDS_PER_PLAY
            ? truthfulCards.slice(0, Math.min(truthfulCards.length, MAX_CARDS_PER_PLAY))
            : truthfulCards.slice(0, Math.min(truthfulCards.length, 2));

        return {
          type: 'play',
          playerId: observation.playerId,
          cards,
          claimCount: cards.length,
          reasoning:
            `I have ${truthfulCards.length} ${observation.currentRank}(s), so I play truthfully ` +
            `with ${cards.length} card${cards.length === 1 ? '' : 's'}.`,
        };
      }

      const counts = rankCounts(observation.hand);
      const bluffCard = [...observation.hand].sort((left, right) => {
        const parsedLeft = parseCard(left)!;
        const parsedRight = parseCard(right)!;
        const countDelta = (counts.get(parsedLeft.rank) ?? 0) - (counts.get(parsedRight.rank) ?? 0);
        if (countDelta !== 0) {
          return countDelta;
        }

        return sortCardStrings([left, right])[0] === left ? -1 : 1;
      })[0];

      return {
        type: 'play',
        playerId: observation.playerId,
        cards: [bluffCard],
        claimCount: 1,
        reasoning:
          `I have no ${observation.currentRank}s, so I make the smallest legal bluff: one face-down card ` +
          `claimed as ${observation.currentRank}.`,
      };
    }

    const pendingPlay = getPendingPlay(publicState);
    const heldCount = countRankInHand(observation.hand, pendingPlay.claimedRank);
    const accusedHandCount = getPlayerHandSize(publicState, pendingPlay.playerId);
    const mathematicallyImpossible = heldCount + pendingPlay.claimedCount > 4;
    const aboutToWin = accusedHandCount !== undefined && accusedHandCount <= pendingPlay.claimedCount;
    const largeClaim = pendingPlay.claimedCount >= 3 && heldCount > 0;
    const riskyCloseout = aboutToWin && heldCount > 0;
    const shouldChallenge = mathematicallyImpossible || riskyCloseout || largeClaim;

    return {
      type: 'challenge',
      playerId: observation.playerId,
      challenge: shouldChallenge,
      reasoning: shouldChallenge
        ? mathematicallyImpossible
          ? `I hold ${heldCount} ${pendingPlay.claimedRank}(s), so the claim is impossible.`
          : `The player is close to going out and the ${pendingPlay.claimedCount}-card ${pendingPlay.claimedRank} claim is risky enough to challenge.`
        : `I cannot prove the ${pendingPlay.claimedCount}-card ${pendingPlay.claimedRank} claim is false, so I pass.`,
    };
  }
}

export class RandomLegalPolicy implements PolicyAdapter {
  constructor(private readonly random: () => number = Math.random) {}

  act(observation: PlayerObservation, publicState: PublicState): EnvAction {
    if (publicState.phase === 'play') {
      const plays = enumerateValidPlays(sortCardStrings(observation.hand));
      const selected = plays[Math.floor(this.random() * plays.length)];
      return {
        type: 'play',
        playerId: observation.playerId,
        cards: selected,
        claimCount: selected.length,
        reasoning: `I randomly sampled a valid ${selected.length}-card play from my hand.`,
      };
    }

    const pendingPlay = getPendingPlay(publicState);
    const heldCount = countRankInHand(observation.hand, pendingPlay.claimedRank);
    const accusedHandCount = getPlayerHandSize(publicState, pendingPlay.playerId);
    const mathematicallyImpossible = heldCount + pendingPlay.claimedCount > 4;
    const highRiskCloseout = accusedHandCount !== undefined && accusedHandCount <= pendingPlay.claimedCount && pendingPlay.claimedCount >= 3;
    const shouldChallenge = mathematicallyImpossible || highRiskCloseout;

    return {
      type: 'challenge',
      playerId: observation.playerId,
      challenge: shouldChallenge,
      reasoning: shouldChallenge
        ? mathematicallyImpossible
          ? `I hold too many ${pendingPlay.claimedRank}(s) for this claim to be possible.`
          : `The player is close to going out on a large claim, so I take the simple challenge rule.`
        : `My simple rule does not flag this claim, so I pass.`,
    };
  }
}

export class TruthfulGreedyPolicy implements PolicyAdapter {
  act(observation: PlayerObservation, publicState: PublicState): EnvAction {
    if (publicState.phase === 'play') {
      const truthfulCards = sortCardStrings(
        observation.hand.filter((card) => parseCard(card)?.rank === observation.currentRank)
      );

      if (truthfulCards.length > 0) {
        const cards = truthfulCards.slice(0, Math.min(MAX_CARDS_PER_PLAY, truthfulCards.length));
        return {
          type: 'play',
          playerId: observation.playerId,
          cards,
          claimCount: cards.length,
          reasoning: `I can tell the truth here, so I greedily shed as many ${observation.currentRank}s as legal.`,
        };
      }

      const bluffCard = sortCardStrings(observation.hand)[0];
      return {
        type: 'play',
        playerId: observation.playerId,
        cards: [bluffCard],
        claimCount: 1,
        reasoning: `I have no ${observation.currentRank}s, so I make the smallest forced bluff.`,
      };
    }

    const pendingPlay = getPendingPlay(publicState);
    const heldCount = countRankInHand(observation.hand, pendingPlay.claimedRank);
    const shouldChallenge = heldCount + pendingPlay.claimedCount > 4;

    return {
      type: 'challenge',
      playerId: observation.playerId,
      challenge: shouldChallenge,
      reasoning: shouldChallenge
        ? `I can prove this ${pendingPlay.claimedRank} claim is impossible from my own hand.`
        : `I only challenge hard impossibility cues, and this claim is still possible.`,
    };
  }
}

export function createBaselinePolicy(modelId: string): PolicyAdapter {
  switch (modelId) {
    case 'baseline/scripted':
      return new ScriptedPolicy();
    case 'baseline/random-legal':
      return new RandomLegalPolicy();
    case 'baseline/truthful-greedy':
      return new TruthfulGreedyPolicy();
    default:
      throw new Error(`Unknown baseline policy model ID: ${modelId}`);
  }
}

export class LocalPolicyLLMAdapter implements LLMAdapter {
  async getPlayDecision(
    playerId: string,
    modelId: string,
    visibleState: Parameters<LLMAdapter['getPlayDecision']>[2],
    experimentId: number
  ): Promise<PlayTurnResponse> {
    const policy = createBaselinePolicy(modelId);
    const observation = buildPlayObservation(playerId, modelId, visibleState);
    const publicState = buildPlayPublicState(playerId, modelId, experimentId, visibleState);
    const action = policy.act(observation, publicState);

    if (action.type !== 'play') {
      throw new Error(`Baseline policy ${modelId} returned a ${action.type} action during the play phase`);
    }

    return {
      reasoning: action.reasoning ?? '',
      cards_to_play: action.cards,
      claim_count: action.claimCount,
    };
  }

  async getChallengeDecision(
    challengerId: string,
    modelId: string,
    visibleState: Parameters<LLMAdapter['getChallengeDecision']>[2],
    lastPlay: Parameters<LLMAdapter['getChallengeDecision']>[3],
    experimentId: number
  ): Promise<ChallengeResponse> {
    const policy = createBaselinePolicy(modelId);
    const publicState = buildChallengePublicState(challengerId, modelId, experimentId, visibleState, lastPlay);
    const observation = buildChallengeObservation(challengerId, modelId, visibleState, publicState);
    const action = policy.act(observation, publicState);

    if (action.type !== 'challenge') {
      throw new Error(`Baseline policy ${modelId} returned a ${action.type} action during the challenge phase`);
    }

    const challengeAction = action as ChallengeAction;
    return {
      reasoning: challengeAction.reasoning ?? '',
      challenge: challengeAction.challenge,
    };
  }
}

export function isBaselineModelId(modelId: string): boolean {
  return (BASELINE_MODELS as readonly string[]).includes(modelId);
}
