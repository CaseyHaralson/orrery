# Orrery

**Agent Skill Management & Workflow Orchestration**

Orrery is a CLI for managing agent skills and orchestrating multi-step plans in a project. It turns high-level goals into executable plans using AI agents, providing a structured workflow for discovery, execution, and verification so teams can move from an idea to a completed change with clear steps and traceable outputs.

## Installation

### Global Install

Prerequisites: Node.js, Git.

```bash
npm install -g orrery
```

### Local Development

Run locally from the repository:

```bash
./bin/orrery.js
```

## Quickstart

1.  **Create a Plan:** Create or place a plan YAML in `.agent-work/plans/`.
2.  **Install Skills:**
    ```bash
    orrery install-skills --agent all
    ```
3.  **Run Orchestration:**
    ```bash
    orrery orchestrate
    ```
4.  **Check Status:**
    ```bash
    orrery status
    ```

## Core Concepts

*   **Skills:** Focused instruction bundles that teach an agent how to perform a specific phase of work (e.g., discovery, execution, verification). Skills live under `agent/skills/`.
*   **Plans:** YAML files that break work into ordered steps with dependencies, requirements, and acceptance criteria.
*   **Orchestrator:** The engine that loads plans, resolves dependencies, invokes agents, and manages plan lifecycle (status updates, reporting, archiving).

## Workflow

The full lifecycle from idea to completion:

1.  **Discovery:** Share a goal with the Discovery agent to produce a plan YAML under `.agent-work/plans/`.
2.  **Validation:** Run `orrery validate-plan` to confirm the plan structure and dependencies.
3.  **Orchestration:** Run `orrery orchestrate` (alias: `exec`) to execute steps. The orchestrator manages work branches and commits agent outputs.
4.  **Completion:** When all steps are complete, the plan is archived to `.agent-work/completed/`.

## CLI Reference

### install-skills

Install the bundled orrery skills into supported agent directories (`claude`, `codex`, `gemini`).

```bash
orrery install-skills [--agent <agent>] [--force] [--dry-run]
```

### orchestrate (alias: exec)

Run plan orchestration for the current project.

```bash
orrery orchestrate [--plan <file>] [--dry-run] [--verbose] [--resume]
```

*   `--resume`: Resume orchestration on the current work branch.

### status

Show orchestration status for plans in the current project.

```bash
orrery status [--plan <file>]
```

### validate-plan

Validate a plan YAML file and normalize formatting.

```bash
orrery validate-plan [file] [--no-resave]
```

### install-devcontainer

Copy the bundled devcontainer into a target directory.

```bash
orrery install-devcontainer [target] [--force] [--dry-run]
```

### help

Display help for a command.

```bash
orrery help [command]
```

## Directory Structure

*   `.agent-work/plans/`: Active plan YAML files.
*   `.agent-work/reports/`: Step-level report YAML files emitted by agents.
*   `.agent-work/completed/`: Completed plans.
