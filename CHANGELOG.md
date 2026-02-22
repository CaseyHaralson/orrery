# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project-scoped isolation: `ORRERY_WORK_DIR` now auto-scopes to a `<basename>-<hash>` subdirectory per project, preventing plan conflicts across repos
- `--background` flag on `orrery exec` to run orchestration as a detached background process with log file
- `--plan <file>` option on `orrery resume` to resume a specific plan without branch auto-detection
- Execution locking prevents concurrent `orrery exec`/`orrery resume` runs within a project
- `orrery status` shows active execution status and detects stale lock files

## [0.11.0] - 2026-02-08

### Added

- `manual` command and HELP.md reference document for comprehensive CLI documentation

## [0.10.0] - 2026-01-25

### Fixed

- Firewall init script now uses `-exist` flag for ipset commands to prevent errors on re-runs
- Plan step execution now respects plan order: serial steps act as implicit barriers for subsequent steps
- `partitionSteps()` no longer prioritizes parallel steps over serial steps regardless of plan position
- Parallel worktrees now created in `.worktrees/` inside repo instead of at filesystem root
- Parallel step progress now shows batch "(X-Y of Z)" format instead of confusing duplicate counts

### Added

- Parallel execution mode with git worktree isolation via `--parallel` flag or `ORRERY_PARALLEL_ENABLED=true`
- `ORRERY_PARALLEL_MAX` environment variable to control maximum concurrent agents (default: 3)
- Git worktree utilities: `addWorktree`, `removeWorktree`, `listWorktrees`, `getCommitRange`, `cherryPick`, `deleteBranch`
- Discovery skill now includes dependency detection rules, parallelization safety rules, and project structure guidance
- Refine-plan skill now includes dependency detection rules and parallelization safety checks
- Plan validation now warns when parallel steps modify the same files

## [0.9.1] - 2026-01-24

### Fixed

- Preserve original execute agent commit message through review cycles instead of using edit agent's generic message

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

[Unreleased]: https://github.com/CaseyHaralson/orrery/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/CaseyHaralson/orrery/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/CaseyHaralson/orrery/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/CaseyHaralson/orrery/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/CaseyHaralson/orrery/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/CaseyHaralson/orrery/compare/v0.7.2...v0.8.0
[0.7.2]: https://github.com/CaseyHaralson/orrery/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/CaseyHaralson/orrery/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/CaseyHaralson/orrery/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/CaseyHaralson/orrery/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/CaseyHaralson/orrery/releases/tag/v0.5.0
