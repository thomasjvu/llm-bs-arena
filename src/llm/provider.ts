import { LLMAdapter } from '../engine/turn-manager.js';
import {
  FeatherlessLLMAdapter,
  ChutesLLMAdapter,
  NimLLMAdapter,
  MockLLMAdapter,
  ScriptedBaselineAdapter,
} from './llm-adapter.js';
import { LocalPolicyLLMAdapter, isBaselineModelId } from '../baselines/index.js';
import { createFeatherlessClient } from './featherless-api.js';
import { createChutesClient } from './chutes-api.js';
import { createNimClient } from './nim-api.js';
import { RunMetadata } from '../types/game.js';
import { getPromptHash, PROMPT_VERSION } from './prompt-builder.js';
import { APIConnectionError as FeatherlessAPIConnectionError } from './featherless-api.js';
import { APIConnectionError as ChutesAPIConnectionError } from './chutes-api.js';
import { APIConnectionError as NimAPIConnectionError } from './nim-api.js';

export type Provider = 'nim' | 'chutes' | 'featherless' | 'mock';
export const LOG_SCHEMA_VERSION = 2;
export const SCRIPTED_BASELINE_PREFIX = 'baseline/';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_RECOVERY_WINDOW_MS = parsePositiveInt(process.env.LLM_RECOVERY_WINDOW_MS, 36_000_000);
const DEFAULT_RECOVERY_BACKOFF_MS = parsePositiveInt(process.env.LLM_RECOVERY_BACKOFF_MS, 30_000);

