import { createHash } from 'crypto';

export const DEFAULT_CONTEXT_BUDGET_TOKENS = 128_000;
export const MOCK_CONTEXT_BUDGET_TOKENS = 1_000_000;

export type DecisionType = 'play' | 'challenge';

export interface DecisionContextMetadata {
  decisionType: DecisionType;
  playerId: string;
  modelId: string;
  actingPlayerId?: string;
  actingModelId?: string;
  decisionOrder?: number;
}

export interface ContextLimitDetails extends DecisionContextMetadata {
  systemPrompt: string;
  userPrompt: string;
  visibleContext: unknown;
  visibleContextHash: string;
  estimatedPromptTokens: number;
  promptBudgetTokens: number;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function envNameForModel(modelId: string): string {
  return modelId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function stableContextHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function estimatePromptTokens(systemPrompt: string, userPrompt: string): number {
  return Math.ceil(`${systemPrompt}\n${userPrompt}`.length / 4);
}

export function resolveContextBudgetTokens(provider: string, modelId?: string, configuredBudget?: number): number {
  if (configuredBudget && Number.isFinite(configuredBudget) && configuredBudget > 0) {
    return configuredBudget;
  }

  const modelBudget = modelId
    ? parsePositiveInt(process.env[`LLM_CONTEXT_BUDGET_TOKENS_${envNameForModel(modelId)}`])
    : undefined;
  if (modelBudget) return modelBudget;

  const providerBudget = parsePositiveInt(process.env[`LLM_CONTEXT_BUDGET_TOKENS_${provider.toUpperCase()}`]);
  if (providerBudget) return providerBudget;

  const globalBudget = parsePositiveInt(process.env.LLM_CONTEXT_BUDGET_TOKENS);
  if (globalBudget) return globalBudget;

  return provider === 'mock' ? MOCK_CONTEXT_BUDGET_TOKENS : DEFAULT_CONTEXT_BUDGET_TOKENS;
}

export function resolveRunContextBudgetTokens(provider: string, modelIds: readonly string[] = []): number {
  const budgets = modelIds.length > 0
    ? modelIds.map((modelId) => resolveContextBudgetTokens(provider, modelId))
    : [resolveContextBudgetTokens(provider)];
  return Math.min(...budgets);
}

export class ContextLimitError extends Error {
  readonly details: ContextLimitDetails;

  constructor(details: ContextLimitDetails) {
    super(
      `Prompt for ${details.modelId} ${details.decisionType} decision is estimated at ` +
      `${details.estimatedPromptTokens} tokens, exceeding budget ${details.promptBudgetTokens}`
    );
    this.name = 'ContextLimitError';
    this.details = details;
    Object.setPrototypeOf(this, ContextLimitError.prototype);
  }
}

export function assertWithinContextBudget(
  metadata: DecisionContextMetadata,
  systemPrompt: string,
  userPrompt: string,
  visibleContext: unknown,
  promptBudgetTokens: number
): ContextLimitDetails {
  const estimatedPromptTokens = estimatePromptTokens(systemPrompt, userPrompt);
  const visibleContextHash = stableContextHash(visibleContext);
  const details: ContextLimitDetails = {
    ...metadata,
    systemPrompt,
    userPrompt,
    visibleContext,
    visibleContextHash,
    estimatedPromptTokens,
    promptBudgetTokens,
  };

  if (estimatedPromptTokens > promptBudgetTokens) {
    throw new ContextLimitError(details);
  }

  return details;
}
