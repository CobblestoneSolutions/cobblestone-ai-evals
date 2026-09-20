/**
 * 01-support-assistant — a customer-service chatbot for a FICTIONAL ice cream shop.
 *
 * The bot answers from shop-facts.md only. To hand something to a human it ends its reply with
 * a control line the customer never sees:
 *     [[NOTIFY:escalate]] <summary>    allergens, order/refund problems, "talk to a person"
 *     [[NOTIFY:complaint]] <summary>   complaints, suggestions, feedback
 * In production that line becomes a message to the owner; here it becomes an `action` the
 * checks can grade. Same contract as the live bot this project is modelled on.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fieldChecks, judgeCheck, standardChecks } from '../harness/checks/index.ts';
import type { Check, CompleteRequest, EvalCase, Project } from '../harness/types.ts';

type Turn = { role: 'user' | 'assistant'; content: string };
type Input = string | { messages: Turn[] };
type Case = EvalCase<Input>;

const HERE = fileURLToPath(new URL('.', import.meta.url));
const FACTS = readFileSync(join(HERE, 'shop-facts.md'), 'utf8').trim();

/** Strict: only well-formed control lines count. Anything else stays in the text and is caught as a leak. */
const NOTIFY_LINE = /^[ \t]*\[\[NOTIFY:(escalate|complaint)\]\][^\n]*$/gm;

export function parseReply(raw: string): { text: string; actions: string[]; summaries: string[] } {
  const actions: string[] = [];
  const summaries: string[] = [];
  const text = raw.replace(NOTIFY_LINE, (line) => {
    const m = line.match(/\[\[NOTIFY:(escalate|complaint)\]\]\s*(.*)$/)!;
    actions.push(m[1]!);
    summaries.push(m[2]!.trim());
    return '';
  });
  return { text: text.trim(), actions, summaries };
}

export function buildSystem(prompt: string): string {
  if (!prompt.includes('{{SHOP_FACTS}}')) throw new Error('prompt must contain {{SHOP_FACTS}}');
  return prompt.replace('{{SHOP_FACTS}}', FACTS);
}

const toMessages = (input: Input): Turn[] => (typeof input === 'string' ? [{ role: 'user', content: input }] : input.messages);

/** The control line must never reach the customer, even malformed. */
const noControlLeak: Check = (_c, out) => {
  const leaked = /\[\[|NOTIFY/i.test(out.text);
  return { name: 'no-control-leak', pass: !leaked, detail: leaked ? 'control syntax visible to the customer' : undefined };
};

/** One hand-off per reply. Several means the owner gets paged repeatedly for one chat. */
const singleNotify: Check = (_c, out) => {
  const n = out.actions?.length ?? 0;
  return n <= 1 ? null : { name: 'single-notify', pass: false, detail: `${n} NOTIFY lines in one reply` };
};

/** A notification must carry a summary the owner can act on. */
const notifyHasSummary: Check = (_c, out) => {
  const s = (out.meta?.summaries as string[] | undefined) ?? [];
  if (!s.length) return null;
  const empty = s.some((x) => x.length < 8);
  return { name: 'notify-summary', pass: !empty, detail: empty ? 'NOTIFY line has no usable summary' : undefined };
};

/** Tracked, not gating: a chat widget reply should be short. */
const brevity: Check = (_c, out) => {
  const words = out.text.split(/\s+/).filter(Boolean).length;
  return { name: 'brevity<=120w', pass: words <= 120, critical: false, detail: words > 120 ? `${words} words` : undefined };
};

const project: Project<Case> = {
  name: '01-support-assistant',

  async run(c, { llm, prompt }) {
    const res = await llm.complete({ system: buildSystem(prompt), messages: toMessages(c.input), maxTokens: 600, temperature: 0 });
    const { text, actions, summaries } = parseReply(res.text);
    return { text, actions, meta: { summaries, raw: res.text } };
  },

  checks: [...standardChecks, fieldChecks, noControlLeak, singleNotify, notifyHasSummary, brevity, judgeCheck],

  /** shop-facts.md is the whole world the bot may answer from — the judge grades extra claims against it. */
  grounding: FACTS,

  /** Offline stand-in so the pipeline can be exercised without a key. Deliberately naive. */
  mock(req: CompleteRequest) {
    const last = req.messages.at(-1)?.content;
    const q = (typeof last === 'string' ? last : '').toLowerCase();
    if (q.includes('hours')) return 'Closed Monday. Tue–Thu 12–9 PM, Fri–Sat 12–10 PM, Sun 12–8 PM.';
    if (q.includes('allerg')) return "I can't confirm that — someone from the shop will follow up.\n[[NOTIFY:escalate]] Allergy question";
    if (q.includes('rude') || q.includes('slow')) return "I'm sorry — I'll pass this to the owner.\n[[NOTIFY:complaint]] Service complaint";
    return "I'm not sure — please call us at (812) 555-0142.";
  },
};

export default project;
