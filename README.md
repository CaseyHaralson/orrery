# Orrery

**Turn AI Chaos into Engineered Progress.**

Orrery is a CLI tool that structures your interaction with AI coding agents. Instead of endless chat loops and copy-pasting, Orrery provides a disciplined workflow: **Discovery, Planning, Execution, and Verification.**

It turns high-level goals ("Add a user login system") into executable, step-by-step plans that agents follow autonomously, ensuring consistent and high-quality results.

---

## Why Orrery?

*   **Stop Micromanaging:** Don't paste code back and forth. Give the agent a plan and let it execute.
*   **Structured Workflow:** Move from "Idea" to "Pull Request" using a proven engineering process (Plan -> Execute -> Verify).
*   **Skill Injection:** Automatically teaching your agents (Claude, Gemini, etc.) specialized skills for the task at hand.
*   **Traceability:** Every step is recorded. You know exactly what the agent did and why.

## How to Use Orrery (Step-by-Step)

Follow this path to go from zero to finished code.

### 1. Install the CLI
Get the tool installed on your machine.

```bash
npm install -g orrery
```

### 2. Equip Your Agent
Orrery works by giving your AI agent (Claude, Gemini, etc.) specific "Skills" to understand this workflow. You need to install these skills into your project configuration.

```bash
orrery install-skills --agent all
```
*Effect: This copies instruction files into `.gemini/` or `.claude/` folders so your agent knows how to generate plans.*

### 3. Create a Plan
Now, talk to your agent. Don't ask it to write code yet; ask it to **plan**. Use the `discovery` skill.

**Copy-paste this prompt to your agent:**
> "I want to [describe your goal, e.g., 'add a dark mode toggle to the website']. Please activate the `discovery` skill and create a comprehensive plan for this."

*Effect: The agent will think and generate a YAML plan in `.agent-work/plans/` (e.g., `add-dark-mode.yaml`).*

### 4. Review & Validate
Check the plan the agent created. It's just a text file.

```bash
orrery validate-plan
```
*Effect: Ensures the plan structure is valid. If you want to change the plan, just edit the YAML file directly.*

### 5. Execute the Plan
This is where the magic happens. Run the orchestrator to have agents execute the steps defined in the plan.

```bash
orrery orchestrate
```
*Effect: Orrery creates a new git branch, spins up agents for each step, writes code, runs tests, and commits the changes.*

### 6. Finish
Once finished, Orrery will archive the plan. You can now review the code on the new branch and merge it!

---

## Commands Reference

| Command | Description |
| :--- | :--- |
| `orrery install-skills` | Installs/Updates agent skills in your project. |
| `orrery orchestrate` | Executes the active plan. Alias: `exec`. |
| `orrery status` | Shows the progress of current plans. |
| `orrery validate-plan` | Checks a plan file for errors. |
| `orrery install-devcontainer` | Sets up a standardized dev environment. |

## Core Concepts

*   **Skills:** Reusable "personas" for agents (e.g., "The Architect", "The Tester").
*   **Plans:** YAML files defining *what* needs to be done. They are the contract between you and the agent.
*   **Orchestrator:** The CLI tool that drives the agents through the plan.

## Directory Layout

Orrery keeps its state in your project folder (git-ignored by default):

*   `.agent-work/plans/`: Your active todo lists.
*   `.agent-work/reports/`: Logs of what the agents did.
*   `.agent-work/completed/`: Archived finished plans.

---

*Happy Building.*