import { TokenUsage } from '../types/game.js';

export interface ChatCompletionResult {
  content: string;
  tokenUsage?: TokenUsage;
  responseTimeMs: number;
  finishReason: string;
  providerKeyAlias?: string;
  providerRequestAttempt?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface VeniceKeyEntry {
  alias: string;
  apiKey: string;
}

export interface VeniceClientConfig {
  baseUrl?: string;
  keys?: VeniceKeyEntry[];
}

const DEFAULT_BASE_URL = 'https://api.venice.ai/api/v1';

const DEFAULT_CONFIG = {
  baseUrl: process.env.VENICE_BASE_URL || DEFAULT_BASE_URL,
  temperature: 0,
  seed: 42,
  maxRetries: 5,
  retryDelayMs: 1000,
  rateLimitDelayMs: 100,
  requestTimeoutMs: parsePositiveInt(process.env.VENICE_TIMEOUT_MS || process.env.LLM_REQUEST_TIMEOUT_MS, 180_000),
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class APIConnectionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'APIConnectionError';
  }
}

export class NonRetryableAPIError extends Error {
  constructor(public readonly status: number, public readonly shortError: string) {
    super(`API error ${status}: ${shortError}`);
    this.name = 'NonRetryableAPIError';
  }
}

export function parseVeniceKeyEntries(
  keysValue: string | undefined = process.env.VENICE_API_KEYS,
  singleKeyValue: string | undefined = process.env.VENICE_API_KEY
): VeniceKeyEntry[] {
  const entries: VeniceKeyEntry[] = [];

  if (keysValue?.trim()) {
    for (const rawEntry of keysValue.split(',')) {
      const entry = rawEntry.trim();
      if (!entry) continue;

      const separatorIndex = entry.indexOf(':');
      if (separatorIndex <= 0 || separatorIndex >= entry.length - 1) {
        throw new Error(
          'VENICE_API_KEYS entries must use alias:key format, e.g. acct1:venice-...'
        );
      }

      const alias = entry.slice(0, separatorIndex).trim();
      const apiKey = entry.slice(separatorIndex + 1).trim();
      if (!alias || !apiKey) {
        throw new Error('VENICE_API_KEYS entries must include both alias and key');
      }

      entries.push({ alias, apiKey });
    }
  }

  if (entries.length === 0 && singleKeyValue?.trim()) {
    entries.push({ alias: 'default', apiKey: singleKeyValue.trim() });
  }

  return entries;
}

export class VeniceKeyPool {
  private nextIndex = 0;

  constructor(private readonly keys: VeniceKeyEntry[]) {
    if (keys.length === 0) {
      throw new Error('At least one Venice API key is required');
    }
  }

  get size(): number {
    return this.keys.length;
  }

  get aliases(): string[] {
    return this.keys.map((entry) => entry.alias);
  }

  selectNext(): VeniceKeyEntry {
    const entry = this.keys[this.nextIndex % this.keys.length];
    this.nextIndex = (this.nextIndex + 1) % this.keys.length;
    return entry;
  }

  rotateAfterRateLimit(currentAlias: string): VeniceKeyEntry {
    const currentIndex = this.keys.findIndex((entry) => entry.alias === currentAlias);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % this.keys.length : this.nextIndex;
    this.nextIndex = (nextIndex + 1) % this.keys.length;
    return this.keys[nextIndex];
  }
}

