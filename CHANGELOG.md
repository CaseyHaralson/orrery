# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.0] - 2026-01-24

### Added

- `ORRERY_AGENT_TIMEOUT` environment variable to configure agent failover timeout (default: 900000ms / 15 minutes)

### Changed

- Added visual separator between steps in orchestration console output

### Fixed

- Review agent now discovers new/untracked files using `git status --porcelain` instead of only `git diff`

## [0.8.0] - 2026-01-24

### Added

- Review feedback now logged to console with severity, file location, and comment details when issues are found
- Step reports now include `reviews` array with iteration history and feedback for persistence

## [0.7.2] - 2026-01-24

### Fixed

- Fixed E2BIG error when reviewing large diffs by removing embedded context from review prompts; review agent now reads plan files and runs git diff directly

## [0.7.1] - 2026-01-24

### Changed

- CLI version flag changed from `-V` to `-v`
- Simplified `resume` command description
- Added missing directories to npm package files

## [0.7.0] - 2026-01-24

### Changed

- orrery-execute and orrery-verify skills now reference project guideline files (CLAUDE.md, AGENTS.md, etc.) and plan metadata.notes for project-specific guidelines

## [0.6.0] - 2026-01-23

### Added

- Added `--review` flag to enable iterative review/edit loops after each step until approved (or max iterations).
- Added `ORRERY_REVIEW_ENABLED` environment variable to devcontainer template.
- Added `ORRERY_REVIEW_MAX_ITERATIONS` environment variable to control review-edit loop iterations.

### Fixed

- Agents no longer block on expected `.agent-work/` changes made by orchestrator before execution.

### Changed

- `orrery orchestrate` no longer requires `gh` CLI for PR creation; outputs a clickable URL and PR info instead.
- Discovery skill now outputs next step options (refine-plan, simulate-plan, orrery exec) after plan creation.

## [0.5.0]

- Baseline release of the Orrery CLI and workflow orchestration tooling.
- This changelog starts at 0.5.0; earlier versions were not documented.

[Unreleased]: https://github.com/CaseyHaralson/orrery/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/CaseyHaralson/orrery/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/CaseyHaralson/orrery/compare/v0.7.2...v0.8.0
[0.7.2]: https://github.com/CaseyHaralson/orrery/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/CaseyHaralson/orrery/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/CaseyHaralson/orrery/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/CaseyHaralson/orrery/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/CaseyHaralson/orrery/releases/tag/v0.5.0
