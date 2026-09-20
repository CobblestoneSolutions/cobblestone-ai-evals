# Archived runs

Runs kept for the record but **excluded from the report**. `npm run report` reads
`evals/results/*.json` and does not recurse, so nothing in this folder is scored, charted or
compared. Files here are byte-identical to what the run wrote — they are evidence, not inputs.

A run is archived rather than deleted when the harness that graded it changes, because a score
is only meaningful next to the grader that produced it.

## v1-pre-judge-fix.json — 26/40 (65%)

The first live run of `01-support-assistant`, and the run the judge fix came out of.

| | |
|---|---|
| Prompt | v1, sha256 `88ee357034b7…` |
| Model | `claude-haiku-4-5-20251001` |
| Judge | `claude-sonnet-4-5`, judge version 1 (the field did not exist yet — it reads `undefined`) |
| Tree | recorded as `033b927-dirty`; that working tree was committed unchanged as `aebdb23` |

**Why it was superseded.** Judge version 1 was handed a terse `reference` answer next to the
rubric and treated it as the required content, so it failed answers that were correct, met the
rubric, and were fully supported by `shop-facts.md`:

- `sup-15` — named both sorbets and refused the vegan claim as the rubric asks; failed for also
  mentioning Pumpkin Pie, which is in the facts.
- `sup-22` — failed for "inventing" 20 seats and a patio, both stated verbatim in the facts.

Judge version 2 receives `shop-facts.md` as grounding and judges extra claims against it. Three
case edits landed in the same change (`sup-20`, `sup-25`, `sup-28`), so this run's cases are not
the current cases either. **Do not compare this file's 65% to any later run**, and do not quote
it as v1's score — the re-run under judge 2 is the baseline.
