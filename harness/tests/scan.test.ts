import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanText } from '../../scripts/scan.ts';

const rules = (t: string, deny: string[] = []) => scanText(t, 'f', deny).map((f) => f.rule);

test('flags credentials', () => {
  assert.deepEqual(rules('key = sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAA'), ['anthropic-key']); // scan:allow
  assert.ok(rules('AKIAABCDEFGHIJKLMNOP').includes('aws-key')); // scan:allow
  assert.ok(rules('-----BEGIN RSA PRIVATE KEY-----').includes('private-key')); // scan:allow
  assert.ok(rules('password: "hunter2hunter2"').includes('assigned-secret')); // scan:allow
  assert.ok(rules('SG.aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb').includes('sendgrid-key')); // scan:allow
});

test('emails: real blocked, example domains allowed', () => {
  assert.deepEqual(rules('write owner@realshop.com'), ['email']); // scan:allow
  assert.deepEqual(rules('write owner@example.com or a@shop.example'), []);
});

test('phones: real blocked, 555-01xx fictional range allowed', () => {
  assert.deepEqual(rules('call (812) 555-0142'), []);
  assert.deepEqual(rules('call 812-555-0199'), []);
  assert.deepEqual(rules('call 812-422-1234'), ['phone']); // scan:allow
});

test('card numbers only when Luhn-valid; SSNs flagged', () => {
  assert.ok(rules('card 4111 1111 1111 1111').includes('card-number')); // scan:allow
  assert.ok(!rules('order 1234567890123').includes('card-number'));
  assert.ok(rules('ssn 123-45-6789').includes('ssn')); // scan:allow
});

test('denylist is case-insensitive and does not echo the term', () => {
  const f = scanText('Welcome to REAL SHOP LLC', 'f', ['real shop']);
  assert.equal(f[0]!.rule, 'denylist');
  assert.doesNotMatch(f[0]!.match, /real shop/i);
});

test('secrets are redacted in findings; scan:allow skips a line', () => {
  const f = scanText('sk-ant-api03-SECRETSECRETSECRETSECRET', 'f', []); // scan:allow
  assert.doesNotMatch(f[0]!.match, /SECRETSECRETSECRET/);
  assert.deepEqual(rules('812-422-1234 scan:allow'), []); // scan:allow
});

test('scan:allow exempts a line only as a TRAILING marker', () => {
  // Trailing, bare or inside a closing comment: the line is skipped.
  assert.deepEqual(rules('812-422-1234 scan:allow'), []); // scan:allow
  assert.deepEqual(rules('812-422-1234 // scan:allow'), []); // scan:allow
  assert.deepEqual(rules('812-422-1234 # scan:allow'), []); // scan:allow
  assert.deepEqual(rules('812-422-1234 <!-- scan:allow -->'), []); // scan:allow

  // Merely NAMING the token mid-sentence must not exempt anything. This is the hole that
  // let a handoff note hide ten findings behind a scan that printed "clean".
  assert.deepEqual(rules('the scan:allow marker exempts 812-422-1234 when it trails'), ['phone']); // scan:allow
  assert.deepEqual(rules('FOUR scan:allow lines, not two: 812-422-1234'), ['phone']); // scan:allow

  // The same gate governs denylist terms, not just the regex rules.
  assert.deepEqual(scanText('Welcome to REAL SHOP scan:allow', 'f', ['real shop']), []); // scan:allow
  assert.equal(scanText('a scan:allow line naming REAL SHOP mid-sentence', 'f', ['real shop']).length, 1); // scan:allow
});
