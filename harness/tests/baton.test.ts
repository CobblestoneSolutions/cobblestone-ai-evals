import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describe, isFree, parseBaton, renderBaton, type BatonState } from '../../scripts/baton.ts';

const mk = (over: Partial<BatonState> = {}): BatonState =>
  ({ holder: 'claude-code', since: '2026-09-19T14:02Z', task: 'write v2 prompt', log: [], ...over });

test('parse reads the fields out of a rendered baton', () => {
  const s = parseBaton(renderBaton(mk()));
  assert.equal(s.holder, 'claude-code');
  assert.equal(s.since, '2026-09-19T14:02Z');
  assert.equal(s.task, 'write v2 prompt');
});

test('render/parse round-trips the log', () => {
  const log = ['- 2026-09-19T14:02Z  vscode-opus -> claude-code — handing over', '- 2026-09-19T15:00Z  claude-code dropped the baton — done'];
  assert.deepEqual(parseBaton(renderBaton(mk({ log }))).log, log);
});

test('a missing or empty holder reads as free', () => {
  assert.equal(isFree(parseBaton(renderBaton(mk({ holder: '(free)' })))), true);
  assert.equal(isFree(parseBaton('holder:\nsince:\ntask:')), true);
  assert.equal(isFree(parseBaton('nothing here at all')), true);
  assert.equal(isFree(mk()), false);
});

test('parse tolerates spacing and case in field names', () => {
  const s = parseBaton('Holder:   vscode-opus  \nSINCE: 2026-01-01T00:00Z\ntask:\tship it');
  assert.equal(s.holder, 'vscode-opus');
  assert.equal(s.since, '2026-01-01T00:00Z');
  assert.equal(s.task, 'ship it');
});

test('log parsing ignores prose above the Log heading', () => {
  const text = renderBaton(mk({ log: ['- real entry'] }));
  const s = parseBaton(text.replace('# BATON', '# BATON\n\n- this dash line is not a log entry'));
  assert.deepEqual(s.log, ['- real entry']);
});

test('describe names the holder, or says free', () => {
  assert.match(describe(mk()), /held by claude-code/);
  assert.match(describe(mk({ task: '' })), /\(none stated\)/);
  assert.match(describe(mk({ holder: '(free)' })), /free/);
});
