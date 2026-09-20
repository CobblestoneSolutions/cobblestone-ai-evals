import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JUDGE_VERSION } from './checks/judge.ts';
import { MAIN_SET, caseSetName, loadCases, loadPrompt } from './load.ts';
import type { CaseResult, CheckResult, EvalCase, LLMProvider, Project, RunRecord } from './types.ts';

export interface RunOptions {
  projectDir: string;
  project: Project;
  promptVersion: string;
  /** Case set to run. Defaults to the main set; a held-out set is named here. */
  caseSet?: string;
  llm: LLMProvider;
  judge: LLMProvider;
  model: string;
  judgeModel: string;
  concurrency?: number;
  /** Only run these case ids. */
  only?: string[];
  limit?: number;
  /** Write results/<version>.json. Off for partial runs so a subset never overwrites the record. */
  save?: boolean;
  onCase?: (r: CaseResult, done: number, total: number) => void;
}

export async function runEval(o: RunOptions): Promise<RunRecord> {
  const startedAt = new Date().toISOString();
  const caseSet = caseSetName(o.caseSet ?? MAIN_SET);
  let cases = await loadCases(o.projectDir, caseSet);
  if (o.only?.length) {
    const want = new Set(o.only);
    cases = cases.filter((c) => want.has(c.id));
    const missing = o.only.filter((id) => !cases.some((c) => c.id === id));
    if (missing.length) throw new Error(`unknown case id(s): ${missing.join(', ')}`);
  }
  if (o.limit) cases = cases.slice(0, o.limit);

  const { body: prompt } = await loadPrompt(o.projectDir, o.promptVersion);
  const base = { prompt, promptVersion: o.promptVersion, projectDir: o.projectDir };
  await o.project.prepare?.(base);

  const usage = { inputTokens: 0, outputTokens: 0 };
  const llm = countingProvider(o.llm, usage);
  const judge = countingProvider(o.judge, usage);

  const results: CaseResult[] = new Array(cases.length);
  let done = 0;
  await pool(cases, o.concurrency ?? 4, async (c, i) => {
    results[i] = await runOne(o.project, c, { ...base, llm }, judge);
    o.onCase?.(results[i]!, ++done, cases.length);
  });

  const record = summarize({
    project: o.project.name,
    caseSet,
    promptVersion: o.promptVersion,
    promptSha256: createHash('sha256').update(prompt).digest('hex'),
    model: o.model,
    judgeModel: o.judgeModel,
    judgeVersion: JUDGE_VERSION,
    provider: o.llm.name,
    startedAt,
    finishedAt: new Date().toISOString(),
    gitCommit: gitCommit(o.projectDir),
    usage,
    results,
  });

  if (o.save) {
    // Only the main set writes to results/. Every other set gets its own subdirectory, which
    // the report skips — that is what keeps a held-out score out of the headline number.
    const dir = caseSet === MAIN_SET
      ? join(o.projectDir, 'evals', 'results')
      : join(o.projectDir, 'evals', 'results', caseSet);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${o.promptVersion}.json`), JSON.stringify(record, null, 2) + '\n');
  }
  return record;
}

async function runOne(project: Project, c: EvalCase, ctx: Parameters<Project['run']>[1], judge: LLMProvider): Promise<CaseResult> {
  const t0 = Date.now();
  const base = { id: c.id, type: c.type, input: c.input, expect: c.expect, note: c.note };
  let output;
  try {
    output = await project.run(c, ctx);
  } catch (e) {
    // A crash is a failure of the system under test, recorded — never silently skipped.
    return { ...base, error: (e as Error).message, checks: [], pass: false, ms: Date.now() - t0 };
  }
  const checks: CheckResult[] = [];
  for (const check of project.checks) {
    try {
      const r = await check(c, output, { judge, grounding: project.grounding });
      if (r) checks.push(...(Array.isArray(r) ? r : [r]));
    } catch (e) {
      checks.push({ name: check.name || 'check', pass: false, detail: `check threw: ${(e as Error).message}` });
    }
  }
  const pass = checks.length > 0 && checks.every((r) => r.pass || r.critical === false);
  return { ...base, output, checks, pass, ms: Date.now() - t0 };
}

export function summarize(r: Omit<RunRecord, 'totals' | 'byType' | 'byCheck'>): RunRecord {
  const passed = r.results.filter((x) => x.pass).length;
  const errors = r.results.filter((x) => x.error).length;
  const byType: RunRecord['byType'] = {};
  const byCheck: RunRecord['byCheck'] = {};
  for (const x of r.results) {
    const t = (byType[x.type] ??= { cases: 0, passed: 0, passRate: 0 });
    t.cases++;
    if (x.pass) t.passed++;
    for (const ch of x.checks) {
      const b = (byCheck[ch.name] ??= { ran: 0, passed: 0, passRate: 0 });
      b.ran++;
      if (ch.pass) b.passed++;
    }
  }
  for (const t of Object.values(byType)) t.passRate = rate(t.passed, t.cases);
  for (const b of Object.values(byCheck)) b.passRate = rate(b.passed, b.ran);
  const n = r.results.length;
  return {
    ...r,
    totals: { cases: n, passed, failed: n - passed, errors, passRate: rate(passed, n) },
    byType,
    byCheck,
  };
}

const rate = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

function countingProvider(p: LLMProvider, usage: { inputTokens: number; outputTokens: number }): LLMProvider {
  return {
    name: p.name,
    async complete(req) {
      const res = await p.complete(req);
      if (!res.cached) {
        usage.inputTokens += res.inputTokens;
        usage.outputTokens += res.outputTokens;
      }
      return res;
    },
  };
}

async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
}

function gitCommit(cwd: string): string | undefined {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return undefined;
  }
}
