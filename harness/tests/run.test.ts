import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import example from '../../00-example/project.ts';
import { CachingProvider } from '../providers/cache.ts';
import { MockProvider } from '../providers/mock.ts';
import { renderReport, writeReport, loadRuns } from '../report.ts';
import { runEval } from '../run.ts';
import type { LLMProvider, Project } from '../types.ts';

const EXAMPLE = fileURLToPath(new URL('../../00-example', import.meta.url));

async function tmpProject() {
  const dir = await mkdtemp(join(tmpdir(), 'evals-'));
  await cp(join(EXAMPLE, 'prompts'), join(dir, 'prompts'), { recursive: true });
  await cp(join(EXAMPLE, 'evals', 'cases.jsonl'), join(dir, 'evals', 'cases.jsonl'), { recursive: true });
  return dir;
}

const base = (dir: string, llm: LLMProvider, v: string, project: Project = example as Project) => ({
  projectDir: dir, project, promptVersion: v, llm,
  judge: new MockProvider(() => '{"pass":true,"reason":"ok"}'),
  model: 'm', judgeModel: 'j', save: true,
});

test('full run → saved record → report shows the v1→v2 fix and verifies the claim', async () => {
  const dir = await tmpProject();
  try {
    const mock = new MockProvider(example.mock!.bind(example));
    const r1 = await runEval(base(dir, mock, 'v1'));
    const r2 = await runEval(base(dir, mock, 'v2'));
    assert.deepEqual([r1.totals.passed, r1.totals.cases, r1.totals.passRate], [3, 4, 75]);
    assert.equal(r2.totals.passRate, 100);
    assert.equal(r1.byType.escalate!.passRate, 0);
    assert.equal(r1.byCheck['actions']!.passRate, 0);
    assert.deepEqual(r1.results.map((x) => x.id), ['ex-01', 'ex-02', 'ex-03', 'ex-04'], 'results keep case order');

    await writeReport(dir);
    const md = await readFile(join(dir, 'evals', 'REPORT.md'), 'utf8');
    assert.match(md, /75% → 100%\. Fixed: ex-02\. Regressed: none\./);
    assert.match(md, /\| ex-02 \| ✅ passes \|/);
    assert.match(md, /## Open failures in v2 \(0\)/);
    assert.match(await readFile(join(dir, 'evals', 'chart.svg'), 'utf8'), /<svg[\s\S]*75%[\s\S]*100%/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('report flags a claimed fix that did not work, and regressions', async () => {
  const dir = await tmpProject();
  try {
    const mock = new MockProvider(example.mock!.bind(example));
    await runEval(base(dir, mock, 'v1'));
    // v2 whose model output never escalates → claimed fix fails; and hours answer breaks → regression.
    const broken = new MockProvider((req) => (String(req.messages[0]!.content).includes('hours') ? 'No idea' : example.mock!(req).replace('[[ESCALATE]]', '')));
    await runEval(base(dir, broken, 'v2'));
    const runs = await loadRuns(dir);
    const md = renderReport(runs, { v2: { version: 'v2', change: 'x', fixes: ['ex-02', 'ex-99'] } });
    assert.match(md, /\| ex-02 \| ❌ still failing \|/);
    assert.match(md, /\| ex-99 \| ⚠️ case not in run \|/);
    assert.match(md, /Regressed: ex-01/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a crashing system and a throwing check are recorded as failures, not skipped', async () => {
  const dir = await tmpProject();
  try {
    const project: Project = {
      name: 'crashy',
      async run(c) { if (c.id === 'ex-01') throw new Error('boom'); return { text: 'ok' }; },
      checks: [() => { throw new Error('bad check'); }],
    };
    const r = await runEval({ ...base(dir, new MockProvider(), 'v1', project), save: false });
    assert.equal(r.totals.passed, 0);
    assert.equal(r.totals.errors, 1);
    assert.equal(r.results[0]!.error, 'boom');
    assert.match(r.results[1]!.checks[0]!.detail!, /check threw: bad check/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a case with no applicable checks fails (no silent passes)', async () => {
  const dir = await tmpProject();
  try {
    const project: Project = { name: 'nochecks', async run() { return { text: 'x' }; }, checks: [] };
    const r = await runEval({ ...base(dir, new MockProvider(), 'v1', project), save: false, only: ['ex-01'] });
    assert.equal(r.totals.passed, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('--case with an unknown id is an error; partial runs honor only/limit', async () => {
  const dir = await tmpProject();
  try {
    const mock = new MockProvider(example.mock!.bind(example));
    await assert.rejects(runEval({ ...base(dir, mock, 'v1'), only: ['nope'] }), /unknown case id/);
    const r = await runEval({ ...base(dir, mock, 'v1'), save: false, limit: 2 });
    assert.equal(r.totals.cases, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('record/replay cache: live call recorded once, replay needs no network, miss throws', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cache-'));
  try {
    let calls = 0;
    const live = new MockProvider(() => { calls++; return 'hello'; });
    const rec = new CachingProvider(live, dir, 'm');
    const req = { system: 's', messages: [{ role: 'user' as const, content: 'q' }] };
    assert.equal((await rec.complete(req)).text, 'hello');
    assert.equal((await rec.complete(req)).cached, true);
    assert.equal(calls, 1);
    const replay = new CachingProvider(null, dir, 'm');
    assert.equal((await replay.complete(req)).text, 'hello');
    await assert.rejects(replay.complete({ ...req, system: 'other' }), /no cached response/);
    const fresh = new CachingProvider(live, dir, 'm', false);
    await fresh.complete(req);
    assert.equal(calls, 2, '--fresh bypasses cache reads');
    // Different model → different key.
    assert.notEqual(CachingProvider.key(req, 'a'), CachingProvider.key(req, 'b'));
    await writeFile(join(dir, 'x'), '');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
