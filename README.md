# Orrery

**Structured Workflow Orchestration for AI Agents**

Orrery is a CLI tool designed to transform high-level development goals into executable, traceable, and engineered workflows. It turns high-level goals ("Add a user login system") into executable, step-by-step plans that agents follow autonomously, ensuring consistent and high-quality results.

## Installation

Prerequisites:
- Node.js
- Git
- Initialized Git repository (your project where you want work done)
- Access to LLM agent tools (Claude Code, Gemini cli, etc.)

### Global Installation

To install Orrery globally on your system:

```bash
npm install -g orrery
```

### Local Development

To run Orrery from the source repository:

```bash
git clone https://github.com/CaseyHaralson/orrery.git
cd orrery
npm install
npm link
```

---

## Quick Start

Follow this workflow to go from a high-level goal to finished code.

### 1. Initialize Agent Skills

Install the necessary "Skills" into your global agent configuration directories (e.g., `~/.claude/skills`). Orrery will auto-detect which agents you have installed.

```bash
orrery install-skills
```

### 2. Create a Plan

Navigate to your project directory (root of the git repository). Use your AI agent (equipped with the `discovery` skill) to generate a plan.

*   **Prompt your agent:** *"I want to [goal]. Please activate the `discovery` skill and create a comprehensive plan."*

### 3. Simulate the Plan

Use the `simulate-plan` skill to explore the plan through conversational dialogue before execution. This helps you identify risks and verify the approach.

*   **Prompt your agent:** *"Let's think through this plan before we start."* or *"/simulate .agent-work/plans/my-plan.yaml"*

### 4. Execute (Orchestrate)

Run the orchestrator to execute the plan steps. Orrery will create a dedicated work branch, manage agent interactions, and automatically create a Pull Request upon completion.

```bash
orrery exec
```

### 5. Monitor and Review

Check the status of active plans using `orrery status`. Once complete, review and merge the generated Pull Request.

```bash
orrery status
```

## Handling Blocked Plans

Sometimes a plan step cannot be completed due to external issues (e.g., an API is unavailable, a dependency is missing). When this happens, the agent marks the step as "blocked" and the orchestrator pauses execution.

### Identifying Blocked Steps

Use the `orrery status` command to see which plans are blocked and which steps are blocked:

```bash
orrery status # view the plans that are blocked
orrery status --plan .agent-work/plans/<plan> # view the status of each step
```

Inspect the plan file directly in `.agent-work/plans/` to see the `blocked_reason` for each blocked step.

### Recovery Workflow

1. **Check the blocked reason**: Use `orrery status` to identify which plans are blocked and then check on the blocked reason in the plan
2. **Fix the underlying issue**: Address the problem (e.g., restore the API, install the missing dependency)
3. **Edit the plan file**: Change the step status from `blocked` to `pending` in the YAML file
4. **Resume orchestration**:
   ```bash
   git checkout <work-branch>  # Switch to the plan's work branch
   orrery orchestrate --resume
   ```

The `--resume` flag finds the plan matching your current branch and continues execution from where it left off.

---

## Core Concepts

### Skills

Skills are modular instruction sets that teach an agent how to perform specific phases of work.

*   **Discovery:** Analyze requirements and generate plans.
*   **Simulate:** Conversational dialogue to explore plans, identify risks, and verify approaches before execution.

### Plans

Plans are YAML files that define the "contract" for the work. They break down complex goals into ordered steps with:

*   **Dependencies:** Pre-requisites for execution.
*   **Acceptance Criteria:** explicit conditions for success.
*   **Context:** Instructions and file paths relevant to the step.

### The Orchestrator

The Orchestrator (`orrery exec`) is the engine that drives the process. It loads plans, resolves dependencies, invokes the appropriate agents, and manages the lifecycle of the task, including reporting and archiving.

---

## Command Reference

| Command | Description |
| :--- | :--- |
| `orrery` | Command reference. |
| `orrery install-skills` | Installs/Updates agent skills to your global agent configuration directories. |
| `orrery orchestrate` | Executes the active plan. Use `--resume` to continue a partially completed plan on the current branch. Alias: `exec`. |
| `orrery status` | Shows the progress of current plans. |
| `orrery install-devcontainer` | Installs/Updates a devcontainer in your project. |

## Directory Structure

Orrery maintains its state in the `.agent-work/` directory (configurable via `ORRERY_WORK_DIR`).

*   `.agent-work/plans/`: **Active Plans.** New and in-progress plan files.
*   `.agent-work/reports/`: **Reports.** Step-level execution logs and outcomes.
*   `.agent-work/completed/`: **Archive.** Successfully executed plans are moved here.

---

*Happy Building.*