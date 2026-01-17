# Orrery

Orrery is a CLI for managing agent skills and orchestrating multi-step plans in a project. It installs curated skills for supported agents, then runs orchestration so agents can execute each step with consistent guidance.

## Install

```bash
npm install -g orrery
```

## Quickstart

Create or place a plan YAML in `.agent-work/plans/`, then:

```bash
orrery install-skills --agent all
orrery orchestrate
```

Check plan progress:

```bash
orrery status
```

## Core Concepts

### Skills

Skills are focused instruction bundles stored under `agent/skills/`, each with a `SKILL.md` that defines when it applies and how it should operate (discovery, execution, verification, etc.).

### Plans

Plans are YAML files that break work into ordered steps with dependencies, requirements, and acceptance criteria. The schema lives at `agent/skills/discovery/schemas/plan-schema.yaml`, and each step tracks status (`pending`, `in_progress`, `complete`, `blocked`).

### Orchestrator

The Orchestrator loads plans, resolves dependencies, invokes agents, and manages plan lifecycle. The implementation lives in `lib/orchestration/` and handles plan discovery, branching, step dispatch, status updates, reporting, and archiving.

## Workflow (Idea to PR)

1. Discovery
   - Share the goal with the Discovery agent; it produces a plan YAML under `.agent-work/plans/`.
2. Validate the plan
   - Run `orrery validate-plan` to confirm the plan matches the schema and dependencies.
3. Orchestrate execution
   - Run `orrery orchestrate` (alias: `orrery exec`) to execute steps on a dedicated work branch.
4. Completion and archiving
   - Completed plans move to `.agent-work/completed/` and the orchestrator prepares a pull request.

Resume capability:
- If orchestration is interrupted, run `orrery orchestrate --resume` on the plan's work branch. In-progress steps reset to `pending` and execution continues.

## CLI Reference

### install-skills

Install Orrery skills for supported agents.

```bash
orrery install-skills [--agent <agent>] [--force] [--dry-run]
```

Options:
- `--agent <agent>`: Target agent (`claude|codex|gemini|all`), defaults to auto-detect.
- `--force`: Overwrite existing skills.
- `--dry-run`: Show what would be copied without writing files.

### install-devcontainer

Copy the bundled devcontainer into a target directory.

```bash
orrery install-devcontainer [target] [--force] [--dry-run]
```

### orchestrate (alias: exec)

Run plan orchestration for the current project.

```bash
orrery orchestrate [--plan <file>] [--dry-run] [--verbose] [--resume]
```

### status

Show orchestration status for plans in the project.

```bash
orrery status [--plan <file>]
```

### validate-plan

Validate a plan YAML file and normalize formatting.

```bash
orrery validate-plan [file] [--no-resave]
```

### help

Display help for a command.

```bash
orrery help [command]
```

## Directory Structure

By default, Orrery stores work artifacts under `.agent-work/` (override with `ORRERY_WORK_DIR`).

- `.agent-work/plans/`: Active plan YAML files.
- `.agent-work/reports/`: Step-level report YAML files emitted during orchestration.
- `.agent-work/completed/`: Plans moved here once orchestration finishes.
