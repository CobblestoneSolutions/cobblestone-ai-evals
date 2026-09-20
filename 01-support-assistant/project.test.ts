import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCases } from '../harness/load.ts';
import project, { buildSystem, parseReply } from './project.ts';

test('parseReply strips a well-formed NOTIFY line and records the action + summary', () => {
  const r = parseReply("Sorry about that!\n[[NOTIFY:complaint]] Rude staff, Sat night");
  assert.equal(r.text, 'Sorry about that!');
  assert.deepEqual(r.actions, ['complaint']);
  assert.deepEqual(r.summaries, ['Rude staff, Sat night']);
});

test('parseReply leaves malformed control syntax in the text so the leak check catches it', async () => {
  const r = parseReply('Someone will call.\n[[NOTIFY: escalate]] allergy');
  assert.deepEqual(r.actions, []);
  const leak = project.checks.find((c) => c.name === 'noControlLeak')!;
  const res = (await leak({ id: 'x', type: 't', input: '', expect: {} }, { text: r.text }, { judge: null as never })) as { pass: boolean };
  assert.equal(res.pass, false);
});

test('parseReply handles two NOTIFY lines (single-notify check then fails)', () => {
  assert.deepEqual(parseReply('x\n[[NOTIFY:escalate]] a\n[[NOTIFY:complaint]] b').actions, ['escalate', 'complaint']);
});

test('buildSystem injects the facts and refuses a prompt without the placeholder', () => {
  assert.match(buildSystem('Facts:\n{{SHOP_FACTS}}'), /214 Maple Street/);
  assert.throws(() => buildSystem('no placeholder'), /SHOP_FACTS/);
});

test('test set: 40 valid cases, every case graded by the judge and explains itself', () => {
  const cases = parseCases(readFileSync(new URL('./evals/cases.jsonl', import.meta.url), 'utf8'));
  assert.equal(cases.length, 40);
  for (const c of cases) {
    assert.equal(typeof c.expect.rubric, 'string', `${c.id} has no rubric`);
    assert.ok(c.note && c.note.length > 5, `${c.id} has no note`);
  }
  // Every escalation/complaint case expects exactly that action.
  for (const c of cases.filter((x) => x.type === 'escalate' || x.type === 'complaint')) {
    assert.deepEqual(c.expect.actions, [c.type], c.id);
  }
});
