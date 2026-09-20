# BATON

Single-writer lock for this repo. **Do not change any file until you hold it.**
See the handoff protocol in `CLAUDE.md`. Edit via `npm run baton`, never by hand.

```
holder: (free)
since:  2026-09-20T03:40:10Z
task:   
```

## Log

- 2026-09-19T22:00Z  baton protocol created (vscode-opus) — repo starts free
- 2026-09-20T03:40:01Z  vscode-opus took the baton — add the baton handoff protocol
- 2026-09-20T03:40:10Z  vscode-opus dropped the baton — baton protocol landed and pushed. Repo is free; next agent declares BATON_AGENT and takes it.
