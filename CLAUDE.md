# Agent Workflow

## Project Basics

- Node.js 18+ with CommonJS.
- No build step required.
- Tests use the Node.js test runner (`node --test`).

## Repo Structure

- `lib/`: core library code
- `bin/`: CLI entry point
- `agent/skills/`: agent skill definitions
- `.devcontainer.example/`: devcontainer template for users
- `test/`: test suite

## Working Agreement

- After making changes, run `npm run fix`.
- Before committing, run `npm run validate`.
- Before committing, check if changes touch `lib/`, `bin/`, `agent/skills/`, or
  `.devcontainer.example/` — if so, update CHANGELOG.md (see Changelog Rules).
- Follow commit message and PR guidance in `CONTRIBUTING.md`.

## Changelog Rules

- For user-facing changes in `lib/`, `bin/`, `agent/skills/`, or
  `.devcontainer.example/`, add a short entry under `[Unreleased]` in
  `CHANGELOG.md` using the correct category: Added, Changed, Fixed, Removed,
  Deprecated, Security.
- Changelog entries are NOT needed for: test-only changes, documentation
  updates, refactors with no behavior change, or CI/tooling adjustments.

## Release Workflow

- Run `npm run release:prepare` and follow the steps it outputs.
