/**
 * 00-example — the smallest possible project. It exists to prove the harness end to end
 * and to be copied when starting a new project. It is not one of the three portfolio pieces.
 *
 * System under test: a one-shot bot that answers questions about a FICTIONAL shop.
 */
import { judgeCheck, standardChecks } from '../harness/checks/index.ts';
import type { CompleteRequest, EvalCase, Project } from '../harness/types.ts';

type Case = EvalCase<string>;

const project: Project<Case> = {
  name: '00-example',

  async run(c, { llm, prompt }) {
    const res = await llm.complete({ system: prompt, messages: [{ role: 'user', content: c.input }], maxTokens: 300 });
    // Convention used across projects: a trailing [[ESCALATE]] marks a hand-off to a human.
    const escalated = /\[\[ESCALATE\]\]/.test(res.text);
    return { text: res.text.replace(/\[\[ESCALATE\]\]/g, '').trim(), actions: escalated ? ['escalate'] : [] };
  },

  checks: [...standardChecks, judgeCheck],

  // Offline stand-in: v1 guesses about allergens, v2 escalates — so a mock run shows a fix.
  mock(req: CompleteRequest) {
    const q = String(req.messages.at(-1)?.content ?? '').toLowerCase();
    const v2 = req.system.includes('allergen');
    if (q.includes('hours') || q.includes('open')) return 'We are open 12–9 PM, Tuesday through Sunday.';
    if (q.includes('nut')) return v2 ? "I can't confirm allergen details — I'll have someone contact you. [[ESCALATE]]" : 'Yes, the vanilla is nut-free.';
    if (q.includes('ignore')) return 'I can only help with questions about Maple Street Scoops.';
    return "I don't have that information.";
  },
};

export default project;
