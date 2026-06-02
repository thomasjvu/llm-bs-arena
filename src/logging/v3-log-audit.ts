import * as fs from 'fs';
import * as path from 'path';
import { ChallengeDecision, DecisionTrace, GameLog, InvalidDecisionRecord, Turn } from '../types/game.js';
import { getPromptHash, PROMPT_VERSION } from '../llm/prompt-builder.js';
import { LOG_SCHEMA_VERSION } from '../llm/provider.js';
import { isBenchmarkCompleteGame } from './game-logger.js';

export interface V3LogAuditOptions {
  logsDir?: string;
  expectedSchemaVersion?: number;
  expectedPromptVersion?: string;
  expectedPromptHash?: string;
  requireCsv?: boolean;
}

export interface V3LogAuditResult {
  checkedGames: number;
  completeGames: number;
  invalidGames: number;
  errors: string[];
  warnings: string[];
}

const PUBLIC_HISTORY_FORBIDDEN_KEYS = new Set([
  'actualCards',
  'reasoning',
  'challengeReasoning',
  'playDecisionTrace',
  'decisionTrace',
  'rawResponse',
  'parsedResponse',
  'attempts',
  'systemPrompt',
  'userPrompt',
]);

function isHostedDecision(game: GameLog, modelId?: string): boolean {
  const provider = game.metadata?.provider || '';
  if (provider === 'mock' || provider.startsWith('mock+')) return false;
  if (modelId?.startsWith('baseline/')) return false;
  return true;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function forbiddenPublicHistoryPaths(value: unknown, prefix = 'recentTurns'): string[] {
  if (!value || typeof value !== 'object') return [];

  const paths: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      paths.push(...forbiddenPublicHistoryPaths(entry, `${prefix}[${index}]`));
    });
    return paths;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${prefix}.${key}`;
    if (PUBLIC_HISTORY_FORBIDDEN_KEYS.has(key)) {
      paths.push(childPath);
    }
    paths.push(...forbiddenPublicHistoryPaths(child, childPath));
  }

  return paths;
}

function visibleRecentTurns(trace: DecisionTrace | InvalidDecisionRecord | undefined): unknown {
  const visibleContext = trace?.visibleContext;
  if (!visibleContext || typeof visibleContext !== 'object') return undefined;
  return (visibleContext as { recentTurns?: unknown }).recentTurns;
}

function auditTrace(
  result: V3LogAuditResult,
  game: GameLog,
  turn: Turn,
  label: string,
  trace: DecisionTrace | undefined,
  timing: unknown,
  tokenUsageStatus: unknown
): void {
  const prefix = `${game.gameId} turn ${turn.turnNumber} ${label}`;

  if (!trace) {
    result.errors.push(`${prefix}: missing hosted decision trace`);
    return;
  }

  if (!hasValue(trace.systemPrompt)) result.errors.push(`${prefix}: missing system prompt`);
  if (!hasValue(trace.userPrompt)) result.errors.push(`${prefix}: missing user prompt`);
  if (!hasValue(trace.rawResponse)) result.errors.push(`${prefix}: missing raw response`);
  if (trace.parsedResponse === undefined) result.errors.push(`${prefix}: missing parsed response`);
  if (!Array.isArray(trace.attempts)) result.errors.push(`${prefix}: missing retry attempts`);
  if (typeof trace.retryCount !== 'number') result.errors.push(`${prefix}: missing retry count`);
  if (!hasValue(trace.finishReason)) result.errors.push(`${prefix}: missing finish reason`);
  if (typeof timing !== 'number') result.errors.push(`${prefix}: missing response timing`);
  if (tokenUsageStatus === undefined) result.errors.push(`${prefix}: missing token usage status`);
  if (!hasValue(trace.visibleContextHash)) result.errors.push(`${prefix}: missing visible context hash`);
  if (typeof trace.maxTokens !== 'number') result.errors.push(`${prefix}: missing max token cap`);
  if (typeof trace.estimatedPromptTokens !== 'number') result.errors.push(`${prefix}: missing estimated prompt tokens`);
  if (typeof trace.promptBudgetTokens !== 'number') result.errors.push(`${prefix}: missing prompt budget tokens`);
  if (trace.contextLimitExceeded !== false) result.errors.push(`${prefix}: expected contextLimitExceeded=false`);

  const leakedPaths = forbiddenPublicHistoryPaths(visibleRecentTurns(trace));
  for (const leakedPath of leakedPaths) {
    result.errors.push(`${prefix}: public history leaks ${leakedPath}`);
  }
}

function auditChallengeWindow(result: V3LogAuditResult, game: GameLog, turn: Turn): void {
  const offered = turn.challengeOfferedTo ?? [];
  const decisions = turn.challengeDecisions ?? [];
  const prefix = `${game.gameId} turn ${turn.turnNumber}`;
  const failedChallengeDecision =
    game.terminationReason === 'context_limit' &&
    game.invalidDecision?.decisionType === 'challenge' &&
    game.invalidDecision.turnNumber === turn.turnNumber;
  const expectedDecisions = failedChallengeDecision ? Math.max(0, offered.length - 1) : offered.length;

  if (decisions.length !== expectedDecisions) {
    result.errors.push(`${prefix}: challenge decisions (${decisions.length}) do not match expected decisions (${expectedDecisions})`);
  }
  if (failedChallengeDecision && game.invalidDecision?.playerId !== offered[offered.length - 1]) {
    result.errors.push(`${prefix}: context-limit challenger ${game.invalidDecision?.playerId} is not the last offered challenger`);
  }

  decisions.forEach((decision, index) => {
    if (decision.playerId !== offered[index]) {
      result.errors.push(`${prefix}: challenge decision ${index} belongs to ${decision.playerId}, expected ${offered[index]}`);
    }
    if (decision.decisionOrder !== index) {
      result.errors.push(`${prefix}: challenge decision ${index} has decisionOrder=${decision.decisionOrder}`);
    }
  });

  const challengeIndexes = decisions
    .map((decision, index) => ({ decision, index }))
    .filter(({ decision }) => decision.challenge);

  if (turn.challenged) {
    if (challengeIndexes.length !== 1) {
      result.errors.push(`${prefix}: challenged turn should have exactly one challenge=true decision`);
    } else {
      const { decision, index } = challengeIndexes[0];
      if (index !== decisions.length - 1) {
        result.errors.push(`${prefix}: challenge=true decision is not the last offered decision`);
      }
      if (turn.challengerId !== decision.playerId) {
        result.errors.push(`${prefix}: challengerId ${turn.challengerId} does not match challenge decision ${decision.playerId}`);
      }
    }
  } else if (challengeIndexes.length > 0) {
    result.errors.push(`${prefix}: unchallenged turn has challenge=true decision`);
  }
}

function auditChallengeTrace(result: V3LogAuditResult, game: GameLog, turn: Turn, decision: ChallengeDecision): void {
  if (!isHostedDecision(game, decision.modelId)) return;

  auditTrace(
    result,
    game,
    turn,
    `challenge ${decision.playerId}`,
    decision.decisionTrace,
    decision.responseTimeMs,
    decision.tokenUsageIncomplete
  );
}

function auditInvalidDecision(result: V3LogAuditResult, game: GameLog): void {
  const invalid = game.invalidDecision;
  if (!invalid) {
    result.errors.push(`${game.gameId}: ${game.terminationReason} game is missing invalidDecision`);
    return;
  }

  if (invalid.terminationReason !== game.terminationReason) {
    result.errors.push(`${game.gameId}: invalidDecision termination reason does not match game termination`);
  }
  if (!hasValue(invalid.errorMessage)) result.errors.push(`${game.gameId}: invalidDecision missing error message`);

  if (game.terminationReason === 'context_limit') {
    if (invalid.contextLimitExceeded !== true) result.errors.push(`${game.gameId}: context-limit invalidDecision not marked exceeded`);
    if (typeof invalid.estimatedPromptTokens !== 'number') result.errors.push(`${game.gameId}: context-limit invalidDecision missing estimate`);
    if (typeof invalid.promptBudgetTokens !== 'number') result.errors.push(`${game.gameId}: context-limit invalidDecision missing budget`);
    if (!hasValue(invalid.visibleContextHash)) result.errors.push(`${game.gameId}: context-limit invalidDecision missing visible context hash`);
    if (!hasValue(invalid.systemPrompt)) result.errors.push(`${game.gameId}: context-limit invalidDecision missing system prompt`);
    if (!hasValue(invalid.userPrompt)) result.errors.push(`${game.gameId}: context-limit invalidDecision missing user prompt`);
  }

  const leakedPaths = forbiddenPublicHistoryPaths(visibleRecentTurns(invalid));
  for (const leakedPath of leakedPaths) {
    result.errors.push(`${game.gameId}: invalidDecision public history leaks ${leakedPath}`);
  }
}

export function auditV3Logs(games: GameLog[], options: V3LogAuditOptions = {}): V3LogAuditResult {
  const result: V3LogAuditResult = {
    checkedGames: games.length,
    completeGames: 0,
    invalidGames: 0,
    errors: [],
    warnings: [],
  };

  const expectedSchemaVersion = options.expectedSchemaVersion ?? LOG_SCHEMA_VERSION;
  const expectedPromptVersion = options.expectedPromptVersion ?? PROMPT_VERSION;
  const expectedPromptHash = options.expectedPromptHash ?? getPromptHash();

  for (const game of games) {
    const schemaVersion = game.metadata?.logSchemaVersion;
    const promptVersion = game.metadata?.promptVersion;
    const promptHash = game.metadata?.promptHash;

    if (schemaVersion !== expectedSchemaVersion) {
      result.errors.push(`${game.gameId}: schema version ${schemaVersion ?? 'missing'} does not match ${expectedSchemaVersion}`);
    }
    if (promptVersion !== expectedPromptVersion) {
      result.errors.push(`${game.gameId}: prompt version ${promptVersion ?? 'missing'} does not match ${expectedPromptVersion}`);
    }
    if (promptHash !== expectedPromptHash) {
      result.errors.push(`${game.gameId}: prompt hash ${promptHash ?? 'missing'} does not match ${expectedPromptHash}`);
    }

    if (isBenchmarkCompleteGame(game)) {
      result.completeGames++;
    } else {
      result.invalidGames++;
      if (['context_limit', 'provider_error', 'parse_failure'].includes(game.terminationReason || '')) {
        auditInvalidDecision(result, game);
      }
    }

    for (const turn of game.turns) {
      const playModelId = turn.modelId || game.players.find((player) => player.id === turn.playerId)?.modelId;
      if (isHostedDecision(game, playModelId)) {
        auditTrace(
          result,
          game,
          turn,
          `play ${turn.playerId}`,
          turn.playDecisionTrace,
          turn.playResponseTimeMs,
          turn.playTokenUsageIncomplete
        );
      }

      auditChallengeWindow(result, game, turn);
      for (const decision of turn.challengeDecisions ?? []) {
        auditChallengeTrace(result, game, turn, decision);
      }
    }
  }

  if (options.requireCsv) {
    if (!options.logsDir) {
      result.errors.push('requireCsv was set but logsDir was not provided');
    } else {
      const csvPath = path.join(options.logsDir, 'csv', 'decision_log.csv');
      if (!fs.existsSync(csvPath)) {
        result.errors.push(`missing decision-log artifact: ${csvPath}`);
      }
    }
  }

  return result;
}
