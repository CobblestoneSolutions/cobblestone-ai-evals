import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CompleteRequest, CompleteResponse, LLMProvider } from '../types.ts';

/**
 * Record/replay wrapper. Every live response is saved under a hash of the exact request,
 * so a run can be re-graded later (new checks, fixed grader) without paying for it again,
 * and `--provider replay` reproduces a past run with zero network calls.
 */
export class CachingProvider implements LLMProvider {
  readonly name: string;
  constructor(
    private inner: LLMProvider | null,
    private dir: string,
    private defaultModel: string,
    /** false = always call the model (still records). Use to measure run-to-run variance. */
    private readCache = true,
  ) {
    this.name = inner ? `${inner.name}+cache` : 'replay';
  }

  static key(req: CompleteRequest, model: string): string {
    const canonical = JSON.stringify({
      model: req.model ?? model,
      system: req.system,
      messages: req.messages,
      maxTokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const file = join(this.dir, `${CachingProvider.key(req, this.defaultModel)}.json`);
    if (this.readCache || !this.inner) try {
      const hit = JSON.parse(await readFile(file, 'utf8')) as CompleteResponse;
      return { ...hit, cached: true };
    } catch {
      /* miss */
    }
    if (!this.inner) throw new Error(`replay: no cached response for this request (${file})`);
    const res = await this.inner.complete(req);
    await mkdir(this.dir, { recursive: true });
    await writeFile(file, JSON.stringify(res, null, 2));
    return res;
  }
}
