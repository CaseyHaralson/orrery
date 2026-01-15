# Agent Workflow Protocol

## Overview

This document defines the canonical 4-phase workflow protocol that all coding AI agents must follow when working on tasks: **Discovery → Execute → Verify → Report**.

All agents, regardless of which AI tool powers them, follow this unified workflow. This ensures consistency, enables agent-to-agent handoff, and provides clear checkpoints for quality control.

---

## Workflow Phases

### Phase 1: Discovery

**Goal:** Turn the request into an orchestrator-ready plan with clear scope and acceptance criteria.

**Agent Actions:**
1. Summarize the user's request in your own words
2. Identify ambiguities or missing details and clarify them
3. Search the codebase for related files, existing patterns, or similar features
4. Decompose the work into outcomes → capabilities → features → implementation steps
5. Define acceptance criteria for each step
6. Output the plan in the standard YAML format (see `agent/schemas/plan-schema.yaml`)
7. Save the plan to the `.agent-work/plans/` directory with the following filename: `<date>-<plan-name>.yaml`

**Expected Outputs:**
- A refined task description or problem statement
- A `<date><plan-name>.yaml` file following the plan schema in the plans directory
- Steps with: id, description, deps, status, criteria

**Completion Criteria:**
- Plan covers all aspects of the task
- Dependencies are correctly sequenced
- Each step has clear acceptance criteria

**Reference:** See `agent/schemas/plan-schema.yaml` for the full schema definition.

---

### Phase 2: Execute

**Goal:** Implement the plan steps—write code, make changes, create files.

**Agent Actions:**
1. Mark the current step as `in_progress` in the plan
2. Open or create relevant files
3. Write code following project conventions
4. Make incremental commits at logical points
5. If a step fails, attempt to fix or mark as `blocked`
6. Update step status to `complete` when done

**Expected Outputs:**
- Source code files (created or modified)
- Commits with meaningful messages
- Updated plan with step statuses

