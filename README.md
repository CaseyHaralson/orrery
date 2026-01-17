# orrery

orrery is a CLI for managing agent skills and orchestrating multi-step plans in a project.
It installs a curated set of skills for supported agents, then runs orchestration plans
so agents can execute each step with the right guidance.

Skills are short, reusable instruction sets. During orchestration, orrery matches the
active plan step to available skills so agents can follow your standards without you
repeating the same guidance. For background on skills, see
[docs/agent-skills-definition.md](docs/agent-skills-definition.md).

## Install

```bash
npm install -g orrery
```

## Quickstart

```bash
orrery install-skills --agent all
orrery orchestrate
```

Check plan progress at any time:

```bash
orrery status
```

## Command reference

### install-skills

Install the bundled orrery skills into supported agent directories.

```bash
orrery install-skills [--agent <agent>] [--force] [--dry-run]
```

Options:
- `--agent <agent>`: Target agent (`claude`, `codex`, `gemini`, or `all`). Defaults to auto-detect.
- `--force`: Overwrite existing skills.
- `--dry-run`: Show what would be copied without writing files.

### orchestrate

Run plan orchestration for the current project. Alias: `exec`.

```bash
orrery orchestrate [--plan <file>] [--dry-run] [--verbose] [--resume]
```

Options:
- `--plan <file>`: Process only a specific plan file.
- `--dry-run`: Show what would be executed without running agents.
- `--verbose`: Show detailed agent output.
- `--resume`: Resume orchestration on the current work branch.

### status

Show orchestration status for plans in the current project.

```bash
orrery status [--plan <file>]
```

Options:
- `--plan <file>`: Show detailed status for a specific plan (path or plan name).
