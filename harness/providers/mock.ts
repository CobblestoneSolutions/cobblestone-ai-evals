import type { CompleteRequest, CompleteResponse, LLMProvider } from '../types.ts';

/** Deterministic offline provider. Never touches the network. */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';
  constructor(private respond: (req: CompleteRequest) => string = () => 'MOCK RESPONSE') {}

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const text = this.respond(req);
    return { text, model: req.model ?? 'mock', inputTokens: 0, outputTokens: 0 };
  }
}
