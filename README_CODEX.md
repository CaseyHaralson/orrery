# Orrery

Orrery guides your project from “here’s the goal” to “done and reported.” You hand it a plan, it installs the right agent skills, runs each step in order, and keeps everything trackable when work gets interrupted.

## The user flow (end to end)

### 1) Start with a goal

Decide what you want done. If you already have a plan YAML, skip to step 2.

### 2) Install skills for your agents

```bash
orrery install-skills --agent all
```

### 3) Turn the goal into a plan (or bring your own)

Ask a Discovery agent to generate a plan YAML and place it in:

`.agent-work/plans/`

Optional: validate the plan before running it:

```bash
orrery validate-plan
```

### 4) Run the plan

```bash
orrery orchestrate
```

### 5) Track progress

```bash
orrery status
```

### 6) Resume if anything stops

```bash
orrery orchestrate --resume
```

In-progress steps reset to `pending`, and the run continues where it left off.

## What you’ll see in your repo

Orrery writes to `.agent-work/` by default (override with `ORRERY_WORK_DIR`).

- `.agent-work/plans/`: Your active plan YAML files
- `.agent-work/reports/`: Step-level reports from execution
- `.agent-work/completed/`: Finished plans

## When to use Orrery

- You want consistent, repeatable multi-step agent work
- You need to pause/resume without losing plan state
- You want a clear trail of what was done and why

## Commands you’ll actually use

- `orrery install-skills`: Install skills for supported agents
- `orrery orchestrate` (alias: `orrery exec`): Run a plan
- `orrery status`: Show plan status
- `orrery validate-plan`: Validate and normalize a plan
- `orrery help`: Show help for any command

For detailed flags, run `orrery help <command>`.

## Under the hood (short version)

- **Skills**: Instruction bundles in `agent/skills/` with a `SKILL.md` per role
- **Plans**: YAML files defining steps, dependencies, and acceptance criteria
- **Orchestrator**: The engine in `lib/orchestration/` that runs plans and tracks status