function createBaseAdapter(provider: Provider = 'nim'): LLMAdapter {
  switch (provider) {
    case 'mock':
      console.log('Using mock LLM adapter');
      return new MockLLMAdapter();
    case 'nim':
      if (!hasNimConfig()) {
        throw new Error('NVIDIA_API_KEY or NVIDIA_NIM_BASE_URL environment variable is required for nim provider');
      }
      console.log('Using NVIDIA NIM provider');
      return new NimLLMAdapter(createNimClient());
    case 'chutes':
      if (!process.env.CHUTES_API_TOKEN) {
        throw new Error('CHUTES_API_TOKEN environment variable is required for chutes provider');
      }
      console.log('Using Chutes API provider');
      return new ChutesLLMAdapter(createChutesClient());
    case 'featherless':
      if (!process.env.FEATHERLESS_API_KEY) {
        throw new Error('FEATHERLESS_API_KEY environment variable is required for featherless provider');
      }
      console.log('Using Featherless API provider');
      return new FeatherlessLLMAdapter(createFeatherlessClient());
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function usesScriptedBaseline(modelIds: readonly string[] = []): boolean {
  return modelIds.some((modelId) => isBaselineModelId(modelId) || modelId.startsWith(SCRIPTED_BASELINE_PREFIX));
}

class RoutedLLMAdapter implements LLMAdapter {
  constructor(
    private readonly remoteAdapter: LLMAdapter,
    private readonly scriptedBaselineAdapter: LLMAdapter = new LocalPolicyLLMAdapter()
  ) {}

  async getPlayDecision(
    playerId: string,
    modelId: string,
    visibleState: Parameters<LLMAdapter['getPlayDecision']>[2],
    experimentId: number,
    onToken?: (text: string) => void
  ) {
    const adapter = modelId.startsWith(SCRIPTED_BASELINE_PREFIX) ? this.scriptedBaselineAdapter : this.remoteAdapter;
    return adapter.getPlayDecision(playerId, modelId, visibleState, experimentId, onToken);
  }

  async getChallengeDecision(
    challengerId: string,
    modelId: string,
    visibleState: Parameters<LLMAdapter['getChallengeDecision']>[2],
    lastPlay: Parameters<LLMAdapter['getChallengeDecision']>[3],
    experimentId: number,
    onToken?: (text: string) => void
  ) {
    const adapter = modelId.startsWith(SCRIPTED_BASELINE_PREFIX) ? this.scriptedBaselineAdapter : this.remoteAdapter;
    return adapter.getChallengeDecision(challengerId, modelId, visibleState, lastPlay, experimentId, onToken);
  }
}

export function isRecoverableAdapterError(error: unknown): boolean {
  const errorStr = String(error);
  return error instanceof FeatherlessAPIConnectionError ||
    error instanceof ChutesAPIConnectionError ||
    error instanceof NimAPIConnectionError ||
    errorStr.includes('API connection unstable') ||
    errorStr.includes('TimeoutError') ||
    errorStr.includes('terminated');
}

export class ResilientLLMAdapter implements LLMAdapter {
  private adapter: LLMAdapter;

  constructor(
    private readonly createInnerAdapter: () => LLMAdapter,
    private readonly label: string,
    private readonly recoveryWindowMs: number = DEFAULT_RECOVERY_WINDOW_MS,
    private readonly reconnectDelayMs: number = DEFAULT_RECOVERY_BACKOFF_MS
  ) {
    this.adapter = createInnerAdapter();
  }

  async getPlayDecision(
    playerId: string,
    modelId: string,
    visibleState: Parameters<LLMAdapter['getPlayDecision']>[2],
    experimentId: number,
    onToken?: (text: string) => void
  ) {
    return this.runWithRecovery(() =>
      this.adapter.getPlayDecision(playerId, modelId, visibleState, experimentId, onToken)
    );
  }

  async getChallengeDecision(
    challengerId: string,
    modelId: string,
    visibleState: Parameters<LLMAdapter['getChallengeDecision']>[2],
    lastPlay: Parameters<LLMAdapter['getChallengeDecision']>[3],
    experimentId: number,
    onToken?: (text: string) => void
  ) {
    return this.runWithRecovery(() =>
      this.adapter.getChallengeDecision(challengerId, modelId, visibleState, lastPlay, experimentId, onToken)
    );
  }

  private async runWithRecovery<T>(operation: () => Promise<T>): Promise<T> {
    const recoveryDeadline = Date.now() + this.recoveryWindowMs;
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (!isRecoverableAdapterError(error)) {
          throw error;
        }

        const remainingMs = recoveryDeadline - Date.now();
        if (remainingMs <= 0) {
          console.error(`[adapter] Recovery window exhausted for ${this.label} after ${attempt} reconnect attempt(s).`);
          throw error;
        }

        attempt++;
        console.log(
          `[adapter] Recoverable connection issue for ${this.label}; recreating the client and retrying the same request ` +
          `(attempt ${attempt}, ${(remainingMs / 3_600_000).toFixed(2)}h recovery window remaining)...`
        );
        this.adapter = this.createInnerAdapter();
        const waitMs = Math.min(this.reconnectDelayMs, remainingMs);
        console.log(`[adapter] Waiting ${(waitMs / 1000).toFixed(1)}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
}

export function createAdapter(provider: Provider = 'nim', modelIds: readonly string[] = []): LLMAdapter {
  const baseAdapter =
    provider === 'mock'
      ? createBaseAdapter(provider)
      : new ResilientLLMAdapter(() => createBaseAdapter(provider), provider.toUpperCase());

  if (!usesScriptedBaseline(modelIds)) {
    return baseAdapter;
  }

  console.log('Enabling local scripted baseline routing for baseline/* model IDs');
  return new RoutedLLMAdapter(baseAdapter);
}

export function detectProvider(): Provider {
  const requestedProvider = process.env.LLM_PROVIDER as Provider | undefined;
  if (requestedProvider === 'mock') return 'mock';
  if (requestedProvider === 'nim' && hasNimConfig()) return 'nim';
  if (requestedProvider === 'chutes' && process.env.CHUTES_API_TOKEN) return 'chutes';
  if (requestedProvider === 'featherless' && process.env.FEATHERLESS_API_KEY) return 'featherless';

  if (hasNimConfig()) return 'nim';
  if (process.env.CHUTES_API_TOKEN) return 'chutes';
  if (process.env.FEATHERLESS_API_KEY) return 'featherless';
  return 'mock';
}

export function getProviderDisplayName(provider: Provider): string {
  switch (provider) {
    case 'nim':
      return 'NVIDIA NIM';
    case 'chutes':
      return 'Chutes API';
    case 'featherless':
      return 'Featherless API';
    case 'mock':
      return 'Mock LLM';
  }
}

export function buildRunMetadata(provider: Provider, modelIds: readonly string[] = []): RunMetadata {
  return {
    logSchemaVersion: LOG_SCHEMA_VERSION,
    provider: usesScriptedBaseline(modelIds) ? `${provider}+baseline` : provider,
    providerBaseUrl: getProviderBaseUrl(provider),
    promptVersion: PROMPT_VERSION,
    promptHash: getPromptHash(),
  };
}

function hasNimConfig(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_NIM_BASE_URL);
}

function getProviderBaseUrl(provider: Provider): string | undefined {
  switch (provider) {
    case 'nim':
      return process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
    case 'chutes':
      return 'https://llm.chutes.ai/v1';
    case 'featherless':
      return 'https://api.featherless.ai/v1';
    case 'mock':
      return undefined;
  }
}
