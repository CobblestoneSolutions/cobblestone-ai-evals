import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCases, parsePrompt } from '../load.ts';

test('parseCases reads valid JSONL and skips blanks/comments', () => {
  const cs = parseCases('{"id":"a","type":"t","input":"q","expect":{}}\n\n// note\n{"id":"b","type":"t","input":"q","expect":{}}\r\n');
  assert.deepEqual(cs.map((c) => c.id), ['a', 'b']);
});

test('parseCases rejects duplicates, missing fields, bad JSON, empty files', () => {
  assert.throws(() => parseCases('{"id":"a","type":"t","input":1,"expect":{}}\n{"id":"a","type":"t","input":1,"expect":{}}'), /duplicate id "a"/);
  assert.throws(() => parseCases('{"type":"t","input":1,"expect":{}}'), /missing "id"/);
  assert.throws(() => parseCases('{"id":"a","input":1,"expect":{}}'), /missing "type"/);
  assert.throws(() => parseCases('{"id":"a","type":"t","expect":{}}'), /missing "input"/);
  assert.throws(() => parseCases('{"id":"a","type":"t","input":1}'), /missing "expect"/);
  assert.throws(() => parseCases('{nope'), /invalid JSON/);
  assert.throws(() => parseCases('\n\n'), /no cases/);
});

test('parsePrompt splits frontmatter and reads change + fixes', () => {
  const { body, meta } = parsePrompt('---\nchange: add escalation\nfixes: [a-1, a-2]\n---\nYou are a bot.\n', 'v2');
  assert.equal(body, 'You are a bot.');
  assert.deepEqual(meta, { version: 'v2', change: 'add escalation', fixes: ['a-1', 'a-2'] });
  assert.equal(parsePrompt('plain', 'v1').body, 'plain');
});
