# Contributing Guide

## Beta Versioning
Beta version is tracked in `BETA_VERSION` using `x.y.z.n` (example: `1.0.0.0`).

- Baseline: `1.0.0.0`
- Increment with: `npm run version:beta`
- Show current value: `npm run version:beta:show`

## Commit Structure
- Group related file changes in one commit.
- Use clear messages, for example:
  - `chore(beta): bump to 1.0.0.1`
  - `refactor(auditor): type webhook payload contracts`
  - `security(sentinel): add rate limiting and CORS allowlist`

## Quality Gate
Before PR or release commits, run:

```bash
npm run ci:check
```

## Branching
- Work in short-lived feature branches.
- Merge through pull requests.
- Keep `main` release-ready.
