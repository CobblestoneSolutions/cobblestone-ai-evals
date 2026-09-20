# cobblestone-ai-evals

Evaluation-driven prompt development for three restaurant AI systems, built by a
restaurant operator who ships the software his shops run on.

Each project starts from a real problem, is measured against a fixed test set, and
improves through prompt versions whose effect is *measured, not claimed*: every number in
this repo is computed from a run file in `evals/results/`, and every prompt change names
the failures it was meant to fix. The report checks whether it actually fixed them.

| # | Project | What it tests | Status |
|---|---|---|---|
| 01 | [Support assistant](01-support-assistant/) | Answers customer questions for a fictional ice cream shop; escalates allergens, complaints and unknowns to a human; resists prompt injection | Test set ready (40 cases); v1 not yet run |
| 02 | [Regulation Q&A](02-regulation-qa/) | Answers Indiana / Vanderburgh County / FDA Food Code questions **only** from the source text, with section citations, and says "not covered" when it isn't | Planned |
| 03 | [Receipt extraction](03-receipt-extraction/) | Turns receipt images into structured expenses, then checks its own output (line items sum, tax math, plausible date) and flags failures for a human | Planned |

## The method

```
write test cases ──► run prompt vN ──► grade ──► read failures ──► change prompt ──► run vN+1
      ▲                                                                                   │
      └──────────────────── add a case for every new failure mode found ◄────────────────┘
```

1. **Test set first.** 30–50 cases per project, tagged by type: normal, edge case,
   adversarial, and "should refuse or escalate". Each case says *why* it exists.
2. **Graded by rules where possible, by a model only where necessary.** Required facts,
   forbidden claims, citations, actions taken and structured fields are checked by code.
   Open-ended correctness is checked by a separate judge model against a written rubric.
3. **Every prompt version is a file** (`prompts/v1.md`, `v2.md`, …) with a header stating
   what changed and which case ids it should fix.
4. **The report verifies the claims** — fixed, still failing, or regressed — per case.

## Quickstart

```bash
npm install
cp .env.example .env          # add a DEDICATED eval API key — never a production key
npm run setup-hooks           # pre-commit scan for keys and private data

# offline, free — proves the pipeline with a stand-in model
npm run eval -- 00-example --prompt v1 --provider mock

# live run; saves evals/results/v1.json and regenerates evals/REPORT.md
npm run eval -- 01-support-assistant --prompt v1

# re-grade a past run from recorded responses — no network, no cost
npm run eval -- 01-support-assistant --prompt v1 --provider replay

npm run check                 # typecheck + unit tests + privacy scan
```

`00-example/` is a four-case toy project that exercises the harness end to end. Copy it to
start a new project.

## Repo layout

```
harness/            shared by all projects
  run.ts            runs cases against a prompt version, records everything
  checks/           rule-based checks + LLM judge
  report.ts         REPORT.md + chart.svg: scores by version, fixes, regressions, open failures
  providers/        Anthropic, offline mock, record/replay cache
  tests/            unit tests for the harness itself
NN-project/
  project.ts        how the harness calls this system and which checks apply
  prompts/vN.md     prompt versions, each with a change note
  evals/cases.jsonl the test set
  evals/results/    one JSON record per prompt version (committed)
  evals/REPORT.md   generated
  CASE_STUDY.md     one-page write-up
scripts/scan.ts     blocks keys, emails, phone numbers, card numbers and denylisted names
```

## Trusting the grader

A judge model can be wrong too. For each project, a sample of judge verdicts is
re-graded by hand and the agreement rate is published in that project's case study.
Rule-based checks are preferred wherever the answer can be checked mechanically.

## Data policy

No real customer, employee, or business data appears in this repository.

- The shop in project 01 is fictional. Phone numbers use the reserved 555-01xx range; emails use `example.com`.
- Regulation text in project 02 is **downloaded by a script from the official source**, not
  redistributed here. Answers are informational, not legal advice.
- Receipts in project 03 are synthetic.
- `scripts/scan.ts` runs on every commit. A local, uncommitted `.scan-denylist` blocks real
  business names, domains and ids from ever being committed.

## License

MIT
