/**
 * Mock LLMWrapper for unit testing Cloud Functions that call Gemini.
 *
 * Returns predefined responses so tests can run without a real API key.
 */

import type {
  LLMWrapperConfig,
  LLMCallMetadata,
  LLMCallOptions,
  LLMCallResult,
} from "../autograde/src/utils/llm";

export interface MockLLMResponse<T = unknown> {
  text?: string;
  parsed?: T | null;
  tokens?: { input: number; output: number; total: number };
  cost?: { input: number; output: number; total: number; currency: string };
  latencyMs?: number;
  model?: string;
}

/**
 * A drop-in replacement for LLMWrapper that returns canned responses.
 *
 * Usage:
 *   const mock = new MockLLMWrapper();
 *   mock.enqueue({ text: '{"questions":[]}' });
 *   // inject mock into the function under test
 */
export class MockLLMWrapper {
  public calls: Array<{ prompt: string; metadata: LLMCallMetadata; options?: LLMCallOptions }> = [];
  private responses: MockLLMResponse[] = [];
  private defaultResponse: MockLLMResponse = {
    text: "{}",
    parsed: null,
    tokens: { input: 100, output: 50, total: 150 },
    cost: { input: 0.001, output: 0.002, total: 0.003, currency: "USD" },
    latencyMs: 250,
    model: "gemini-2.5-flash",
  };

  constructor(_config?: LLMWrapperConfig) {
    // Config is accepted but ignored in mock
  }

  /** Queue a response to be returned by the next call(). */
  enqueue(response: MockLLMResponse): this {
    this.responses.push(response);
    return this;
  }

  /** Set the default response used when the queue is empty. */
  setDefault(response: MockLLMResponse): this {
    this.defaultResponse = { ...this.defaultResponse, ...response };
    return this;
  }

  async call<T = unknown>(
    prompt: string,
    metadata: LLMCallMetadata,
    options?: LLMCallOptions
  ): Promise<LLMCallResult<T>> {
    this.calls.push({ prompt, metadata, options });

    const queued = this.responses.shift() ?? this.defaultResponse;

    return {
      text: queued.text ?? this.defaultResponse.text!,
      parsed: (queued.parsed ?? null) as T | null,
      tokens: queued.tokens ?? this.defaultResponse.tokens!,
      cost: queued.cost ?? this.defaultResponse.cost!,
      latencyMs: queued.latencyMs ?? this.defaultResponse.latencyMs!,
      model: queued.model ?? this.defaultResponse.model!,
    };
  }

  /** How many times call() was invoked. */
  get callCount(): number {
    return this.calls.length;
  }

  /** Reset recorded calls and queued responses. */
  reset(): void {
    this.calls = [];
    this.responses = [];
  }
}
