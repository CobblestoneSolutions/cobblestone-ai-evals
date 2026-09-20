/**
 * Baton: a single-writer lock for a repo worked by several agents (Claude Code, an IDE
 * session, a cloud run) plus a human. Exactly one holder may change the repo at a time.
 *
 * State lives in `BATON.md` at the repo root — tracked and pushed, so every clone and every
 * session sees the same holder. The pre-commit hook calls `check` and refuses commits made by
 * anyone but the holder.
 *
 * Identity comes from `$BATON_AGENT`, else `git config baton.agent`. Two sessions sharing one
 * clone are told apart only by that value, so every agent must set it before working.
 *
 * Usage:
 *   npm run baton                      # status
 *   npm run baton -- take "<task>"     # claim a free baton
 *   npm run baton -- pass <to> "<notes>"  # hand off: writes notes, sets the new holder
 *   npm run baton -- drop "<notes>"    # release without naming a successor
 *   npm run baton -- check             # exit 1 unless the caller holds it (used by the hook)
 *   npm run baton -- steal "<why>"     # override a stale/abandoned baton; always logged
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BATON = join(ROOT, 'BATON.md');
const FREE = '(free)';

export interface BatonState {
  holder: string;
  since: string;
  task: string;
  log: string[];
}

/** Identity of whoever is running this. Empty string when undeclared. */
export function whoami(root = ROOT): string {
  const env = process.env.BATON_AGENT?.trim();
  if (env) return env;
  try {
    return execFileSync('git', ['config', 'baton.agent'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return '';
  }
}

export function parseBaton(text: string): BatonState {
  // [^\S\r\n], not \s: \s crosses newlines, so an empty `holder:` would swallow the next line.
  const field = (name: string) => new RegExp(`^${name}:[^\\S\\r\\n]*(.*)$`, 'mi').exec(text)?.[1]?.trim() ?? '';
  const logStart = text.indexOf('## Log');
  const log = logStart === -1
    ? []
    : text.slice(logStart).split(/\r?\n/).filter((l) => l.startsWith('- '));
  return { holder: field('holder') || FREE, since: field('since'), task: field('task'), log };
}

export function renderBaton(s: BatonState): string {
  return [
    '# BATON',
    '',
    'Single-writer lock for this repo. **Do not change any file until you hold it.**',
    'See the handoff protocol in `CLAUDE.md`. Edit via `npm run baton`, never by hand.',
    '',
    '```',
    `holder: ${s.holder}`,
    `since:  ${s.since}`,
    `task:   ${s.task}`,
    '```',
    '',
    '## Log',
    '',
    ...s.log,
    '',
  ].join('\n');
}

export const isFree = (s: BatonState) => s.holder === FREE || s.holder === '';

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const logLine = (what: string) => `- ${now()}  ${what}`;

function read(): BatonState {
  try {
    return parseBaton(readFileSync(BATON, 'utf8'));
  } catch {
    return { holder: FREE, since: '', task: '', log: [] };
  }
}

function write(s: BatonState) {
  writeFileSync(BATON, renderBaton(s), 'utf8');
}

/** Human-readable status; used by `status` and by every refusal message. */
export function describe(s: BatonState): string {
  if (isFree(s)) return 'baton: free — nobody holds it.';
  return `baton: held by ${s.holder} since ${s.since}\n       task: ${s.task || '(none stated)'}`;
}

function requireIdentity(): string {
  const me = whoami();
  if (me) return me;
  console.error(
    'baton: you have not declared who you are.\n' +
    "       Set it for this session:  export BATON_AGENT='claude-code'\n" +
    "       or for this clone:        git config baton.agent 'claude-code'",
  );
  process.exit(1);
}

function main(argv: string[]) {
  const [cmd = 'status', ...rest] = argv;
  const s = read();
  const me = cmd === 'status' ? whoami() : requireIdentity();

  switch (cmd) {
    case 'status': {
      console.log(describe(s));
      console.log(`       you are: ${me || '(undeclared — set $BATON_AGENT)'}`);
      for (const l of s.log.slice(-5)) console.log(`       ${l}`);
      return;
    }

    case 'check': {
      if (isFree(s)) {
        console.error(`baton: nobody holds the baton.\n       run \`npm run baton -- take "<task>"\` before changing anything.`);
        process.exit(1);
      }
      if (s.holder !== me) {
        console.error(`${describe(s)}\nbaton: you are '${me}' — NOT the holder. Ask ${s.holder} to pass it, or use \`steal\`.`);
        process.exit(1);
      }
      console.log(`baton: held by you (${me}).`);
      return;
    }

    case 'take': {
      if (!isFree(s) && s.holder !== me) {
        console.error(`${describe(s)}\nbaton: '${me}' cannot take it. Ask ${s.holder} to pass it, or use \`steal "<why>"\`.`);
        process.exit(1);
      }
      const task = rest.join(' ').trim();
      if (!task) { console.error('baton: state a task — `npm run baton -- take "what you are about to do"`'); process.exit(1); }
      write({ ...s, holder: me, since: now(), task, log: [...s.log, logLine(`${me} took the baton — ${task}`)] });
      console.log(`baton: taken by ${me}. Task: ${task}`);
      return;
    }

    case 'pass': {
      const to = rest[0]?.trim();
      const notes = rest.slice(1).join(' ').trim();
      if (!to) { console.error('baton: name the successor — `npm run baton -- pass <agent> "<notes>"`'); process.exit(1); }
      if (s.holder !== me) { console.error(`${describe(s)}\nbaton: '${me}' cannot pass a baton it does not hold.`); process.exit(1); }
      if (!notes) { console.error('baton: leave handoff notes — what you did, what is left, what to watch.'); process.exit(1); }
      write({ ...s, holder: to, since: now(), task: notes, log: [...s.log, logLine(`${me} -> ${to} — ${notes}`)] });
      console.log(`baton: passed to ${to}.`);
      return;
    }

    case 'drop': {
      const notes = rest.join(' ').trim();
      if (s.holder !== me) { console.error(`${describe(s)}\nbaton: '${me}' cannot drop a baton it does not hold.`); process.exit(1); }
      if (!notes) { console.error('baton: say where you left things — `npm run baton -- drop "<notes>"`'); process.exit(1); }
      write({ ...s, holder: FREE, since: now(), task: '', log: [...s.log, logLine(`${me} dropped the baton — ${notes}`)] });
      console.log('baton: released. It is now free.');
      return;
    }

    case 'steal': {
      const why = rest.join(' ').trim();
      if (!why) { console.error('baton: stealing needs a stated reason — `npm run baton -- steal "<why>"`'); process.exit(1); }
      const from = s.holder;
      write({ ...s, holder: me, since: now(), task: why, log: [...s.log, logLine(`${me} STOLE the baton from ${from} — ${why}`)] });
      console.warn(`baton: ${me} took the baton from ${from}. This is logged in BATON.md.`);
      return;
    }

    default:
      console.error(`baton: unknown command '${cmd}'. Use status | check | take | pass | drop | steal.`);
      process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
