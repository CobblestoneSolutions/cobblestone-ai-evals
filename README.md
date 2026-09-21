# cobblestone-ai-evals

Evaluation-driven prompt development for three restaurant AI systems, built by a
restaurant operator who ships the software his shops run on.

Each project starts from a real problem, is measured against a fixed test set, and
improves through prompt versions whose effect is *measured, not claimed*: every number in
this repo is computed from a run file in `evals/results/`, and every prompt change names
the failures it was meant to fix. The report checks whether it actually fixed them.

| # | Project | What it tests | Status |
|---|---|---|---|
| 01 | [Support assistant](01-support-assistant/) | Answers customer questions for a fictional ice cream shop; escalates allergens, complaints and unknowns to a human; resists prompt injection | **v1 67.5% → v4 100%** on 40 cases; **44.4%** on 9 held-out |
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

# a held-out set: own results directory, kept out of REPORT.md
npm run eval -- 01-support-assistant --prompt v4 --cases heldout

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
  evals/heldout.jsonl optional held-out set, scored separately
  evals/results/    one JSON record per prompt version (committed)
  evals/results/archive/  superseded runs, kept as evidence and never scored — see its README
  evals/REPORT.md   generated
  README.md         the project write-up: results, what broke, honest limits
scripts/scan.ts     blocks keys, emails, phone numbers, card numbers and denylisted names
```

## Trusting the grader

A judge model can be wrong too, and so can a test case. Failing cases are re-read by hand
before any prompt change, and what that audit finds is published in the project README —
project 01 documents three grading faults it turned up, each fixed with every version
re-run so the numbers stayed comparable. Rule-based checks are preferred wherever the
answer can be checked mechanically.

When a grader changes, the runs it produced are moved to `evals/results/archive/` rather than
deleted: a score only means something beside the grader that produced it. Archived runs are
excluded from the report and must not be quoted as scores. Project 01 has one, and its folder
README says what it was and why it was superseded.

**Held-out cases.** A prompt tuned against its own test set scores its fit, not its skill,
so a project may also carry a held-out set: fresh questions, written after the prompt was
finished and drawn from somewhere other than the cases it was tuned on. Fresh is not blind.
In project 01 the questions came from the author's memory of real customers, and he had
read every failure report by the time he wrote them — the set guards against a prompt
fitted to the development cases, not against every way an author can be influenced. It is
run once, no prompt is changed afterward, and its score is reported separately from the
headline number.

## Data policy

No real customer, employee, or business data appears in this repository.

- The shop in project 01 is fictional. Phone numbers use the reserved 555-01xx range;
  emails use reserved example domains — project 01's shop uses the `.example` TLD
  (`hello@maplestreetscoops.example`), which `scripts/scan.ts` allows alongside
  `example.com`.
- Regulation text in project 02 is **downloaded by a script from the official source**, not
  redistributed here. Answers are informational, not legal advice.
- Receipts in project 03 are synthetic.
- `scripts/scan.ts` runs on every commit. A local, uncommitted `.scan-denylist` blocks real
  business names, domains and ids from ever being committed.

## License

MIT
