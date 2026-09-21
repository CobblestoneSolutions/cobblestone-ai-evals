/**
 * Pre-publish scanner: blocks keys, personal data, and denylisted real names.
 * Runs in the pre-commit hook and in `npm run check`.
 *
 * Denylist: put real business names, domains, emails, tenant ids — anything that must never
 * appear in this public repo — one per line in `.scan-denylist` (gitignored, so the list itself
 * never gets published). Lines starting with # are comments.
 *
 * To allow a deliberate match (e.g. a fake number in a test), END that line with `scan:allow`,
 * bare or inside a trailing comment. The marker must TRAIL the line: a line that merely mentions
 * the token mid-sentence is still scanned, so prose about the mechanism cannot exempt itself.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SKIP_DIRS = new Set(['node_modules', '.git', 'cache', 'raw']);
const SKIP_FILES = new Set(['.env', '.scan-denylist', 'package-lock.json']);
/**
 * Binary = a known binary extension, or a NUL byte in the first 8 KB.
 *
 * The NUL test alone is not enough. A PDF written by a generator that leaves its text streams
 * uncompressed has no NUL near the top, so it gets scanned as text -- and then the zero-padded byte
 * offsets in its xref table trip the card-number rule, while its real, deliberately published
 * contact details trip the email and denylist rules. Extension decides first; the NUL test
 * still catches binaries with no telling extension. Binaries are reported as not scanned, and
 * `portfolio-site/DEPLOY.md` makes eyeballing resume.pdf a human checklist item.
 */
const BINARY_EXT = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'tiff',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar',
  'mp3', 'mp4', 'mov', 'wav', 'ogg', 'webm',
  'xlsx', 'xlsm', 'docx', 'pptx', 'exe', 'dll', 'so', 'dylib', 'wasm',
]);
const hasBinaryExt = (path: string) => BINARY_EXT.has((path.split('.').pop() ?? '').toLowerCase());
export const isBinary = (buf: Buffer, path = '') => hasBinaryExt(path) || buf.subarray(0, 8192).includes(0);

export interface Finding { file: string; line: number; rule: string; match: string }

const RULES: { rule: string; re: RegExp; allow?: (m: string) => boolean }[] = [
  { rule: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_-]{16,}/g },
  { rule: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9]{20,}/g },
  { rule: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { rule: 'google-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { rule: 'stripe-key', re: /\b[sr]k_live_[0-9A-Za-z]{16,}/g },
  { rule: 'sendgrid-key', re: /\bSG\.[\w-]{16,}\.[\w-]{16,}/g },
  { rule: 'twilio-sid', re: /\b(?:AC|SK)[0-9a-f]{32}\b/g },
  { rule: 'telegram-token', re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g },
  { rule: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { rule: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { rule: 'assigned-secret', re: /\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi },
  {
    rule: 'email',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    allow: (m) => /@(example\.(com|org|net)|[\w-]+\.example|anthropic\.com)$/i.test(m) || /^(noreply|no-reply)@/i.test(m),
  },
  {
    // US numbers. 555-0100..0199 is the reserved fictional range and is allowed.
    rule: 'phone',
    re: /(?<![\w.])(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w.])/g,
    allow: (m) => /^55501\d{2}$/.test(m.replace(/\D/g, '').slice(-7)),
  },
  { rule: 'card-number', re: /\b(?:\d[ -]?){13,19}\b/g, allow: (m) => !luhn(m.replace(/\D/g, '')) },
  { rule: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g },
];

function luhn(d: string): boolean {
  if (d.length < 13 || d.length > 19 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
}

export function loadDenylist(root = ROOT): string[] {
  try {
    return readFileSync(join(root, '.scan-denylist'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

/**
 * A line is exempt only when `scan:allow` TRAILS it — bare, or as the last thing inside a
 * trailing comment: `// scan:allow`, `# scan:allow`, `<!-- scan:allow -->`, `/* scan:allow *\/`.
 *
 * Deliberately narrow. The old rule was `line.includes('scan:allow')`, which exempted any line
 * that so much as named the token: a handoff note describing the mechanism silenced its own
 * line and hid ten findings behind a scan that printed "clean".
 */
export const ALLOW_MARKER =
  /(?:^|\s)(?:(?:\/\/|#)\s*)?scan:allow\s*$|(?:^|\s)(?:<!--\s*scan:allow\s*-->|\/\*\s*scan:allow\s*\*\/)\s*$/;

export function scanText(text: string, file: string, deny: string[]): Finding[] {
  const out: Finding[] = [];
  const lowerDeny = deny.map((d) => d.toLowerCase());
  text.split(/\r?\n/).forEach((line, i) => {
    if (ALLOW_MARKER.test(line)) return;
    for (const { rule, re, allow } of RULES) {
      for (const m of line.matchAll(re)) {
        if (allow?.(m[0])) continue;
        out.push({ file, line: i + 1, rule, match: redact(m[0]) });
      }
    }
    const low = line.toLowerCase();
    lowerDeny.forEach((d, k) => {
      if (low.includes(d)) out.push({ file, line: i + 1, rule: 'denylist', match: `entry #${k + 1}` });
    });
  });
  return out;
}

/** Never echo a full secret into terminal logs. */
const redact = (s: string) => (s.length <= 8 ? s : `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} chars)`);

function listFiles(root: string): string[] {
  try {
    const tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').filter(Boolean);
    if (tracked.length) return tracked.map((f) => join(root, f));
  } catch { /* not a git repo yet */ }
  const files: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p); }
      else files.push(p);
    }
  };
  walk(root);
  return files;
}

function main() {
  const deny = loadDenylist();
  const findings: Finding[] = [];
  const unscanned: string[] = [];
  for (const abs of listFiles(ROOT)) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/');
    const base = rel.split('/').pop()!;
    if (SKIP_FILES.has(base) || rel.split('/').some((p) => SKIP_DIRS.has(p))) continue;
    const buf = readFileSync(abs);
    if (isBinary(buf, rel)) { unscanned.push(rel); continue; }
    findings.push(...scanText(buf.toString('utf8'), rel, deny));
  }
  if (!deny.length) console.warn('scan: no .scan-denylist found — real names/domains are NOT being checked. See scripts/scan.ts.');
  if (unscanned.length) console.warn(`scan: ${unscanned.length} non-text file(s) not scanned — review by eye before publishing:\n  ${unscanned.join('\n  ')}`);
  if (findings.length) {
    console.error(`scan: ${findings.length} finding(s):`);
    for (const f of findings) console.error(`  ${f.file}:${f.line}  [${f.rule}]  ${f.match}`);
    process.exit(1);
  }
  console.log('scan: clean.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
