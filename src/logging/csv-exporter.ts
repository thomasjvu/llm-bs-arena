import * as fs from 'fs';
import * as path from 'path';
import { GameLog, Turn, PlayerStats } from '../types/game.js';
import { replayTurnTruthfulAvailability } from '../metrics/truthful-availability.js';

/**
 * Exports game data to CSV for analysis in Python/R
 */
export class CSVExporter {
  private outputDir: string;

  constructor(outputDir: string = 'logs/csv') {
    this.outputDir = outputDir;
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  private csvCell(value: unknown): string {
    if (value === undefined || value === null) return '';
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private acceptedChallengeDecision(turn: Turn) {
    return (turn.challengeDecisions ?? []).find((decision) => decision.challenge);
  }

  private challengeTokenUsages(turn: Turn) {
    if (turn.challengeDecisions && turn.challengeDecisions.length > 0) {
      return turn.challengeDecisions.map((decision) => decision.tokenUsage);
    }

    return turn.challengeTokenUsage ? [turn.challengeTokenUsage] : [];
  }

  /**
   * Exports all turns to a flat CSV
   */
  exportTurns(games: GameLog[]): string {
    const filepath = path.join(this.outputDir, 'all_turns.csv');

    const headers = [
      'game_id',
      'experiment_id',
      'provider',
      'provider_base_url',
      'prompt_version',
      'prompt_hash',
      'log_schema_version',
      'turn_number',
      'player_id',
      'model_id',
      'claimed_rank',
      'claimed_count',
      'actual_cards',
      'was_lie',
      'truthful_available',
      'truthful_available_count',
      'truthful_play_unavailable',
      'optional_lie',
      'challenge_offered_to',
      'challenged',
      'challenger_id',
      'challenger_model',
      'challenge_correct',
      'pile_after',
      'reasoning',
      'play_response_time_ms',
          'play_prompt_tokens',
          'play_completion_tokens',
          'play_total_tokens',
          'play_token_usage_incomplete',
          'challenge_response_time_ms',
          'challenge_prompt_tokens',
          'challenge_completion_tokens',
          'challenge_total_tokens',
          'challenge_token_usage_incomplete',
    ];

    const rows: string[] = [headers.join(',')];

    for (const game of games) {
      const modelMap: Record<string, string> = {};
      for (const p of game.players) {
        modelMap[p.id] = p.modelId;
      }

      const availabilityByTurn = replayTurnTruthfulAvailability(game);
      for (const turn of game.turns) {
        const availability = availabilityByTurn[turn.turnNumber - 1];
        const row = [
          game.gameId,
          game.experimentId,
          game.metadata?.provider || '',
          game.metadata?.providerBaseUrl || '',
          game.metadata?.promptVersion || '',
          game.metadata?.promptHash || '',
          game.metadata?.logSchemaVersion ?? '',
          turn.turnNumber,
          turn.playerId,
          modelMap[turn.playerId] || '',
          turn.claimedRank,
          turn.claimedCount,
          turn.actualCards.map((c) => `${c.rank}${c.suit}`).join(';'),
          turn.wasLie ? 1 : 0,
          availability?.truthfulAvailable === null ? '' : (availability?.truthfulAvailable ? 1 : 0),
          availability?.truthfulAvailableCount ?? '',
          availability?.truthfulPlayUnavailable === null ? '' : (availability?.truthfulPlayUnavailable ? 1 : 0),
          availability?.optionalLie === null ? '' : (availability?.optionalLie ? 1 : 0),
          (turn.challengeOfferedTo || []).join(';'),
          turn.challenged ? 1 : 0,
          turn.challengerId || '',
          turn.challengerId ? modelMap[turn.challengerId] || '' : '',
          turn.challengeCorrect !== undefined ? (turn.challengeCorrect ? 1 : 0) : '',
          turn.pileAfterTurn,
          turn.reasoning || '',
          turn.playResponseTimeMs ?? '',
          turn.playTokenUsage?.promptTokens ?? '',
          turn.playTokenUsage?.completionTokens ?? '',
          turn.playTokenUsage?.totalTokens ?? '',
          turn.playTokenUsageIncomplete === undefined ? '' : (turn.playTokenUsageIncomplete ? 1 : 0),
          turn.challengeResponseTimeMs ?? this.acceptedChallengeDecision(turn)?.responseTimeMs ?? '',
          turn.challengeTokenUsage?.promptTokens ?? this.acceptedChallengeDecision(turn)?.tokenUsage?.promptTokens ?? '',
          turn.challengeTokenUsage?.completionTokens ?? this.acceptedChallengeDecision(turn)?.tokenUsage?.completionTokens ?? '',
          turn.challengeTokenUsage?.totalTokens ?? this.acceptedChallengeDecision(turn)?.tokenUsage?.totalTokens ?? '',
          (turn.challengeTokenUsageIncomplete ?? this.acceptedChallengeDecision(turn)?.tokenUsageIncomplete) === undefined
            ? ''
            : ((turn.challengeTokenUsageIncomplete ?? this.acceptedChallengeDecision(turn)?.tokenUsageIncomplete) ? 1 : 0),
        ];
        rows.push(row.map((cell) => this.csvCell(cell)).join(','));
      }
    }

    fs.writeFileSync(filepath, rows.join('\n'));
    return filepath;
  }

  /**
   * Exports game-level summary to CSV
   */
  exportGameSummary(games: GameLog[]): string {
    const filepath = path.join(this.outputDir, 'game_summary.csv');

    const headers = [
      'game_id',
      'experiment_id',
      'provider',
      'provider_base_url',
      'prompt_version',
      'prompt_hash',
      'log_schema_version',
      'seed',
      'max_turns',
      'termination_reason',
      'seating_order',
      'player_0',
      'player_1',
      'player_2',
      'player_3',
      'winner_id',
      'winner_model',
      'total_turns',
      'total_lies',
      'total_challenges',
      'successful_challenges',
      'duration_ms',
      'total_prompt_tokens',
      'total_completion_tokens',
      'total_tokens',
      'token_usage_incomplete',
    ];

    const rows: string[] = [headers.join(',')];

    for (const game of games) {
      const modelMap: Record<string, string> = {};
      for (const p of game.players) {
        modelMap[p.id] = p.modelId;
      }

      const totalLies = game.turns.filter((t) => t.wasLie).length;
      const totalChallenges = game.turns.filter((t) => t.challenged).length;
      const successfulChallenges = game.turns.filter((t) => t.challenged && t.challengeCorrect).length;
      const tokenUsages = game.turns.flatMap((turn) => [
        turn.playTokenUsage,
        ...this.challengeTokenUsages(turn),
      ]);
      const hasTokenUsage = tokenUsages.some(Boolean);
      const totalPromptTokens = hasTokenUsage
        ? tokenUsages.reduce((s, usage) => s + (usage?.promptTokens ?? 0), 0)
        : '';
      const totalCompletionTokens = hasTokenUsage
        ? tokenUsages.reduce((s, usage) => s + (usage?.completionTokens ?? 0), 0)
        : '';
      const totalTokens = hasTokenUsage
        ? tokenUsages.reduce((s, usage) => s + (usage?.totalTokens ?? 0), 0)
        : '';
      const tokenUsageIncomplete = game.turns.some((turn) =>
        Boolean(turn.playTokenUsageIncomplete) ||
        Boolean(turn.challengeTokenUsageIncomplete) ||
        Boolean(turn.challengeDecisions?.some((decision) => decision.tokenUsageIncomplete))
      );

      const row = [
        game.gameId,
        game.experimentId,
        game.metadata?.provider || '',
        game.metadata?.providerBaseUrl || '',
        game.metadata?.promptVersion || '',
        game.metadata?.promptHash || '',
        game.metadata?.logSchemaVersion ?? '',
        game.seed ?? '',
        game.maxTurns ?? '',
        game.terminationReason || '',
        (game.seatingOrder || []).join(';'),
        game.players[0]?.modelId || '',
        game.players[1]?.modelId || '',
        game.players[2]?.modelId || '',
        game.players[3]?.modelId || '',
        game.winner || '',
        game.winner ? modelMap[game.winner] || '' : '',
        game.totalTurns,
        totalLies,
        totalChallenges,
        successfulChallenges,
        game.durationMs,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        tokenUsageIncomplete ? 1 : 0,
      ];
      rows.push(row.map((cell) => this.csvCell(cell)).join(','));
    }

    fs.writeFileSync(filepath, rows.join('\n'));
    return filepath;
  }

  /**
   * Exports one row per challenge-window decision, including pass rationales.
   */
  exportChallengeDecisions(games: GameLog[]): string {
    const filepath = path.join(this.outputDir, 'challenge_decisions.csv');

    const headers = [
      'game_id',
      'experiment_id',
      'provider',
      'provider_base_url',
      'prompt_version',
      'prompt_hash',
      'log_schema_version',
      'turn_number',
      'acting_player_id',
      'acting_model_id',
      'challenger_id',
      'challenger_model',
      'decision_order',
      'challenge',
      'challenge_correct',
      'reasoning',
      'response_time_ms',
      'prompt_tokens',
      'completion_tokens',
      'total_tokens',
      'token_usage_incomplete',
    ];

    const rows: string[] = [headers.join(',')];

    for (const game of games) {
      const modelMap: Record<string, string> = {};
      for (const player of game.players) {
        modelMap[player.id] = player.modelId;
      }

      for (const turn of game.turns) {
        const decisions = turn.challengeDecisions && turn.challengeDecisions.length > 0
          ? turn.challengeDecisions
          : (turn.challengeOfferedTo ?? []).map((playerId, decisionOrder) => ({
              playerId,
              modelId: modelMap[playerId],
              decisionOrder,
              challenge: turn.challengerId === playerId,
              reasoning: turn.challengerId === playerId ? turn.challengeReasoning || '' : '',
              responseTimeMs: turn.challengerId === playerId ? turn.challengeResponseTimeMs : undefined,
              tokenUsage: turn.challengerId === playerId ? turn.challengeTokenUsage : undefined,
              tokenUsageIncomplete: turn.challengerId === playerId ? turn.challengeTokenUsageIncomplete : undefined,
            }));

        for (const [index, decision] of decisions.entries()) {
          const row = [
            game.gameId,
            game.experimentId,
            game.metadata?.provider || '',
            game.metadata?.providerBaseUrl || '',
            game.metadata?.promptVersion || '',
            game.metadata?.promptHash || '',
            game.metadata?.logSchemaVersion ?? '',
            turn.turnNumber,
            turn.playerId,
            modelMap[turn.playerId] || '',
            decision.playerId,
            decision.modelId || modelMap[decision.playerId] || '',
            decision.decisionOrder ?? index,
            decision.challenge ? 1 : 0,
            decision.challenge ? (turn.challengeCorrect !== undefined ? (turn.challengeCorrect ? 1 : 0) : '') : '',
            decision.reasoning || '',
            decision.responseTimeMs ?? '',
            decision.tokenUsage?.promptTokens ?? '',
            decision.tokenUsage?.completionTokens ?? '',
            decision.tokenUsage?.totalTokens ?? '',
            decision.tokenUsageIncomplete === undefined ? '' : (decision.tokenUsageIncomplete ? 1 : 0),
          ];
          rows.push(row.map((cell) => this.csvCell(cell)).join(','));
        }
      }
    }

    fs.writeFileSync(filepath, rows.join('\n'));
    return filepath;
  }

  /**
   * Exports one row per player per game for downstream statistics.
   */
  exportPlayerGameStats(games: GameLog[]): string {
    const filepath = path.join(this.outputDir, 'player_game_stats.csv');

    const headers = [
      'game_id',
      'experiment_id',
      'provider',
      'provider_base_url',
      'prompt_version',
      'prompt_hash',
      'log_schema_version',
      'seed',
      'max_turns',
      'termination_reason',
      'seating_order',
      'player_id',
      'model_id',
      'won',
      'total_plays',
      'total_lies',
      'lie_frequency',
      'successful_lies',
      'lie_success_rate',
      'truthful_available_turns',
      'truthful_unavailable_turns',
      'truthful_available_turn_share',
      'truthful_unavailable_turn_share',
      'optional_lies',
      'optional_lie_turn_share',
      'optional_lie_rate_given_truthful_available',
      'challenges_made',
      'challenge_opportunities',
      'paranoia_frequency',
      'correct_challenges',
      'challenge_accuracy',
      'instruction_violations',
      'instruction_violation_rate',
    ];

    const rows: string[] = [headers.join(',')];

    for (const game of games) {
      const availabilityByTurn = replayTurnTruthfulAvailability(game);
      for (const player of game.players) {
        const playerId = player.id;
        const playerTurns = game.turns.filter((turn) => turn.playerId === playerId);
        const playerTurnAvailability = availabilityByTurn.filter((turn) => turn.playerId === playerId);
        const opponentTurns = game.turns.filter((turn) => turn.playerId !== playerId);

        const totalPlays = playerTurns.length;
        const totalLies = playerTurns.filter((turn) => turn.wasLie).length;
        const successfulLies = playerTurns.filter((turn) => turn.wasLie && !turn.challenged).length;
        const truthfulAvailableTurns = playerTurnAvailability.filter((turn) => turn.truthfulAvailable).length;
        const truthfulUnavailableTurns = playerTurnAvailability.filter((turn) => turn.truthfulPlayUnavailable).length;
        const optionalLies = playerTurnAvailability.filter((turn) => turn.optionalLie).length;
        const challengesMade = opponentTurns.filter((turn) => turn.challengerId === playerId).length;
        const challengeOpportunities = opponentTurns.filter((turn) => {
          if (Array.isArray(turn.challengeOfferedTo)) {
            return turn.challengeOfferedTo.includes(playerId);
          }
          return true;
        }).length;
        const correctChallenges = opponentTurns.filter((turn) => turn.challengerId === playerId && turn.challengeCorrect).length;
        const instructionViolations = game.experimentId === 3 ? totalLies : '';
        const instructionViolationRate = game.experimentId === 3
          ? (totalPlays > 0 ? (totalLies / totalPlays).toFixed(4) : '0.0000')
          : '';

        const row = [
          game.gameId,
          game.experimentId,
          game.metadata?.provider || '',
          game.metadata?.providerBaseUrl || '',
          game.metadata?.promptVersion || '',
          game.metadata?.promptHash || '',
          game.metadata?.logSchemaVersion ?? '',
          game.seed ?? '',
          game.maxTurns ?? '',
          game.terminationReason || '',
          (game.seatingOrder || []).join(';'),
          playerId,
          player.modelId,
          game.winner === playerId ? 1 : 0,
          totalPlays,
          totalLies,
          totalPlays > 0 ? (totalLies / totalPlays).toFixed(4) : '0.0000',
          successfulLies,
          totalLies > 0 ? (successfulLies / totalLies).toFixed(4) : '0.0000',
          truthfulAvailableTurns,
          truthfulUnavailableTurns,
          totalPlays > 0 ? (truthfulAvailableTurns / totalPlays).toFixed(4) : '0.0000',
          totalPlays > 0 ? (truthfulUnavailableTurns / totalPlays).toFixed(4) : '0.0000',
          optionalLies,
          totalPlays > 0 ? (optionalLies / totalPlays).toFixed(4) : '0.0000',
          truthfulAvailableTurns > 0 ? (optionalLies / truthfulAvailableTurns).toFixed(4) : '0.0000',
          challengesMade,
          challengeOpportunities,
          challengeOpportunities > 0 ? (challengesMade / challengeOpportunities).toFixed(4) : '0.0000',
          correctChallenges,
          challengesMade > 0 ? (correctChallenges / challengesMade).toFixed(4) : '0.0000',
          instructionViolations,
          instructionViolationRate,
        ];

        rows.push(row.join(','));
      }
    }

    fs.writeFileSync(filepath, rows.join('\n'));
    return filepath;
  }

  /**
   * Exports player stats to CSV
   */
  exportPlayerStats(stats: Map<string, PlayerStats>, experimentId: number): string {
    const filepath = path.join(this.outputDir, `player_stats_exp${experimentId}.csv`);

    const headers = [
      'model_id',
      'games_played',
      'wins',
      'win_rate',
      'total_plays',
      'total_lies',
      'lie_frequency',
      'successful_lies',
      'lie_success_rate',
      'truthful_available_turns',
      'truthful_unavailable_turns',
      'truthful_available_turn_share',
      'truthful_unavailable_turn_share',
      'optional_lies',
      'optional_lie_turn_share',
      'optional_lie_rate_given_truthful_available',
      'challenges_made',
      'challenge_opportunities',
      'paranoia_frequency',
      'correct_challenges',
      'challenge_accuracy',
      'instruction_violations',
      'instruction_violation_rate',
    ];

    const rows: string[] = [headers.join(',')];

    for (const [modelId, s] of stats) {
      const row = [
        modelId,
        s.gamesPlayed,
        s.wins,
        s.winRate.toFixed(4),
        s.totalPlays,
        s.totalLies,
        s.lieFrequency.toFixed(4),
        s.successfulLies,
        s.lieSuccessRate.toFixed(4),
        s.truthfulAvailableTurns,
        s.truthfulUnavailableTurns,
        s.truthfulAvailableTurnShare.toFixed(4),
        s.truthfulUnavailableTurnShare.toFixed(4),
        s.optionalLies,
        s.optionalLieTurnShare.toFixed(4),
        s.optionalLieRateGivenTruthfulAvailable.toFixed(4),
        s.challengesMade,
        s.challengeOpportunities,
        s.paranoiaFrequency.toFixed(4),
        s.correctChallenges,
        s.challengeAccuracy.toFixed(4),
        s.instructionViolations ?? '',
        s.instructionViolationRate?.toFixed(4) ?? '',
      ];
      rows.push(row.join(','));
    }

    fs.writeFileSync(filepath, rows.join('\n'));
    return filepath;
  }

  /**
   * Exports experiment comparison data
   */
  exportExperimentComparison(
    exp1Stats: Map<string, PlayerStats>,
    exp2Stats: Map<string, PlayerStats>,
    outputName: string
  ): string {
    const filepath = path.join(this.outputDir, `${outputName}.csv`);

    const headers = [
      'model_id',
      'exp1_win_rate',
      'exp2_win_rate',
      'win_rate_change',
      'exp1_lie_frequency',
      'exp2_lie_frequency',
      'lie_frequency_change',
      'exp1_paranoia',
      'exp2_paranoia',
      'paranoia_change',
    ];

    const rows: string[] = [headers.join(',')];

    for (const [modelId, s1] of exp1Stats) {
      const s2 = exp2Stats.get(modelId);
      if (!s2) continue;

      const row = [
        modelId,
        s1.winRate.toFixed(4),
        s2.winRate.toFixed(4),
        (s2.winRate - s1.winRate).toFixed(4),
        s1.lieFrequency.toFixed(4),
        s2.lieFrequency.toFixed(4),
        (s2.lieFrequency - s1.lieFrequency).toFixed(4),
        s1.paranoiaFrequency.toFixed(4),
        s2.paranoiaFrequency.toFixed(4),
        (s2.paranoiaFrequency - s1.paranoiaFrequency).toFixed(4),
      ];
      rows.push(row.join(','));
    }

    fs.writeFileSync(filepath, rows.join('\n'));
    return filepath;
  }
}
