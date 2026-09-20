# 01 — Support assistant

**Problem.** A shop's website chatbot failed for every visitor after a hosting move, and its
knowledge lived on a server where nobody could review it. When rebuilt, the hard part
wasn't answering — it was knowing when *not* to: allergen questions, complaints, and facts
the shop never published must go to a human, because a confident wrong answer is worse
than "let me have someone call you."

**This project** re-creates that assistant for a fictional shop (Maple Street Scoops) and
measures four prompt versions against a fixed set of 40 cases, then against 9 questions the
prompt was never tuned on.

## Results

| Set | v1 | v2 | v3 | v4 |
|---|---|---|---|---|
| Development set (40 cases) | 67.5% | 95% | 95% | **100%** |
| Held-out set (9 cases) | — | — | — | **44.4%** |

Model under test: `claude-haiku-4-5-20251001`. Judge: `claude-sonnet-4-5`, judge prompt v2 —
a different model from the one being graded. Every number comes from a run file in
`evals/results/`; the held-out run is `evals/results/heldout/v4.json` and is excluded from
`REPORT.md` by design.

**The gap is the finding.** Four prompt versions were written by reading failures in the
same 40 cases, so 100% measures fit to those cases, not general competence. The held-out
questions come from this repo's author, who runs a real ice cream shop: he wrote them from
memory of questions his own customers actually asked, after the prompt was finished. They
are graded against Maple Street Scoops' fictional facts, not his shop's answers, so where
the two disagree the fictional facts decide. The set was run exactly once, with no prompt
edits afterward. Three of the nine restate topics the development set already covers, and
all three pass. On the six genuinely new questions, v4 scores **1/6**.

What it got wrong is more useful than the score:

- **Misread a plain-spoken question.** "Can you come in and scoop and make your own food"
  was read as asking whether the *bot* could come in, and the reply invented a staffing
  policy the shop facts never state. Real customers don't write like eval cases, and the
  40 development cases are all cleanly phrased.
- **Missed a safety hand-off.** A customer feeling unwell was never told to seek medical
  attention.
- **Argued with a complaint.** Told a reviewer who drove 40 minutes to a closed shop that
  "3pm should definitely be during business hours," and routed it for escalation instead of
  logging it as feedback.

Two of the five held-out failures turn on strict rubric wording. They were left unchanged
after the results came in: loosening a rubric because it failed is how a held-out set stops
being one.

**How the draft became cases.** `heldout-draft.txt` is the author's own words, and the
conversion to `evals/heldout.jsonl` is faithful but not mechanical. Four judgment calls are
worth knowing before reading the 44.4%:

- Draft items 3, 7 and 9 give *answers* rather than questions, so the customer's side of
  those cases (ho-03, ho-06, ho-09) was phrased from his words rather than quoted.
- Where the draft's real-shop answers contradict the fictional shop facts — delivery
  (item 1) and hours (item 3) — the facts decide the grade, so the bot is marked right for
  contradicting the author.
- Where the facts are simply *silent* — sugar-free (item 2) and serving yourself (item 5) —
  the case is graded as an unknown the bot should hand off, not as the flat "no" the draft
  gives. That is a grading decision, and a defensible opposite one exists.
- Item 8 holds a compliment and a complaint, so it became two cases; items 4 and 10 were
  left blank and omitted. Eight draft items, nine cases.

## Prompt versions

| Version | Change | Effect |
|---|---|---|
| v1 | Baseline: shop facts pasted in, friendly tone, one hand-off line. A realistic first draft, not a straw man | 27/40 |
| v2 | Six rules from v1's 13 failures: unknowns get the phone number, no inference past the facts, never a safety verdict, escalate beats complaint, feedback reaches the owner, name every failing condition | 38/40 |
| v3 | Scope the no-hand-off preamble; never promise a refund or replacement | 38/40 |
| v4 | A request for a person always escalates; private details about staff are declined, not escalated | 40/40 |

Each version's header names the case ids it should fix, and `REPORT.md` verifies each claim
per case — fixed, still failing, or regressed.

## Files

| File | What it is |
|---|---|
| `shop-facts.md` | Everything the bot knows. Fictional. Silent on allergens, holidays, WiFi, jobs — on purpose |
| `prompts/v1.md` … `v4.md` | Prompt versions, each with a change note and claimed fixes |
| `evals/cases.jsonl` | 40 development cases: lookup 8, menu 8, not-covered 7, escalate 6, complaint 4, adversarial 5, tricky 2 |
| `evals/heldout.jsonl` | 9 held-out cases, converted faithfully from `heldout-draft.txt`; the conversion's judgment calls are listed under *Results* |
| `project.ts` | Calls the model, parses the hidden `[[NOTIFY:…]]` hand-off line, defines project checks |

## How a reply is graded

- **Rule checks:** required facts, forbidden *affirmative* claims, expected hand-off action,
  no hand-off on routine questions, control line never visible, one hand-off per reply.
- **Judge:** every case has a written rubric graded by a second model.
- **Tracked, not gating:** replies over 120 words.

## Grading the grader

A judge and a case file can both be wrong, and here both were. Each fault was found by
auditing failures by hand, fixed, and every version re-run so the numbers stayed comparable:

- **The judge called grounded facts hallucinations.** It was shown a short reference answer
  alongside the rubric and treated any correct detail missing from that one-liner as
  invented. One case, sup-15, failed for citing the shop facts accurately. Judge prompt v2
  says the reference is one acceptable answer, not the required content; it flipped sup-15
  and nothing else. The other case under suspicion, sup-22, still fails under v2 and should:
  asked about hosting a birthday party, the bot replied "we don't have a dedicated party
  room", a negative the shop facts cannot support. That was a prompt fault, not a judge
  fault, and v2 of the prompt fixed it.
- **A tripwire couldn't tell an assertion from a denial.** A substring ban on "is safe for"
  also fired on "I can't tell you whether it is safe for your daughter" — the safest reply
  any version produced. Removed; the judge owns that verdict.
- **A rubric graded a signal the judge cannot see.** One rubric asked the judge to confirm
  the hand-off fired, but the hand-off line is stripped before the judge sees the reply, so
  the case could never pass. Rubrics now grade only what a customer reads; hand-offs are
  graded by the actions check. All 40 rubrics were swept for the same fault.

The held-out set is kept out of the headline number by three independent paths: its runs
write to their own directory, the report reader skips subdirectories, and the CLI does not
regenerate the report after a held-out run. A test builds a held-out set that scores
differently from the development set and asserts none of it reaches `REPORT.md`.

## Honest limits

- The prompt was iterated against the 40 development cases. There is no train/test split on
  that set, and 100% should be read as fit, not skill.
- The held-out set is 9 cases and was run once. It is a signal about direction, not a
  precise rate.
- One model, one run per version. No temperature variance or repeat-run spread is measured.
- No hand-scored agreement rate is published for the judge. Every v1 failure was re-read by
  hand, along with a sample of the passes, and that read found no verdict worth disputing.
  It was a hand check of a sample, not a measured agreement rate — it comes from no run
  file, so no number is quoted for it here.

## Reproduce

```bash
npm run eval -- 01-support-assistant --prompt v4                  # development set
npm run eval -- 01-support-assistant --prompt v4 --cases heldout  # held-out set
npm run eval -- 01-support-assistant --prompt v1 --provider replay # re-grade, no network
```
