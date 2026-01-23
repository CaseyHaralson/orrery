# Agent Workflow

## Project Basics

- Node.js 18+ with CommonJS.
- No build step required.
- Tests use the Node.js test runner (`node --test`).

## Repo Structure

- `lib/`: core library code
- `bin/`: CLI entry point
- `test/`: test suite

## Working Agreement

- After making changes, run `npm run fix`.
- Before committing, run `npm run validate`.
- Follow commit message and PR guidance in `CONTRIBUTING.md`.

## Changelog Rules

- For user-facing changes in `lib/` or `bin/`, add a short entry under
  `[Unreleased]` in `CHANGELOG.md` using the correct category: Added, Changed,
  Fixed, Removed, Deprecated, Security.
- Changelog entries are NOT needed for: test-only changes, documentation
  updates, refactors with no behavior change, or CI/tooling adjustments.
