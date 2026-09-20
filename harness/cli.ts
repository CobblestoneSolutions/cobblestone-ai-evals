import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { MAIN_SET } from './load.ts';
import { AnthropicProvider } from './providers/anthropic.ts';
import { CachingProvider } from './providers/cache.ts';
import { MockProvider } from './providers/mock.ts';
import { writeReport } from './report.ts';
import { runEval } from './run.ts';
import type { LLMProvider, Project } from './types.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  /* no .env — fine for mock/replay runs */
}

const USAGE = `Usage:
  npm run eval   -- <project> --prompt v1 [--cases <set>] [--provider anthropic|replay|mock] [--case id,id] [--limit n] [--concurrency n] [--fresh]
  npm run report -- <project>

  <project>  a project folder, e.g. 01-support-assistant

  --provider anthropic  live model calls, recorded to evals/cache (default)
             replay     re-grade from recorded responses only — no network, no cost
             mock       offline stand-in; results are printed but never saved
  --fresh    ignore recorded responses and call the model again
  --cases    case set to run (default: cases -> evals/cases.jsonl). Any other name loads
             evals/<set>.jsonl and saves to evals/results/<set>/, which the report leaves out
             of the main score — that is how a held-out set stays held out.
  Partial runs (--case / --limit) are printed but never saved, so a subset can't overwrite a full record.`;

/** Only direct child folders named NN-name are valid projects — no path traversal. */
function projectDir(name: string | undefined): string {
  if (!name || !/^\d{2}-[a-z0-9-]+$/.test(name)) throw new Error(`invalid project "${name ?? ''}"\n\n${USAGE}`);
  const dir = join(ROOT, name);
  if (!existsSync(join(dir, 'project.ts'))) throw new Error(`${name} has no project.ts yet`);
  return dir;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      prompt: { type: 'string' },
      provider: { type: 'string', default: 'anthropic' },
      case: { type: 'string' },
      cases: { type: 'string' },
      limit: { type: 'string' },
      concurrency: { type: 'string', default: '4' },
      fresh: { type: 'boolean', default: false },
    },
  });

  if (cmd === 'report') {
    const dir = projectDir(positionals[0]);
    const { runs } = await writeReport(dir);
    console.log(`Wrote ${positionals[0]}/evals/REPORT.md and chart.svg from ${runs} run(s).`);
    return;
  }
  if (cmd !== 'run') throw new Error(USAGE);

  const dir = projectDir(positionals[0]);
  if (!values.prompt) throw new Error(`--prompt is required\n\n${USAGE}`);
  const project = (await import(pathToFileURL(join(dir, 'project.ts')).href)).default as Project;

  const model = process.env.EVAL_MODEL || 'claude-haiku-4-5-20251001';
  const judgeModel = process.env.JUDGE_MODEL || 'claude-sonnet-4-5';
  const cacheDir = join(dir, 'evals', 'cache');
  let llm: LLMProvider;
  let judge: LLMProvider;
  switch (values.provider) {
    case 'anthropic':
      llm = new CachingProvider(new AnthropicProvider(model), cacheDir, model, !values.fresh);
      judge = new CachingProvider(new AnthropicProvider(judgeModel), cacheDir, judgeModel, !values.fresh);
      break;
    case 'replay':
      llm = new CachingProvider(null, cacheDir, model);
      judge = new CachingProvider(null, cacheDir, judgeModel);
      break;
    case 'mock':
      llm = new MockProvider(project.mock?.bind(project));
      judge = new MockProvider(() => '{"pass": true, "reason": "mock judge"}');
      break;
    default:
      throw new Error(`unknown provider "${values.provider}"`);
  }

  const only = values.case?.split(',').map((s) => s.trim()).filter(Boolean);
  const limit = values.limit ? Number(values.limit) : undefined;
  const partial = Boolean(only?.length || limit);
  const save = values.provider !== 'mock' && !partial;

  const record = await runEval({
    projectDir: dir,
    project,
    promptVersion: values.prompt,
    caseSet: values.cases,
    llm,
    judge,
    model: values.provider === 'mock' ? 'mock' : model,
    judgeModel: values.provider === 'mock' ? 'mock' : judgeModel,
    concurrency: Number(values.concurrency) || 4,
    only,
    limit,
    save,
    onCase: (r, done, total) => {
      const why = r.error ? ` — error: ${r.error}` : r.pass ? '' : ` — ${r.checks.filter((c) => !c.pass).map((c) => c.name).join(', ')}`;
      console.log(`[${String(done).padStart(3)}/${total}] ${r.pass ? 'PASS' : 'FAIL'} ${r.id} (${r.type})${why}`);
    },
  });

  const t = record.totals;
  console.log(`\n${record.project} ${record.promptVersion}: ${t.passed}/${t.cases} passed (${t.passRate}%), ${t.errors} error(s). Tokens ${record.usage.inputTokens} in / ${record.usage.outputTokens} out.`);
  for (const [type, s] of Object.entries(record.byType).sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${type.padEnd(18)} ${s.passed}/${s.cases} (${s.passRate}%)`);
  if (save) {
    const { runs } = await writeReport(dir);
    console.log(`\nSaved evals/results/${record.promptVersion}.json; report regenerated from ${runs} run(s).`);
  } else {
    console.log(`\n(not saved: ${values.provider === 'mock' ? 'mock provider' : 'partial run'})`);
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
