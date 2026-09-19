import Anthropic from '@anthropic-ai/sdk';
import type { CompleteRequest, CompleteResponse, LLMProvider } from '../types.ts';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(private defaultModel: string, apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add a dedicated eval key, or run with --provider mock.');
    }
    // SDK retries 429/5xx with backoff.
    this.client = new Anthropic({ apiKey, maxRetries: 4 });
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const model = req.model ?? this.defaultModel;
    const res = await this.client.messages.create({
      model,
      system: req.system,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
      messages: req.messages as Anthropic.MessageParam[],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return { text, model: res.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
  }
}
