import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EvalCase, PromptMeta } from './types.ts';

/** The main set. Any other name is a separate set, scored and stored on its own. */
export const MAIN_SET = 'cases';

/**
 * Parse and validate <project>/evals/<set>.jsonl. Fails loudly on bad or duplicate cases.
 * `set` defaults to the main set; a held-out set is loaded by name and never merged with it.
 */
export async function loadCases(projectDir: string, set: string = MAIN_SET): Promise<EvalCase[]> {
  const file = join(projectDir, 'evals', `${caseSetName(set)}.jsonl`);
  const raw = await readFile(file, 'utf8');
  return parseCases(raw, file);
}

/**
 * A set name becomes a path segment, so it must not escape the evals directory or collide with
 * the run-file layout. Rejecting early beats writing results somewhere surprising.
 */
export function caseSetName(set: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(set)) {
    throw new Error(`invalid case set "${set}": use letters, digits and dashes`);
  }
  return set;
}

export function parseCases(raw: string, file = 'cases.jsonl'): EvalCase[] {
  const cases: EvalCase[] = [];
  const seen = new Set<string>();
  raw.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith('//')) return;
    let c: EvalCase;
    try {
      c = JSON.parse(t) as EvalCase;
    } catch (e) {
      throw new Error(`${file}:${i + 1}: invalid JSON (${(e as Error).message})`);
    }
    const where = `${file}:${i + 1}`;
    if (typeof c.id !== 'string' || !c.id) throw new Error(`${where}: missing "id"`);
    if (seen.has(c.id)) throw new Error(`${where}: duplicate id "${c.id}"`);
    if (typeof c.type !== 'string' || !c.type) throw new Error(`${where}: "${c.id}" missing "type"`);
    if (c.input === undefined) throw new Error(`${where}: "${c.id}" missing "input"`);
    if (!c.expect || typeof c.expect !== 'object') throw new Error(`${where}: "${c.id}" missing "expect" object`);
    seen.add(c.id);
    cases.push(c);
  });
  if (!cases.length) throw new Error(`${file}: no cases`);
  return cases;
}

/** Load prompts/<version>.md, splitting off its frontmatter. */
export async function loadPrompt(projectDir: string, version: string): Promise<{ body: string; meta: PromptMeta }> {
  if (!/^[\w.-]+$/.test(version)) throw new Error(`bad prompt version "${version}"`);
  const raw = await readFile(join(projectDir, 'prompts', `${version}.md`), 'utf8');
  return parsePrompt(raw, version);
}

export function parsePrompt(raw: string, version: string): { body: string; meta: PromptMeta } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta: PromptMeta = { version };
  if (!m) return { body: raw.trim(), meta };
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, k, v] = kv as unknown as [string, string, string];
    if (k === 'change') meta.change = v.trim();
    if (k === 'fixes') meta.fixes = v.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return { body: raw.slice(m[0].length).trim(), meta };
}
