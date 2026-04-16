import { TokenUsage } from '../types/game.js';

export interface ChatCompletionResult {
  content: string;
  tokenUsage: TokenUsage;
  responseTimeMs: number;
  finishReason: string;
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

export interface NimClientConfig {
  apiKey?: string;
  baseUrl?: string;
}

const DEFAULT_CONFIG = {
  apiKey: process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || '',
  baseUrl: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  temperature: 0,
  seed: 42,
  maxRetries: 5,
  retryDelayMs: 1000,
  rateLimitDelayMs: 100,
  requestTimeoutMs: parsePositiveInt(process.env.NVIDIA_NIM_TIMEOUT_MS || process.env.LLM_REQUEST_TIMEOUT_MS, 180_000),
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

class NonRetryableAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableAPIError';
  }
}

export interface NimModelInfo {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  root?: string;
  parent?: string | null;
  max_model_len?: number | null;
}

export class NimClient {
  private config;
  private lastRequestTime: number = 0;
  private consecutiveFailures: number = 0;
  private lastFailureTime: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  constructor(config: Partial<typeof DEFAULT_CONFIG> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.config.apiKey && this.config.baseUrl === DEFAULT_CONFIG.baseUrl) {
      throw new Error('NVIDIA_API_KEY environment variable is required for hosted nim provider');
    }
  }

  resetConnection(): void {
    console.log('[nim] Resetting NVIDIA NIM connection state...');
    this.consecutiveFailures = 0;
    this.lastRequestTime = 0;
    this.lastFailureTime = 0;
  }

  needsReset(): boolean {
    return this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES;
  }

  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private isNonRetryableStatus(status: number): boolean {
    return status === 400 || status === 401 || status === 403 || status === 404 || status === 410;
  }

  private isRecoverableDegradedError(status: number, shortError: string): boolean {
    return status === 400 && /degraded function cannot be invoked/i.test(shortError);
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

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[nim] Retry ${attempt}/${this.config.maxRetries - 1} for ${this.modelLabel(modelId)}`);
        }
        console.log(`[nim] POST ${this.modelLabel(modelId)} (${messages.length} msgs, max_tokens=${maxTokens})`);
        const t0 = Date.now();

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: this.config.temperature,
            seed: this.config.seed,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const shortError = errorBody.substring(0, 200).replace(/<[^>]*>/g, '').trim();
          console.error(`[nim] HTTP ${response.status} from ${this.modelLabel(modelId)} (${Date.now() - t0}ms): ${shortError}`);

          if (response.status === 429) {
            const retryAfter = Math.max(parseInt(response.headers.get('Retry-After') || '10', 10), 10);
            console.log(`[nim] Rate limited, waiting ${retryAfter}s...`);
            await this.sleep(retryAfter * 1000);
            continue;
          }

          if (response.status === 502 || response.status === 503 || response.status === 504) {
            const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 2000;
            console.log(`[nim] Gateway error ${response.status}, waiting ${(backoff / 1000).toFixed(1)}s...`);
            await this.sleep(backoff);
            continue;
          }

          if (this.isRecoverableDegradedError(response.status, shortError)) {
            const backoff = 15_000 + Math.random() * 5000;
            console.log(`[nim] Degraded endpoint for ${this.modelLabel(modelId)}, waiting ${(backoff / 1000).toFixed(1)}s before retry...`);
            await this.sleep(backoff);
            continue;
          }

          if (this.isNonRetryableStatus(response.status)) {
            throw new NonRetryableAPIError(`API error ${response.status}: ${shortError}`);
          }

          throw new Error(`API error ${response.status}: ${shortError}`);
        }

        const data = (await response.json()) as ChatCompletionResponse;

        if (!data.choices || data.choices.length === 0) {
          console.error(`[nim] Empty choices from ${this.modelLabel(modelId)} (${Date.now() - t0}ms)`);
          throw new Error('No choices in response');
        }

        const content = data.choices[0].message.content;
        if (typeof content !== 'string' || content.trim().length === 0) {
          console.error(`[nim] Empty content from ${this.modelLabel(modelId)} (${Date.now() - t0}ms)`);
          throw new Error('No textual content in response');
        }
        const finishReason = data.choices[0].finish_reason || 'stop';
        const usage: TokenUsage = data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        const tokens = data.usage ? `${data.usage.prompt_tokens}+${data.usage.completion_tokens}tok` : 'no usage';
        const truncated = finishReason === 'length' ? ' [TRUNCATED]' : '';
        console.log(`[nim] OK ${this.modelLabel(modelId)} (${Date.now() - t0}ms, ${tokens}${truncated}) — ${this.previewContent(content)}…`);

        this.consecutiveFailures = 0;

        return { content, tokenUsage: usage, responseTimeMs: Date.now() - overallStart, finishReason };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError instanceof NonRetryableAPIError) {
          console.error(`[nim] Non-retryable error for ${this.modelLabel(modelId)}: ${lastError.message}`);
          throw lastError;
        }
        const msg = lastError.message.substring(0, 150);
        const isTerminated = msg.includes('terminated');
        const isTimeout = lastError.name === 'TimeoutError' || msg.includes('abort');

        if (isTerminated) {
          console.error(`[nim] Connection terminated for ${this.modelLabel(modelId)}`);
        } else if (isTimeout) {
          console.error(`[nim] Request timed out for ${this.modelLabel(modelId)}`);
        } else {
          console.error(`[nim] Error for ${this.modelLabel(modelId)}: ${msg}`);
        }

        this.consecutiveFailures++;
        this.lastFailureTime = Date.now();

        if (attempt < this.config.maxRetries - 1) {
          const baseBackoff = (isTerminated || isTimeout)
            ? 10_000 + Math.random() * 5000
            : this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
          console.log(`[nim] Waiting ${(baseBackoff / 1000).toFixed(1)}s before retry ${this.modelLabel(modelId)}...`);
          await this.sleep(baseBackoff);
        }
      }
    }

    console.error(
      `[nim] Exhausted ${this.config.maxRetries} in-client attempt(s) for ${this.modelLabel(modelId)}`
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

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[nim-stream] Retry ${attempt}/${this.config.maxRetries - 1} for ${this.modelLabel(modelId)}`);
        }
        console.log(`[nim-stream] POST ${this.modelLabel(modelId)} (${messages.length} msgs, max_tokens=${maxTokens})`);
        const t0 = Date.now();

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: this.config.temperature,
            seed: this.config.seed,
            max_tokens: maxTokens,
            stream: true,
            stream_options: { include_usage: true },
          }),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const shortError = errorBody.substring(0, 200).replace(/<[^>]*>/g, '').trim();
          console.error(`[nim-stream] HTTP ${response.status} from ${this.modelLabel(modelId)} (${Date.now() - t0}ms): ${shortError}`);

          if (response.status === 429) {
            const retryAfter = Math.max(parseInt(response.headers.get('Retry-After') || '10', 10), 10);
            console.log(`[nim-stream] Rate limited, waiting ${retryAfter}s...`);
            await this.sleep(retryAfter * 1000);
            continue;
          }

          if (response.status === 502 || response.status === 503 || response.status === 504) {
            const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 2000;
            console.log(`[nim-stream] Gateway error ${response.status}, waiting ${(backoff / 1000).toFixed(1)}s...`);
            await this.sleep(backoff);
            continue;
          }

          if (this.isRecoverableDegradedError(response.status, shortError)) {
            const backoff = 15_000 + Math.random() * 5000;
            console.log(`[nim-stream] Degraded endpoint for ${this.modelLabel(modelId)}, waiting ${(backoff / 1000).toFixed(1)}s before retry...`);
            await this.sleep(backoff);
            continue;
          }

          if (this.isNonRetryableStatus(response.status)) {
            throw new NonRetryableAPIError(`API error ${response.status}: ${shortError}`);
          }

          throw new Error(`API error ${response.status}: ${shortError}`);
        }

        const body = response.body;
        if (!body) throw new Error('No response body for stream');

        let fullContent = '';
        let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
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
        const tokens = `${usage.promptTokens}+${usage.completionTokens}tok`;
        const truncated = finishReason === 'length' ? ' [TRUNCATED]' : '';
        console.log(`[nim-stream] OK ${this.modelLabel(modelId)} (${elapsed}ms, ttft=${ttft}ms, ${tokens}${truncated})`);

        this.consecutiveFailures = 0;

        return { content: fullContent, tokenUsage: usage, responseTimeMs: Date.now() - overallStart, finishReason };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError instanceof NonRetryableAPIError) {
          console.error(`[nim-stream] Non-retryable error for ${this.modelLabel(modelId)}: ${lastError.message}`);
          throw lastError;
        }
        const msg = lastError.message.substring(0, 150);
        console.error(`[nim-stream] Error for ${this.modelLabel(modelId)}: ${msg}`);

        this.consecutiveFailures++;
        this.lastFailureTime = Date.now();

        if (attempt < this.config.maxRetries - 1) {
          const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
          console.log(`[nim-stream] Waiting ${(backoff / 1000).toFixed(1)}s before retry ${this.modelLabel(modelId)}...`);
          await this.sleep(backoff);
        }
      }
    }

    console.error(
      `[nim-stream] Exhausted ${this.config.maxRetries} in-client attempt(s) for ${this.modelLabel(modelId)}`
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

  async fetchAvailableModels(): Promise<NimModelInfo[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { data?: NimModelInfo[] };
      return data.data || [];
    } catch (error) {
      throw new Error(`Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export function createNimClient(config: NimClientConfig = {}): NimClient {
  return new NimClient({
    apiKey: config.apiKey || process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY,
    baseUrl: config.baseUrl || process.env.NVIDIA_NIM_BASE_URL || DEFAULT_CONFIG.baseUrl,
  });
}
