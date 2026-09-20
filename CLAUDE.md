# CLAUDE.md

Guidance for any agent (Claude Code, an IDE session, a cloud run) working in this repo.

## The baton — read this before touching anything

This repo is worked by several agents and one human. **Exactly one of them may change it at a
time.** The holder is named in [`BATON.md`](BATON.md), which is tracked in git, so every clone
and every session sees the same answer.

**Before your first edit in a session, in this order:**

1. **Declare who you are.** Pick a name that says what you are, not who you work for —
   `claude-code`, `vscode-opus`, `cloud-review`, `jason`:

   ```sh
   export BATON_AGENT='claude-code'        # this session only
   git config baton.agent 'claude-code'    # or: this clone, persistent
   ```

2. **Read the baton.** `npm run baton` prints the holder, their task, and the last five handoffs.

3. **Claim it, or stop.**

   ```sh
   npm run baton -- take "add 01-support-assistant test set"
   ```

   If someone else holds it, **do not edit anything.** Report to the human who holds it and
   what they are doing, and wait. Do not "just fix one small thing" — that is the exact
   collision this exists to prevent.

**When you finish, hand off in the same turn you stop working.** A baton left held by an idle
session blocks everyone:

```sh
npm run baton -- pass vscode-opus "v2 prompt written, evals not run. Watch: judge rubric in
  prompts/v2.md still says 'v1'."
npm run baton -- drop "stopping here, nothing in flight"   # no named successor
```

Notes are mandatory on `pass` and `drop`. Write them for the next agent, not for the human:
what you changed, what is unfinished, what will bite them.

### If the holder is gone

A crashed or closed session leaves the baton held forever. Take it over deliberately — never
silently:

```sh
npm run baton -- steal "claude-code session closed 2h ago, no commits since"
```

`steal` is recorded in the `BATON.md` log as a steal, with your reason. Use it when a session is
genuinely dead, and say so in your next message to the human.

### What enforces this

`.githooks/pre-commit` runs `npm run baton -- check` and **rejects any commit from a non-holder**
before the privacy scan runs. Git cannot gate file *edits*, so the instructions above are the
only thing protecting the working tree — the hook is the backstop, not the fence.

Commits touching nothing but `BATON.md` skip the check; that is how a handoff commits itself.

The hook only runs if hooks are wired up in this clone — after a fresh clone, run:

```sh
npm install && npm run setup-hooks
```

## Repo conventions

- **Never commit real data.** `npm run scan` blocks keys, emails, phone numbers, card numbers
  and any name in `.scan-denylist` (gitignored — it holds the real names, so it must never be
  pushed). Mark a deliberate match with `scan:allow` on the line.
- **Stage explicit paths, never `git add -A`.** Several agents and one human share this
  working tree, so anything untracked may not be yours. `git add -A` once swept a file this
  session had never read into an unrelated commit.
- **`npm run check`** (typecheck + tests + scan) before you hand the baton on.
- **Every number in this repo comes from a run file** in `evals/results/`. Do not write a score,
  a pass rate or a delta into a README or a report that you did not compute from a run. See
  `README.md` for the method.
- Node >= 20.6, ESM, TypeScript run through `tsx`. No build step.
