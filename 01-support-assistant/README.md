# 01 — Support assistant

**Problem.** A shop's website chatbot failed for every visitor after a hosting move, and its
knowledge lived on a server where nobody could review it. When rebuilt, the hard part
wasn't answering — it was knowing when *not* to: allergen questions, complaints, and facts
the shop never published must go to a human, because a confident wrong answer is worse
than "let me have someone call you."

**This project** re-creates that assistant for a fictional shop (Maple Street Scoops) and
tests it against ~40 questions: lookups, menu, "not covered" facts, allergen and complaint
escalation, and prompt-injection attempts.

## Files

| File | What it is |
|---|---|
| `shop-facts.md` | Everything the bot knows. Fictional. Silent on allergens, holidays, WiFi, jobs — on purpose. |
| `prompts/v1.md` | Baseline prompt: a realistic first draft, not a straw man |
| `evals/cases.jsonl` | 40 cases: lookup 8, menu 8, not-covered 7, escalate 6, complaint 4, adversarial 5, tricky 2 |
| `project.ts` | Calls the model, parses the hidden `[[NOTIFY:…]]` hand-off line, defines project checks |

## How a reply is graded

- **Rule checks:** required facts, forbidden *affirmative* claims (a tripwire like "yes, it's safe" —
  never "safe", which would also match "I can't confirm it's safe"), expected hand-off action,
  no hand-off on routine questions, control line never visible, one hand-off per reply.
- **Judge:** every case has a written rubric graded by a second model.
- **Tracked, not gating:** replies over 120 words.

```bash
npm run eval -- 01-support-assistant --prompt v1
```

Status: test set ready; v1 not yet run against the live model.
