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
