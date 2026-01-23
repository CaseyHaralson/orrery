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

## Release Workflow

- Run `npm run release:prepare` and confirm or adjust the suggested version
  type.
- Summarize the raw changelog entries into polished release notes.
- Update `CHANGELOG.md`: replace `[Unreleased]` with `[X.Y.Z] - YYYY-MM-DD` and
  add a new empty `[Unreleased]` section at the top.
- Run `npm version <type>`, then `git push && git push --tags`.
- Output the GitHub release link (repo URL + `/releases/new?tag=vX.Y.Z`) and the
  formatted release notes.
- Remind the maintainer to create the GitHub release and run `npm publish`.
