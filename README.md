# Orrery

**Structured Workflow Orchestration for AI Agents**

Orrery is a CLI tool designed to transform high-level development goals into executable, traceable, and engineered workflows. It turns high-level goals ("Add a user login system") into executable, step-by-step plans that agents follow autonomously, ensuring consistent and high-quality results.

## When to Use Orrery

**Good fit:**

- Multi-step features requiring coordinated changes across many files
- You want to review a plan before letting it run autonomously
- Tasks with clear dependencies between implementation steps

**Use your AI agent directly when:**

- Quick fixes or small changes
- Exploratory development where you're discovering as you go
- You want to stay interactive with every decision

See [Comparison](docs/COMPARISON.md) for a detailed analysis.

## Installation

Prerequisites:

- Node.js
- Git
- Initialized Git repository (your project where you want work done)
- Access to LLM agent tools (Claude Code, Codex cli, or Gemini cli)

### Global Installation

To install Orrery globally on your system:

```bash
npm install -g @caseyharalson/orrery
```

## Quick Start

Follow this workflow to go from a high-level goal to finished code.

### 1. Initialize Orrery

Install the necessary "Skills" into your global agent configuration directories (e.g., `~/.claude/skills`). Orrery will auto-detect which agents you have installed.

```bash
orrery init
```

### 2. Create a Plan

Navigate to your project directory (root of the git repository). Use your AI agent (now equipped with the `discovery` skill) to generate a plan.

- **Prompt your agent:** _"I want to [goal]. Please activate the `discovery` skill and create a comprehensive plan."_ or _"/discovery I want to [goal]"_

### 3. Execute

Run the orchestrator to execute the plan steps. Orrery will create a dedicated work branch and manage agent interactions.

```bash
orrery exec
```

## Important: Autonomous Execution

When you run `orrery exec`, agents execute plan steps **autonomously without step-by-step confirmation**. This enables fully automated workflows but means agents can modify files and run commands without asking.

**Built-in safeguards:**

- All work happens on an isolated branch (not your main branch)

**For additional isolation**, run Orrery inside a devcontainer. This provides a sandboxed environment where agent actions are contained. See [Devcontainer Setup](docs/advanced-workflows.md#devcontainer-setup) in Advanced Workflows.

## Advanced Workflows

For power users, Orrery offers additional capabilities:

- **Plan Refinement & Simulation** - Analyze, improve, and explore plans before execution
- **Devcontainer Setup** - Isolated, reproducible development environments
- **External Plan Creation** - Import plans from other tools or LLMs
- **Review Loop** - Iterative code review after each step with automatic fixes
- **Handling Blocked Plans** - Recovery workflows when steps cannot complete

See [Advanced Workflows](docs/advanced-workflows.md) for details.

---

## Core Concepts

### Skills

Skills are modular instruction sets that teach an agent how to perform specific phases of work.

- **Discovery:** Analyze requirements and generate plans.
- **Refine-Plan:** Analyze and improve an existing plan by fixing oversights, improving context quality, and strengthening acceptance criteria.
- **Simulate-Plan:** Conversational dialogue to explore plans, identify risks, and verify approaches before execution.

### Plans

Plans are YAML files that define the "contract" for the work. They break down complex goals into ordered steps with:

- **Dependencies:** Pre-requisites for execution.
- **Acceptance Criteria:** explicit conditions for success.
- **Context:** Instructions and file paths relevant to the step.

### The Orchestrator

The Orchestrator (`orrery exec`) is the engine that drives the process. It loads plans, resolves dependencies, invokes the appropriate agents, and manages the lifecycle of the task, including reporting and archiving.

---

## Command Reference

| Command              | Description                                                                                                           |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `orrery`             | Command reference.                                                                                                    |
| `orrery init`        | Initialize Orrery: install skills to detected agents.                                                                 |
| `orrery orchestrate` | Executes the active plan. Use `--resume` to continue a partially completed plan on the current branch. Alias: `exec`. |
| `orrery status`      | Shows the progress of current plans.                                                                                  |

## Directory Structure

Orrery maintains its state in the `.agent-work/` directory (configurable via `ORRERY_WORK_DIR`).

- `.agent-work/plans/`: **Active Plans.** New and in-progress plan files.
- `.agent-work/reports/`: **Reports.** Step-level execution logs and outcomes.
- `.agent-work/completed/`: **Archive.** Successfully executed plans are moved here.

---

_Happy Building!_ ❤️
