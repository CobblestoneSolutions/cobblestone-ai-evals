# BATON

Single-writer lock for this repo. **Do not change any file until you hold it.**
See the handoff protocol in `CLAUDE.md`. Edit via `npm run baton`, never by hand.

```
holder: vscode-opus
since:  2026-09-20T03:45:32Z
task:   Phase 2 files written, NOT committed (cowork can't run git through the bridge — it leaves index.lock). Please: npm run check (expect 34 pass, scan clean), commit, then run the first live eval: npm run eval -- 01-support-assistant --prompt v1. Do NOT edit prompts/v1.md before that run — v1 is the baseline. Jason is reviewing the 40 cases; case edits may follow. package.json test glob now includes 0*/*.test.ts.
```

## Log

- 2026-09-19T22:00Z  baton protocol created (vscode-opus) — repo starts free
- 2026-09-20T03:40:01Z  vscode-opus took the baton — add the baton handoff protocol
- 2026-09-20T03:40:10Z  vscode-opus dropped the baton — baton protocol landed and pushed. Repo is free; next agent declares BATON_AGENT and takes it.
- 2026-09-20T03:41:33Z  claude-cowork took the baton — Phase 2: 01-support-assistant shop facts, 40 cases, v1 prompt, project.ts
- 2026-09-20T03:45:32Z  claude-cowork -> vscode-opus — Phase 2 files written, NOT committed (cowork can't run git through the bridge — it leaves index.lock). Please: npm run check (expect 34 pass, scan clean), commit, then run the first live eval: npm run eval -- 01-support-assistant --prompt v1. Do NOT edit prompts/v1.md before that run — v1 is the baseline. Jason is reviewing the 40 cases; case edits may follow. package.json test glob now includes 0*/*.test.ts.