**Commit Message Format:**
```
<type>: <short description>

<optional body explaining what and why>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

**Error Handling:**
- If tests fail during execution, attempt to fix
- If blocked, mark step as `blocked` with reason
- Prefer additive changes over destructive ones
- Use version control branches for safety on major changes

**Completion Criteria:**
- All assigned steps are either `complete` or explicitly `blocked`
- Code compiles/runs without syntax errors

---

### Phase 3: Verify

**Goal:** Validate that changes meet acceptance criteria and nothing is broken.

**Agent Actions:**
1. Run the project's test suite
2. Run linters and static analysis if available
3. Check each step's acceptance criteria
4. For UI changes, verify visually if possible
5. Collect test results and any errors
6. If verification fails, loop back to Execute or mark step as needing attention

**Expected Outputs:**
- Test results (pass/fail counts)
- Any error messages or warnings
- Updated plan statuses based on verification

**Completion Criteria:**
- All tests pass (or failures are documented)
- Acceptance criteria for each step are met
- No regressions in existing functionality

**Note:** Do not skip verification. Even for trivial changes, run at least basic checks.

---

### Phase 4: Report

**Goal:** Summarize results clearly for the user or for handoff.

**Agent Actions:**
1. Compile final status of all plan steps
2. List what was accomplished
3. Note any remaining issues or follow-ups
4. Reference commits, branches, or PRs if applicable
5. Format the report following `agent/schemas/report-schema.yaml`

**Expected Outputs:**
- A summary report (can be in-chat or as `report.yaml`)
- Pointers to artifacts: commits, files changed, test results

**Report Structure:**
- **What was done:** Summary of completed work
- **Results:** Test outcomes, verification status
- **Next steps:** Any remaining work or recommendations

**Reference:** See `agent/schemas/report-schema.yaml` for structured report format.

---

## General Policies

### Coding Style

[To be defined: project-specific coding standards and conventions]

### Safety Rules

[To be defined: safety and security guidelines for agent operations]

---

## Agent Roles

### Coordinator Agent

The Coordinator oversees multi-step or multi-agent work:

- **Reads and maintains** the plan structure
- **Decides** which step(s) to execute next based on dependencies
- **Dispatches** steps to Worker agents (or executes them directly)
- **Monitors** progress and updates plan statuses
- **Handles** failures by adding remedial steps or escalating

The Coordinator does not typically write code directly—it orchestrates.

### Worker Agent

Workers execute individual plan steps:

- **Receives** a step assignment from the Coordinator (or self-assigns)
- **Loads** the appropriate skill (execute, verify, etc.)
- **Performs** the work according to skill instructions
- **Reports** completion status and any artifacts back

Workers focus on doing the actual implementation work.

### Single-Agent Mode

When only one agent is working, it acts as both Coordinator and Worker:
- Self-manages the plan
- Executes steps sequentially
- Updates statuses as it progresses

---

## Agent-to-Agent Handoff Protocol

Handoff enables one agent to pass work to another (or to resume interrupted work).

### How It Works

1. **Plan as contract:** The `plan.yaml` file is the source of truth. Any agent can read it to understand what's done and what's pending.

2. **Status tracking:** Each step has a `status` field:
   - `pending` - not started
   - `in_progress` - currently being worked on
   - `complete` - finished successfully
   - `blocked` - cannot proceed (includes reason)

3. **Resumption:** A new agent reads the plan, finds the first `pending` step with satisfied dependencies, and continues from there.

4. **Artifacts in repo:** All outputs (code, reports, test results) are written to the repository, not held in agent memory. This allows any agent to see current state.

### Handoff Checklist

Before handing off:
- [ ] Plan file is saved and up to date
- [ ] All completed steps are marked `complete`
- [ ] Any blocked steps have documented reasons
- [ ] Code changes are committed
- [ ] No work exists only in agent memory

### Cross-Tool Handoff

Since all tools use the same plan schema and skill definitions:
- Agent A (Claude) can create a plan
- Agent B (Gemini) can read that plan and execute steps
- Agent C (Codex) can verify and report

The shared protocol makes this seamless.

---

## Orchestrated Workflow Mode

For automated execution of plans, an orchestration system coordinates worker agents to execute plan steps.

### Workflow Split

The 4-phase workflow can be split into two modes:

1. **Planning Mode** (Discovery)
   - Human or agent creates a plan through the discovery phase
   - Plan is saved to `.agent-work/plans/` directory
   - Execution stops after plan creation

2. **Orchestration Mode** (Execute → Verify → Report)
   - Orchestrator script scans `.agent-work/plans/` for pending plans
   - Dispatches worker agents to execute steps
   - Tracks completion and archives finished plans

### Discovery: Big Ideas → Orchestrator-Ready Plans

Discovery is the planning entry point for all work, from small tasks to multi-feature initiatives:

```
Discovery Workflow:
IDEA → OUTCOMES → CAPABILITIES → FEATURES → IMPLEMENTATION STEPS
```

Discovery produces **orchestrator-ready plans** directly—no separate planning phase needed. Each feature is decomposed into 2-5 concrete implementation steps that agents can execute autonomously.

**When to use Discovery:**
- **Large initiatives**: Full decomposition ladder and explicit dependencies
- **Small tasks**: Same workflow, but keep steps concise and focused

See `agent/skills/discovery/SKILL.md` for full instructions.

### Running the Orchestrator

```bash
npm run orchestrate
```

The orchestrator will:
1. Scan `.agent-work/plans/` for YAML plan files
2. Exclude plans already in `.agent-work/completed/`
3. For each plan, identify steps ready to execute (pending with deps satisfied)
4. Spawn agent subprocesses to execute steps
5. Update plan statuses based on agent results
6. Write reports to `.agent-work/reports/`
7. Move completed plans to `.agent-work/completed/`

### Worker Agent Contract

When invoked by the orchestrator, a worker agent:

**Receives:**
- Plan file path (read-only reference)
- Step ID(s) to execute

**Must:**
1. Read plan file to understand step requirements (DO NOT edit plan file)
2. Load execute, verify, and report skills
3. Implement the step changes
4. Verify work meets acceptance criteria
5. Output structured result to stdout as JSON:

```json
{
  "stepId": "step-1",
  "status": "complete",
  "summary": "What was done",
  "blockedReason": null,
  "artifacts": ["src/file.js"],
  "testResults": { "passed": 5, "failed": 0 }
}
```

6. Exit with code 0 (success) or 1 (failure)

**Important:** Agents do NOT edit the plan file directly. The orchestrator handles all plan updates to avoid concurrent write conflicts.

### Configuration

Orchestrator settings are in `agent/scripts/config/orchestrator.config.js`:

- **paths**: Directories for plans, completed, reports
- **agents**: Per-agent command configurations (claude, codex, gemini)
- **defaultAgent**: Which agent to use when failover is disabled
- **agentPriority**: Priority list of agents to try (with failover)
- **concurrency**: Max parallel agents, poll interval
- **retry**: Retry policy for failed steps

### Directory Structure

```
.agent-work/
├── plans/           # Active plan files awaiting execution
├── completed/       # Archived plans that finished
└── reports/         # Step execution reports
```

### Parallel Execution

Steps marked with `parallel: true` can run concurrently:

```yaml
steps:
  - id: "test-frontend"
    parallel: true
    deps: ["build"]
    # ...
  - id: "test-backend"
    parallel: true
    deps: ["build"]
    # ...
```

The orchestrator respects `maxParallel` limit and groups parallel steps together.
