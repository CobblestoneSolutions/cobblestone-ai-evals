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
  assert.deepEqual(rules('812-422-1234 scan:allow'), []);
});
