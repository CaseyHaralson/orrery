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

## Branching and PRs

- Never commit directly to `main`. All changes require a PR.
- If on `main` when ready to commit, create a descriptive branch first
  (e.g., `feat/add-widget`, `fix/login-bug`).
- Push the branch to the remote.
- Use `gh pr create` to create pull requests.

## Testing

- Unit tests: `npm test` (runs all tests in `test/`)
- Unit tests cover CLI commands (`test/cli.test.js`), orchestration components
  (`test/orchestration/`), and utilities (`test/utils/`).
- Integration tests: `bash test/integration/run.sh` (runs real agents against a
  sandbox target repo — costs API credits, takes 15-30 min).
- After changing orchestration code in `lib/orchestration/`, add or update unit
  tests in the matching `test/orchestration/*.test.js` file.
- After changing integration-visible behavior, consider adding or updating a
  scenario in `test/integration/scenarios/` and fixtures in
  `test/integration/fixtures/plans/`.

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

When asked to create a release:

1. Run `npm run release:prepare` to validate changelog and get version suggestion.
2. Ask the user to confirm the version number.
3. Create release branch: `git checkout -b release/X.Y.Z`
4. Update CHANGELOG.md:
   - Add new empty `## [Unreleased]` section at top
   - Change previous `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`
5. Update `version` in package.json to `X.Y.Z`
6. Run `npm install` to sync package-lock.json
7. Commit: `git commit -am "X.Y.Z"`
8. Push and create PR: `git push -u origin release/X.Y.Z && gh pr create`
9. After PR merges and user says "publish the release":
   - `git checkout main && git pull`
   - `git tag vX.Y.Z && git push --tags`
   - Create GitHub release: `gh release create vX.Y.Z --notes "..."`
   - Remind user to run `npm publish`
