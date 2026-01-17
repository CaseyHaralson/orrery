# Orrery

Agent Skill Management & Workflow Orchestration

Orrery turns high-level goals into executable plans using AI agents. It provides a structured workflow for discovery, execution, and verification so teams can move from an idea to a completed change with clear steps and traceable outputs.

## Installation

Prerequisites:
- Node.js
- Git
- Access to LLM agents (Claude, Gemini, etc.)

Install globally:

```bash
npm install -g .
```

Run locally from the repo:

```bash
./bin/orrery.js
```

## Core Concepts

### Skills

Skills are focused instruction bundles that teach an agent how to perform a specific phase of work. In Orrery, Skills live under `agent/skills/`, each with a `SKILL.md` that defines when it applies and how it should operate (for example, discovery, execution, verification).

### Plans

Plans are YAML files that break work into ordered steps with dependencies, requirements, and acceptance criteria. The schema that defines the structure lives at `agent/skills/discovery/schemas/plan-schema.yaml`, and each plan step tracks status (pending, in_progress, complete, blocked) along with contextual guidance for agents.

### Orchestrator

The Orchestrator is the engine that loads plans, resolves dependencies, invokes agents, and manages plan lifecycle. The implementation in `lib/orchestration/` handles plan discovery, branching, step dispatch, status updates, reporting, and archiving.

## Getting Started Workflow

This is the full lifecycle Orrery follows from idea to PR:

1. Discovery (idea to plan)
   - Share the goal with the Discovery agent; it produces a plan YAML under `.agent-work/plans/`.
   - Each plan includes step metadata, dependencies, acceptance criteria, and suggested files.

2. Validate the plan
   - Run `orrery validate-plan` to confirm the plan matches the schema and has consistent dependencies.

3. Orchestrate execution
   - Run `orrery orchestrate` (alias: `orrery exec`) to execute steps.
   - The orchestrator records the current branch as the source branch (for example, `main`).
   - It assigns a dedicated work branch per plan (derived from the plan filename) and updates the plan metadata on the source branch.
   - Work happens on the plan's work branch; agent outputs are committed as steps finish.

4. Completion and archiving
   - When all steps are complete, the plan is archived to `.agent-work/completed/`.
   - The orchestrator creates a pull request back to the source branch and returns you to the source branch.

Resume capability:
- If orchestration is interrupted, check out the plan's work branch and run `orrery orchestrate --resume`.
- Resume mode reloads the plan, resets any `in_progress` steps to `pending`, and continues execution.
