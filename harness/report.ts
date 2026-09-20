import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadPrompt } from './load.ts';
import type { PromptMeta, RunRecord } from './types.ts';

/** Natural version order: v1 < v2 < v10. */
export const byVersion = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Main-set runs only: the files directly in evals/results/. Subdirectories are skipped, which is
 * what keeps archived runs and held-out sets (evals/results/<set>/) out of the headline score.
 * Reading entry types rather than trusting the extension means a *directory* named "x.json"
 * cannot sneak in either.
 */
export async function loadRuns(projectDir: string): Promise<RunRecord[]> {
  const dir = join(projectDir, 'evals', 'results');
  let files: string[] = [];
  try {
    files = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name);
  } catch {
    return [];
  }
  const runs = await Promise.all(files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8')) as RunRecord));
  return runs.sort((a, b) => byVersion(a.promptVersion, b.promptVersion));
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const pct = (n: number | undefined) => (n === undefined ? '—' : `${n}%`);

export function renderReport(runs: RunRecord[], metas: Record<string, PromptMeta>): string {
  if (!runs.length) return '# Eval report\n\nNo runs yet.\n';
  const latest = runs[runs.length - 1]!;
  const types = [...new Set(runs.flatMap((r) => Object.keys(r.byType)))].sort();
  const checks = [...new Set(runs.flatMap((r) => Object.keys(r.byCheck)))].sort();
  const out: string[] = [];

  out.push(`# ${latest.project} — eval report`, '');
  out.push('Every number below is computed from the run files in `evals/results/`. Regenerate with `npm run report -- <project>`.', '');
  out.push('![Pass rate by prompt version](chart.svg)', '');

  out.push('## Pass rate by prompt version', '');
  out.push(`| Version | Overall | ${types.join(' | ')} |`);
  out.push(`|---|---|${types.map(() => '---').join('|')}|`);
  for (const r of runs) {
    out.push(`| ${r.promptVersion} | **${pct(r.totals.passRate)}** (${r.totals.passed}/${r.totals.cases}) | ${types.map((t) => pct(r.byType[t]?.passRate)).join(' | ')} |`);
  }
  out.push('');

  out.push('## Metrics by check', '', 'Share of cases passing each check, among the cases the check applies to.', '');
  out.push(`| Check | ${runs.map((r) => r.promptVersion).join(' | ')} |`);
  out.push(`|---|${runs.map(() => '---').join('|')}|`);
  for (const ch of checks) out.push(`| ${ch} | ${runs.map((r) => pct(r.byCheck[ch]?.passRate)).join(' | ')} |`);
  out.push('');

  out.push('## What each prompt change did', '');
  for (let i = 0; i < runs.length; i++) {
    const cur = runs[i]!;
    const meta = metas[cur.promptVersion];
    out.push(`### ${cur.promptVersion}${meta?.change ? ` — ${meta.change}` : ''}`, '');
    if (i === 0) {
      out.push(`Baseline: ${cur.totals.passed}/${cur.totals.cases} passed.`, '');
      continue;
    }
    const prev = runs[i - 1]!;
    const before = new Map(prev.results.map((x) => [x.id, x.pass]));
    const fixed = cur.results.filter((x) => x.pass && before.get(x.id) === false).map((x) => x.id);
    const broke = cur.results.filter((x) => !x.pass && before.get(x.id) === true).map((x) => x.id);
    out.push(`${pct(prev.totals.passRate)} → ${pct(cur.totals.passRate)}. Fixed: ${fixed.join(', ') || 'none'}. Regressed: ${broke.join(', ') || 'none'}.`, '');
    if (meta?.fixes?.length) {
      const now = new Map(cur.results.map((x) => [x.id, x.pass]));
      out.push('| Claimed fix | Result |', '|---|---|');
      for (const id of meta.fixes) {
        const status = !now.has(id) ? '⚠️ case not in run' : now.get(id) ? '✅ passes' : '❌ still failing';
        out.push(`| ${id} | ${status} |`);
      }
      out.push('');
    }
  }

  const failures = latest.results.filter((x) => !x.pass);
  out.push(`## Open failures in ${latest.promptVersion} (${failures.length})`, '');
  if (!failures.length) out.push('None.', '');
  else {
    out.push('| Case | Type | Why it failed | Purpose |', '|---|---|---|---|');
    for (const f of failures) {
      const why = f.error ? `error: ${f.error}` : f.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.detail ?? 'failed'}`).join('; ');
      out.push(`| ${f.id} | ${f.type} | ${cell(why)} | ${cell(f.note ?? '')} |`);
    }
    out.push('');
  }

  out.push('## Run details', '', '| Version | Model | Judge | Provider | Commit | Tokens in/out | Finished |', '|---|---|---|---|---|---|---|');
  for (const r of runs) {
    out.push(`| ${r.promptVersion} | ${r.model} | ${r.judgeModel} | ${r.provider} | ${r.gitCommit ?? '—'} | ${r.usage.inputTokens}/${r.usage.outputTokens} | ${r.finishedAt.slice(0, 16).replace('T', ' ')} |`);
  }
  out.push('');
  return out.join('\n');
}

export function renderChart(runs: RunRecord[]): string {
  const W = 560, H = 260, padL = 44, padB = 36, padT = 20;
  const plotH = H - padB - padT;
  const n = Math.max(runs.length, 1);
  const slot = (W - padL - 16) / n;
  const bw = Math.min(64, slot * 0.6);
  /**
   * Coordinates are rounded to 2dp. Raw float output ("122.29999999999998") bloats the file, scan:allow
   * makes the diff churn between runs, and produces long digit runs that the privacy scanner
   * reads as a card number — which depends on the scores, so it fails on some runs and not others.
   */
  const n2 = (x: number) => String(Math.round(x * 100) / 100);
  const y = (v: number) => padT + plotH - (v / 100) * plotH;
  const grid = [0, 25, 50, 75, 100]
    .map((v) => `<line x1="${padL}" x2="${W - 8}" y1="${n2(y(v))}" y2="${n2(y(v))}" class="g"/><text x="${padL - 8}" y="${n2(y(v) + 4)}" text-anchor="end" class="t">${v}%</text>`)
    .join('');
  const bars = runs
    .map((r, i) => {
      const x = padL + i * slot + (slot - bw) / 2;
      const v = r.totals.passRate;
      return `<rect x="${n2(x)}" y="${n2(y(v))}" width="${n2(bw)}" height="${n2(y(0) - y(v))}" rx="3" class="b"/>` +
        `<text x="${n2(x + bw / 2)}" y="${n2(y(v) - 6)}" text-anchor="middle" class="v">${v}%</text>` +
        `<text x="${n2(x + bw / 2)}" y="${H - 14}" text-anchor="middle" class="t">${r.promptVersion}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Pass rate by prompt version">
<style>.g{stroke:#8883;stroke-width:1}.t{font:12px system-ui,sans-serif;fill:#777}.v{font:600 12px system-ui,sans-serif;fill:#777}.b{fill:#2f7d6d}</style>
${grid}${bars}
</svg>
`;
}

export async function writeReport(projectDir: string): Promise<{ runs: number }> {
  const runs = await loadRuns(projectDir);
  const metas: Record<string, PromptMeta> = {};
  for (const r of runs) {
    try {
      metas[r.promptVersion] = (await loadPrompt(projectDir, r.promptVersion)).meta;
    } catch {
      /* prompt file removed — report still renders from the run record */
    }
  }
  await writeFile(join(projectDir, 'evals', 'REPORT.md'), renderReport(runs, metas));
  await writeFile(join(projectDir, 'evals', 'chart.svg'), renderChart(runs));
  return { runs: runs.length };
}