export class VeniceClient {
  private config;
  private readonly keyPool: VeniceKeyPool;
  private lastRequestTime: number = 0;
  private consecutiveFailures: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  constructor(config: Partial<typeof DEFAULT_CONFIG> & { keyPool?: VeniceKeyPool } = {}) {
    const keyPool = config.keyPool ?? new VeniceKeyPool(parseVeniceKeyEntries());
    this.keyPool = keyPool;
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.keyPool.size === 0) {
      throw new Error('VENICE_API_KEYS or VENICE_API_KEY environment variable is required for venice provider');
    }
  }

  get keyAliases(): string[] {
    return this.keyPool.aliases;
  }

  resetConnection(): void {
    console.log('[venice] Resetting Venice connection state...');
    this.consecutiveFailures = 0;
    this.lastRequestTime = 0;
  }

  needsReset(): boolean {
    return this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES;
  }

  private buildHeaders(apiKey: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }

  private isNonRetryableStatus(status: number, shortError: string): boolean {
    if (status === 401 || status === 402 || status === 403 || status === 404) {
      return true;
    }

    if (status === 400) {
      return (
        /invalid model/i.test(shortError) ||
        /model not found/i.test(shortError) ||
        /context_length_exceeded/i.test(shortError) ||
        /too_many_tokens/i.test(shortError) ||
        /maximum context/i.test(shortError) ||
        /insufficient/i.test(shortError) ||
        /spend limit exceeded/i.test(shortError)
      );
    }

    return false;
  }

  private previewContent(content: string): string {
    return content.substring(0, 80).replace(/\n/g, ' ');
  }

  private modelLabel(modelId: string): string {
    return modelId;
  }

  async chatCompletion(
    modelId: string,
    messages: ChatMessage[],
    maxTokens: number = 4096
  ): Promise<ChatCompletionResult> {
    await this.enforceRateLimit();

    let lastError: Error | null = null;
    const overallStart = Date.now();
    let activeKey = this.keyPool.selectNext();

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `[venice] Retry ${attempt}/${this.config.maxRetries - 1} for ${this.modelLabel(modelId)} ` +
            `(key=${activeKey.alias})`
          );
        }
        console.log(
          `[venice] POST ${this.modelLabel(modelId)} (${messages.length} msgs, ` +
          `max_completion_tokens=${maxTokens}, key=${activeKey.alias})`
        );
        const t0 = Date.now();

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.buildHeaders(activeKey.apiKey),
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: this.config.temperature,
            seed: this.config.seed,
            max_completion_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const shortError = errorBody.substring(0, 200).replace(/<[^>]*>/g, '').trim();
          console.error(
            `[venice] HTTP ${response.status} from ${this.modelLabel(modelId)} ` +
            `(key=${activeKey.alias}, ${Date.now() - t0}ms): ${shortError}`
          );

          if (response.status === 429) {
            const retryAfter = Math.max(parseInt(response.headers.get('Retry-After') || '10', 10), 10);
            if (this.keyPool.size > 1) {
              const limitedAlias = activeKey.alias;
              activeKey = this.keyPool.rotateAfterRateLimit(activeKey.alias);
              console.log(
                `[venice] Rate limited on ${limitedAlias}, rotating to ${activeKey.alias} and waiting ${retryAfter}s...`
              );
            } else {
              console.log(`[venice] Rate limited, waiting ${retryAfter}s...`);
            }
            await this.sleep(retryAfter * 1000);
            continue;
          }

          if (response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504) {
            const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 2000;
            console.log(`[venice] Gateway error ${response.status}, waiting ${(backoff / 1000).toFixed(1)}s...`);
            await this.sleep(backoff);
            continue;
          }

          if (this.isNonRetryableStatus(response.status, shortError)) {
            throw new NonRetryableAPIError(response.status, shortError);
          }

          throw new Error(`API error ${response.status}: ${shortError}`);
        }

        const data = (await response.json()) as ChatCompletionResponse;

        if (!data.choices || data.choices.length === 0) {
          console.error(`[venice] Empty choices from ${this.modelLabel(modelId)} (${Date.now() - t0}ms)`);
          throw new Error('No choices in response');
        }

        const content = data.choices[0].message.content;
        if (typeof content !== 'string' || content.trim().length === 0) {
          console.error(`[venice] Empty content from ${this.modelLabel(modelId)} (${Date.now() - t0}ms)`);
          throw new Error('No textual content in response');
        }
        const finishReason = data.choices[0].finish_reason || 'stop';
        const usage: TokenUsage | undefined = data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined;
        const tokens = data.usage ? `${data.usage.prompt_tokens}+${data.usage.completion_tokens}tok` : 'no usage';
        const truncated = finishReason === 'length' ? ' [TRUNCATED]' : '';
        console.log(
          `[venice] OK ${this.modelLabel(modelId)} (key=${activeKey.alias}, ${Date.now() - t0}ms, ` +
          `${tokens}${truncated}) — ${this.previewContent(content)}…`
        );

        this.consecutiveFailures = 0;

        return {
          content,
          tokenUsage: usage,
          responseTimeMs: Date.now() - overallStart,
          finishReason,
          providerKeyAlias: activeKey.alias,
          providerRequestAttempt: attempt + 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError instanceof NonRetryableAPIError) {
          console.error(
            `[venice] Non-retryable error for ${this.modelLabel(modelId)} (key=${activeKey.alias}): ` +
            `${lastError.message}`
          );
          throw lastError;
        }
        const msg = lastError.message.substring(0, 150);
        const isTerminated = msg.includes('terminated');
        const isTimeout = lastError.name === 'TimeoutError' || msg.includes('abort');

        if (isTerminated) {
          console.error(`[venice] Connection terminated for ${this.modelLabel(modelId)} (key=${activeKey.alias})`);
        } else if (isTimeout) {
          console.error(`[venice] Request timed out for ${this.modelLabel(modelId)} (key=${activeKey.alias})`);
        } else {
          console.error(`[venice] Error for ${this.modelLabel(modelId)} (key=${activeKey.alias}): ${msg}`);
        }

        this.consecutiveFailures++;

        if (attempt < this.config.maxRetries - 1) {
          const baseBackoff = (isTerminated || isTimeout)
            ? 10_000 + Math.random() * 5000
            : this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
          console.log(
            `[venice] Waiting ${(baseBackoff / 1000).toFixed(1)}s before retry ${this.modelLabel(modelId)}...`
          );
          await this.sleep(baseBackoff);
        }
      }
    }

    console.error(
      `[venice] Exhausted ${this.config.maxRetries} in-client attempt(s) for ${this.modelLabel(modelId)}`
    );

    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      throw new APIConnectionError(
        `API connection unstable after ${this.consecutiveFailures} consecutive failures`,
        lastError || undefined
      );
    }

    throw lastError || new Error('Request failed after retries');
  }

  async chatCompletionStream(
    modelId: string,
    messages: ChatMessage[],
    onToken: (text: string) => void,
    maxTokens: number = 4096
  ): Promise<ChatCompletionResult> {
    await this.enforceRateLimit();

    let lastError: Error | null = null;
    const overallStart = Date.now();
    let activeKey = this.keyPool.selectNext();

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `[venice-stream] Retry ${attempt}/${this.config.maxRetries - 1} for ${this.modelLabel(modelId)} ` +
            `(key=${activeKey.alias})`
          );
        }
        console.log(
          `[venice-stream] POST ${this.modelLabel(modelId)} (${messages.length} msgs, ` +
          `max_completion_tokens=${maxTokens}, key=${activeKey.alias})`
        );
        const t0 = Date.now();

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.buildHeaders(activeKey.apiKey),
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: this.config.temperature,
            seed: this.config.seed,
            max_completion_tokens: maxTokens,
            stream: true,
            stream_options: { include_usage: true },
          }),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const shortError = errorBody.substring(0, 200).replace(/<[^>]*>/g, '').trim();
          console.error(
            `[venice-stream] HTTP ${response.status} from ${this.modelLabel(modelId)} ` +
            `(key=${activeKey.alias}, ${Date.now() - t0}ms): ${shortError}`
          );

          if (response.status === 429) {
            const retryAfter = Math.max(parseInt(response.headers.get('Retry-After') || '10', 10), 10);
            if (this.keyPool.size > 1) {
              activeKey = this.keyPool.rotateAfterRateLimit(activeKey.alias);
            }
            console.log(`[venice-stream] Rate limited, waiting ${retryAfter}s...`);
            await this.sleep(retryAfter * 1000);
            continue;
          }

          if (response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504) {
            const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 2000;
            console.log(`[venice-stream] Gateway error ${response.status}, waiting ${(backoff / 1000).toFixed(1)}s...`);
            await this.sleep(backoff);
            continue;
          }

          if (this.isNonRetryableStatus(response.status, shortError)) {
            throw new NonRetryableAPIError(response.status, shortError);
          }

          throw new Error(`API error ${response.status}: ${shortError}`);
        }

        const body = response.body;
        if (!body) throw new Error('No response body for stream');

        let fullContent = '';
        let usage: TokenUsage | undefined;
        let finishReason = 'stop';
        let firstTokenTime: number | null = null;

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop()!;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta;

              if (delta?.content) {
                if (!firstTokenTime) firstTokenTime = Date.now();
                fullContent += delta.content;
                onToken(delta.content);
              }

              if (chunk.choices?.[0]?.finish_reason) {
                finishReason = chunk.choices[0].finish_reason;
              }

              if (chunk.usage) {
                usage = {
                  promptTokens: chunk.usage.prompt_tokens || 0,
                  completionTokens: chunk.usage.completion_tokens || 0,
                  totalTokens: chunk.usage.total_tokens || 0,
                };
              }
            } catch {
              // Skip malformed chunks.
            }
          }
        }

        const elapsed = Date.now() - t0;
        const ttft = firstTokenTime ? firstTokenTime - t0 : elapsed;
        const tokens = usage ? `${usage.promptTokens}+${usage.completionTokens}tok` : 'no usage';
        const truncated = finishReason === 'length' ? ' [TRUNCATED]' : '';
        console.log(
          `[venice-stream] OK ${this.modelLabel(modelId)} (key=${activeKey.alias}, ${elapsed}ms, ` +
          `ttft=${ttft}ms, ${tokens}${truncated})`
        );

        this.consecutiveFailures = 0;

        return {
          content: fullContent,
          tokenUsage: usage,
          responseTimeMs: Date.now() - overallStart,
          finishReason,
          providerKeyAlias: activeKey.alias,
          providerRequestAttempt: attempt + 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError instanceof NonRetryableAPIError) {
          console.error(
            `[venice-stream] Non-retryable error for ${this.modelLabel(modelId)} (key=${activeKey.alias}): ` +
            `${lastError.message}`
          );
          throw lastError;
        }
        const msg = lastError.message.substring(0, 150);
        console.error(`[venice-stream] Error for ${this.modelLabel(modelId)} (key=${activeKey.alias}): ${msg}`);

        this.consecutiveFailures++;

        if (attempt < this.config.maxRetries - 1) {
          const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
          console.log(
            `[venice-stream] Waiting ${(backoff / 1000).toFixed(1)}s before retry ${this.modelLabel(modelId)}...`
          );
          await this.sleep(backoff);
        }
      }
    }

    console.error(
      `[venice-stream] Exhausted ${this.config.maxRetries} in-client attempt(s) for ${this.modelLabel(modelId)}`
    );

    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      throw new APIConnectionError(
        `API connection unstable after ${this.consecutiveFailures} consecutive failures`,
        lastError || undefined
      );
    }

    throw lastError || new Error('Stream request failed after retries');
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.rateLimitDelayMs) {
      const wait = this.config.rateLimitDelayMs - timeSinceLastRequest;
      await this.sleep(wait);
    }

    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createVeniceClient(config: VeniceClientConfig = {}): VeniceClient {
  const keyPool = config.keys ? new VeniceKeyPool(config.keys) : undefined;
  return new VeniceClient({
    baseUrl: config.baseUrl || process.env.VENICE_BASE_URL || DEFAULT_BASE_URL,
    keyPool,
  });
}