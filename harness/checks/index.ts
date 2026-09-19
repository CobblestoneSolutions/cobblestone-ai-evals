import type { Check, CheckResult, EvalCase, SystemOutput } from '../types.ts';
import { judgeCheck } from './judge.ts';

export { judgeCheck };

/**
 * Standard checks. Each reads a conventional key from case.expect and skips (returns null)
 * when that key is absent, so one check list can serve a whole mixed test set.
 *
 *   mustInclude:    string[]  — every entry must appear in the answer. "a|b" = either.
 *   mustNotInclude: string[]  — none may appear (hallucination / leak tripwires).
 *   citations:      string[]  — every listed id must be cited.
 *   actions:        string[]  — every listed action must have been taken.
 *   forbidActions:  string[]  — none of these actions may be taken (safety).
 *   fields:         Record<path, value|{approx:number,tol:number}> — structured output.
 */

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');

function list(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
}

export const mustInclude: Check = (c, out) => {
  const want = list(c.expect.mustInclude);
  if (!want) return null;
  const text = norm(out.text);
  const missing = want.filter((w) => !w.split('|').some((alt) => text.includes(norm(alt))));
  return { name: 'must-include', pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : undefined };
};

export const mustNotInclude: Check = (c, out) => {
  const bad = list(c.expect.mustNotInclude);
  if (!bad) return null;
  const text = norm(out.text);
  const found = bad.filter((b) => text.includes(norm(b)));
  return { name: 'must-not-include', pass: found.length === 0, detail: found.length ? `contains: ${found.join(', ')}` : undefined };
};

export const citesExpected: Check = (c, out) => {
  const want = list(c.expect.citations);
  if (!want) return null;
  const got = new Set((out.citations ?? []).map(norm));
  const missing = want.filter((w) => !got.has(norm(w)));
  return { name: 'citations', pass: missing.length === 0, detail: missing.length ? `not cited: ${missing.join(', ')} (got: ${[...got].join(', ') || 'none'})` : undefined };
};

export const tookActions: Check = (c, out) => {
  const want = list(c.expect.actions);
  if (!want) return null;
  const got = new Set(out.actions ?? []);
  const missing = want.filter((w) => !got.has(w));
  return { name: 'actions', pass: missing.length === 0, detail: missing.length ? `did not: ${missing.join(', ')} (did: ${[...got].join(', ') || 'nothing'})` : undefined };
};

export const forbiddenActions: Check = (c, out) => {
  const bad = list(c.expect.forbidActions);
  if (!bad) return null;
  const done = (out.actions ?? []).filter((a) => bad.includes(a));
  return { name: 'blocked-unsafe', pass: done.length === 0, detail: done.length ? `took forbidden action: ${done.join(', ')}` : undefined };
};

/** Read "a.b[2].c" from an object. */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function fieldMatches(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === 'object' && 'approx' in expected) {
    const { approx, tol = 0.005 } = expected as { approx: number; tol?: number };
    const n = typeof actual === 'string' ? Number(actual) : actual;
    return typeof n === 'number' && Number.isFinite(n) && Math.abs(n - approx) <= tol;
  }
  if (typeof expected === 'string' && typeof actual === 'string') return norm(actual).trim() === norm(expected).trim();
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/** One CheckResult per expected field, so per-field accuracy shows up in byCheck. */
export const fieldChecks: Check = (c: EvalCase, out: SystemOutput): CheckResult[] | null => {
  const fields = c.expect.fields;
  if (!fields || typeof fields !== 'object') return null;
  return Object.entries(fields as Record<string, unknown>).map(([path, expected]) => {
    const actual = getPath(out.data, path);
    const pass = fieldMatches(actual, expected);
    return { name: `field:${path.replace(/\[\d+\]/g, '[]')}`, pass, detail: pass ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
  });
};

export const standardChecks: Check[] = [mustInclude, mustNotInclude, citesExpected, tookActions, forbiddenActions];
