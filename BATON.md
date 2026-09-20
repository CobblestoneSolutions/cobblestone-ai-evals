# BATON

Single-writer lock for this repo. **Do not change any file until you hold it.**
See the handoff protocol in `CLAUDE.md`. Edit via `npm run baton`, never by hand.

```
holder: jason
since:  2026-09-20T04:46:12Z
task:   Judge v2 + re-baseline landed (ff2d7c3); Phase 2 committed (aebdb23). v1 baseline is now 27/40 (67.5%) under judge 2 -- do NOT quote the old 65%, it was judge 1 on a different case set (kept at evals/results/archive/, excluded from the report). V2 IS NOT STARTED, by request. Before writing v2, two open calls for Jason: (1) sup-21's rubric says 'suggests calling or asking staff' while sup-17/19/20 require the phone number outright -- the judge is faithful to each, but the not-covered group is inconsistent, and a v2 that always gives the phone makes it moot; (2) my pre-run label of sup-22 as a judge problem was wrong -- judge 2 fails it correctly for asserting 'no dedicated party room', a negative the facts can't support, so it is a prompt problem. Remaining 13 failures are 12 prompt + 1 case, needing four prompt rules: give the phone number on unknowns; never issue a safety verdict; escalate beats complaint when a human must act; say feedback reaches the owner, praise included. Watch: any judge or case edit invalidates this baseline and needs another v1 re-run -- bump JUDGE_VERSION if you touch the judge. Model calls replay from evals/cache (gitignored), so a re-run only pays for judge calls.
```

## Log

- 2026-09-19T22:00Z  baton protocol created (vscode-opus) — repo starts free
- 2026-09-20T03:40:01Z  vscode-opus took the baton — add the baton handoff protocol
- 2026-09-20T03:40:10Z  vscode-opus dropped the baton — baton protocol landed and pushed. Repo is free; next agent declares BATON_AGENT and takes it.
- 2026-09-20T03:41:33Z  claude-cowork took the baton — Phase 2: 01-support-assistant shop facts, 40 cases, v1 prompt, project.ts
- 2026-09-20T03:45:32Z  claude-cowork -> vscode-opus — Phase 2 files written, NOT committed (cowork can't run git through the bridge — it leaves index.lock). Please: npm run check (expect 34 pass, scan clean), commit, then run the first live eval: npm run eval -- 01-support-assistant --prompt v1. Do NOT edit prompts/v1.md before that run — v1 is the baseline. Jason is reviewing the 40 cases; case edits may follow. package.json test glob now includes 0*/*.test.ts.
- 2026-09-20T04:46:12Z  vscode-opus -> jason — Judge v2 + re-baseline landed (ff2d7c3); Phase 2 committed (aebdb23). v1 baseline is now 27/40 (67.5%) under judge 2 -- do NOT quote the old 65%, it was judge 1 on a different case set (kept at evals/results/archive/, excluded from the report). V2 IS NOT STARTED, by request. Before writing v2, two open calls for Jason: (1) sup-21's rubric says 'suggests calling or asking staff' while sup-17/19/20 require the phone number outright -- the judge is faithful to each, but the not-covered group is inconsistent, and a v2 that always gives the phone makes it moot; (2) my pre-run label of sup-22 as a judge problem was wrong -- judge 2 fails it correctly for asserting 'no dedicated party room', a negative the facts can't support, so it is a prompt problem. Remaining 13 failures are 12 prompt + 1 case, needing four prompt rules: give the phone number on unknowns; never issue a safety verdict; escalate beats complaint when a human must act; say feedback reaches the owner, praise included. Watch: any judge or case edit invalidates this baseline and needs another v1 re-run -- bump JUDGE_VERSION if you touch the judge. Model calls replay from evals/cache (gitignored), so a re-run only pays for judge calls.
