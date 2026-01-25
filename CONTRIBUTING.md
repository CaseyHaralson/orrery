# Contributing to Orrery

Thanks for your interest in contributing to Orrery! Whether this is your first contribution or you are a returning contributor, we appreciate your time and effort.

## Getting Started

1. Fork the repo and clone your fork locally.
2. Install dependencies with `npm install`.
3. Run the test suite with `npm test`.
4. Create a new branch for your change (for example, `git checkout -b feat/my-change`).
5. Make your changes and keep commits focused.

## Development Setup

- Requires Node.js 18+ and npm.
- Install dependencies: `npm install`.
- Run tests: `npm test` (uses the Node.js test runner).

## Pull Request Process

- Open a draft PR early if you want feedback.
- Keep the scope tight and describe the "why" in the PR description.
- Update documentation when behavior or usage changes.
- Make sure tests pass locally; linting/formatting will be checked in CI.
- Be responsive to review feedback and be ready to iterate.

### What Reviewers Look For

- Clear intent and maintainable code.
- Tests that cover new behavior or prevent regressions.
- Consistency with existing patterns and style.
- Documentation updates when appropriate.

## Release Process

Contributors should add brief entries to CHANGELOG.md under [Unreleased] after
user-facing changes (lib/, bin/, agent/skills/, or .devcontainer.example/ changes).
Use the appropriate category (Added, Changed, Fixed, Removed, Deprecated, Security).

Maintainers use an agent-assisted workflow:

1. Open Claude Code in the repository.
2. Say "create release" — the agent validates the changelog, suggests a version,
   and after confirmation creates a PR with the release changes.
3. Review and merge the PR.
4. Say "publish the release" — the agent tags the release and creates the
   GitHub release.
5. Run `npm publish` (maintainers only).

## Commit Messages

Conventional Commits are preferred (for example, `feat: add plan status command`). If you are unsure, keep commit messages short, imperative, and scoped to the change.
