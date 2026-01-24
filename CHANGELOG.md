# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/CaseyHaralson/orrery/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/CaseyHaralson/orrery/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/CaseyHaralson/orrery/releases/tag/v0.5.0
