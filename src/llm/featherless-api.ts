import { FeatherlessConfig, TokenUsage } from '../types/game.js';

export interface ChatCompletionResult {
  content: string;
  tokenUsage: TokenUsage;
  responseTimeMs: number;
  finishReason: string; // 'stop' = natural end, 'length' = hit token limit
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
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const DEFAULT_CONFIG: FeatherlessConfig = {
  apiKey: process.env.FEATHERLESS_API_KEY || '',
  baseUrl: 'https://api.featherless.ai/v1',
  temperature: 0,
  seed: 42,
  maxRetries: 5,
  retryDelayMs: 1000,
  rateLimitDelayMs: 500,
};

/**
 * Custom error class for API failures that require connection reset
 */
export class APIConnectionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'APIConnectionError';
  }
}

/**
 * Client for the Featherless AI API
 */
export class FeatherlessClient {
  private config: FeatherlessConfig;
  private lastRequestTime: number = 0;
  private consecutiveFailures: number = 0;
  private lastFailureTime: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly FAILURE_RESET_MS = 60000; // Reset failure count after 1 minute

  constructor(config: Partial<FeatherlessConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.config.apiKey) {
      throw new Error('FEATHERLESS_API_KEY environment variable is required');
    }
  }

  /**
   * Resets the client state - call this when experiencing connection issues
   */
  resetConnection(): void {
    console.log('[api] Resetting API connection state...');
    this.consecutiveFailures = 0;
    this.lastRequestTime = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Check if the client needs a connection reset
   */
  needsReset(): boolean {
    return this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES;
  }

  /**
   * Sends a chat completion request (non-streaming)
   */
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
          console.log(`[api] Retry ${attempt}/${this.config.maxRetries - 1} for ${modelId}`);
        }
        console.log(`[api] POST ${modelId} (${messages.length} msgs, max_tokens=${maxTokens})`);
        const t0 = Date.now();

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: this.config.temperature,
            seed: this.config.seed,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(45_000),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const shortError = errorBody.substring(0, 200).replace(/<[^>]*>/g, '').trim();
          console.error(`[api] HTTP ${response.status} from ${modelId} (${Date.now() - t0}ms): ${shortError}`);

          if (response.status === 429) {
            const retryAfter = Math.max(parseInt(response.headers.get('Retry-After') || '10', 10), 10);
            console.log(`[api] Rate limited, waiting ${retryAfter}s...`);
            await this.sleep(retryAfter * 1000);
            continue;
          }

          if (response.status === 502 || response.status === 504) {
            const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 2000;
            console.log(`[api] Gateway error ${response.status}, waiting ${(backoff / 1000).toFixed(1)}s...`);
            await this.sleep(backoff);
            continue;
          }

          throw new Error(`API error ${response.status}: ${shortError}`);
        }

        const data = (await response.json()) as ChatCompletionResponse;

        if (!data.choices || data.choices.length === 0) {
          console.error(`[api] Empty choices from ${modelId} (${Date.now() - t0}ms)`);
          throw new Error('No choices in response');
        }

        const content = data.choices[0].message.content;
        const finishReason = data.choices[0].finish_reason || 'stop';
        const usage: TokenUsage = data.usage
          ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens }
          : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        const tokens = data.usage ? `${data.usage.prompt_tokens}+${data.usage.completion_tokens}tok` : 'no usage';
        const truncated = finishReason === 'length' ? ' [TRUNCATED]' : '';
        console.log(`[api] OK ${modelId} (${Date.now() - t0}ms, ${tokens}${truncated}) — ${content.substring(0, 80).replace(/\n/g, ' ')}…`);
        
        // Success - reset failure counter
        this.consecutiveFailures = 0;
        
        return { content, tokenUsage: usage, responseTimeMs: Date.now() - overallStart, finishReason };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const msg = lastError.message.substring(0, 150);
        const isTerminated = msg.includes('terminated');
        const isTimeout = lastError.name === 'TimeoutError' || msg.includes('abort');

        if (isTerminated) {
          console.error(`[api] Connection terminated for ${modelId}`);
        } else if (isTimeout) {
          console.error(`[api] Request timed out for ${modelId}`);
        } else {
          console.error(`[api] Error for ${modelId}: ${msg}`);
        }

        // Track consecutive failures
        this.consecutiveFailures++;
        this.lastFailureTime = Date.now();

        if (attempt < this.config.maxRetries - 1) {
          const baseBackoff = (isTerminated || isTimeout)
            ? 10_000 + Math.random() * 5000
            : this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
          console.log(`[api] Waiting ${(baseBackoff / 1000).toFixed(1)}s before retry...`);
          await this.sleep(baseBackoff);
        }
      }
    }

    console.error(`[api] FAILED after ${this.config.maxRetries} attempts for ${modelId}`);
    
    // If we've had too many consecutive failures, throw a connection error
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      throw new APIConnectionError(
        `API connection unstable after ${this.consecutiveFailures} consecutive failures`,
        lastError || undefined
      );
    }
    
    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Sends a streaming chat completion request.
   * Calls onToken for each text chunk as it arrives.
   * Returns the final assembled result.
   */
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
          console.log(`[api-stream] Retry ${attempt}/${this.config.maxRetries - 1} for ${modelId}`);
        }
        console.log(`[api-stream] POST ${modelId} (${messages.length} msgs, max_tokens=${maxTokens})`);
        const t0 = Date.now();

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: this.config.temperature,
            seed: this.config.seed,
            max_tokens: maxTokens,
            stream: true,
            stream_options: { include_usage: true },
          }),
          signal: AbortSignal.timeout(45_000),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const shortError = errorBody.substring(0, 200).replace(/<[^>]*>/g, '').trim();
          console.error(`[api-stream] HTTP ${response.status} from ${modelId} (${Date.now() - t0}ms): ${shortError}`);

          if (response.status === 429) {
            const retryAfter = Math.max(parseInt(response.headers.get('Retry-After') || '10', 10), 10);
            console.log(`[api-stream] Rate limited, waiting ${retryAfter}s...`);
            await this.sleep(retryAfter * 1000);
            continue;
          }

          if (response.status === 502 || response.status === 504) {
            const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 2000;
            console.log(`[api-stream] Gateway error ${response.status}, waiting ${(backoff / 1000).toFixed(1)}s...`);
            await this.sleep(backoff);
            continue;
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
          buffer = lines.pop()!; // keep incomplete last line

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
              // skip malformed chunks
            }
          }
        }

        const elapsed = Date.now() - t0;
        const ttft = firstTokenTime ? firstTokenTime - t0 : elapsed;
        const tokens = `${usage.promptTokens}+${usage.completionTokens}tok`;
        const truncated = finishReason === 'length' ? ' [TRUNCATED]' : '';
        console.log(`[api-stream] OK ${modelId} (${elapsed}ms, ttft=${ttft}ms, ${tokens}${truncated})`);

        // Success - reset failure counter
        this.consecutiveFailures = 0;
        
        return { content: fullContent, tokenUsage: usage, responseTimeMs: Date.now() - overallStart, finishReason };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const msg = lastError.message.substring(0, 150);
        console.error(`[api-stream] Error for ${modelId}: ${msg}`);

        // Track consecutive failures
        this.consecutiveFailures++;
        this.lastFailureTime = Date.now();

        if (attempt < this.config.maxRetries - 1) {
          const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
          console.log(`[api-stream] Waiting ${(backoff / 1000).toFixed(1)}s before retry...`);
          await this.sleep(backoff);
        }
      }
    }

    console.error(`[api-stream] FAILED after ${this.config.maxRetries} attempts for ${modelId}`);
    
    // If we've had too many consecutive failures, throw a connection error
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      throw new APIConnectionError(
        `API connection unstable after ${this.consecutiveFailures} consecutive failures`,
        lastError || undefined
      );
    }
    
    throw lastError || new Error('Stream request failed after retries');
  }

  /**
   * Enforces rate limiting between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.rateLimitDelayMs) {
      const wait = this.config.rateLimitDelayMs - timeSinceLastRequest;
      console.log(`[api] Rate limit: waiting ${wait}ms`);
      await this.sleep(wait);
    }

    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Creates a configured Featherless client
 */
export function createFeatherlessClient(apiKey?: string): FeatherlessClient {
  return new FeatherlessClient({
    apiKey: apiKey || process.env.FEATHERLESS_API_KEY,
  });
}
