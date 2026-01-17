# Orrery

**Structured Workflow Orchestration for AI Agents**

Orrery is a CLI tool designed to transform high-level development goals into executable, traceable, and engineered workflows. It turns high-level goals ("Add a user login system") into executable, step-by-step plans that agents follow autonomously, ensuring consistent and high-quality results.

## Installation

Prerequisites:
- Node.js
- Git
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

Install the necessary "Skills" into your project's agent configuration directories (e.g., `.gemini/` or `.claude/`).

```bash
orrery install-skills
```

<!--
this needs to be in a target directory. we need to mention that somehow
-->
### 2. Create a Plan

Use your AI agent (equipped with the `discovery` skill) to generate a plan.

*   **Prompt your agent:** *"I want to [goal]. Please activate the `discovery` skill and create a comprehensive plan."*

<!-- 
change this next step to use the simulate-plan skill 
the user doesn't need to validate the plan, that is done automatically. don't mention it.
-->
### 3. Validate the Plan

Ensure the generated plan adheres to the schema and has valid dependencies.

```bash
orrery validate-plan
```

<!--
this needs to be in a target directory. we need to mention that somehow
-->
### 4. Execute (Orchestrate)

Run the orchestrator to execute the plan steps. Orrery will manage the agent interactions, code generation, and verification.

```bash
orrery exec
```

<!--
check the PR or create a PR for the work.
question, will this project work in a non-git repo? i'm not sure
-->
### 5. Monitor Progress
Check the status of active plans.

```bash
orrery status
```

---

## Core Concepts

### Skills

Skills are modular instruction sets that teach an agent how to perform specific phases of work.

*   **Discovery:** Analyze requirements and generate plans.
<!-- add the simulate-plan skill here -->

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
| `orrery install-skills` | Installs/Updates agent skills in your project. |
| `orrery orchestrate` | Executes the active plan. Alias: `exec`. |
| `orrery status` | Shows the progress of current plans. |
| `orrery install-devcontainer` | Sets up a standardized dev environment. |

## Directory Structure

Orrery maintains its state in the `.agent-work/` directory (configurable via `ORRERY_WORK_DIR`).

*   `.agent-work/plans/`: **Active Plans.** New and in-progress plan files.
*   `.agent-work/reports/`: **Reports.** Step-level execution logs and outcomes.
*   `.agent-work/completed/`: **Archive.** Successfully executed plans are moved here.

---

*Happy Building.*