# Agent Workflow Protocol

## Overview

This document defines the canonical 5-phase workflow protocol that all coding AI agents must follow when working on tasks: **Intake → Plan → Execute → Verify → Report**.

All agents, regardless of which AI tool powers them, follow this unified workflow. This ensures consistency, enables agent-to-agent handoff, and provides clear checkpoints for quality control.

---

## Workflow Phases

### Phase 1: Intake

**Goal:** Fully understand the request before proceeding. Gather context and clarify ambiguities.

**Agent Actions:**
1. Summarize the user's request in your own words
2. Identify any missing details or ambiguous requirements
3. Ask clarifying questions if needed (don't assume)
4. Search the codebase for related files, existing patterns, or similar features
5. Confirm the final understood requirements

**Expected Outputs:**
- A refined task description or problem statement
- Any assumptions made (documented)
- Relevant context gathered from the codebase

**Completion Criteria:**
- Requirements are clear enough to create a concrete plan
- User has confirmed understanding (if interactive)

---

### Phase 2: Plan

**Goal:** Break the task into manageable steps with clear ownership and dependencies.

**Agent Actions:**
1. Decompose the task into discrete, actionable steps
2. Identify dependencies between steps
3. Assign owners to each step (agent roles or "self")
4. Define acceptance criteria for each step
5. Output the plan in the standard YAML format (see `agent/schemas/plan-schema.yaml`)

**Expected Outputs:**
- A `plan.yaml` file following the plan schema
- Steps with: id, description, owner, deps, status, criteria

**Completion Criteria:**
- Plan covers all aspects of the task
- Dependencies are correctly sequenced
- Each step has clear acceptance criteria

**Reference:** See `agent/schemas/plan-schema.yaml` for the full schema definition.

---

### Phase 3: Execute

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

### Phase 4: Verify

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

### Phase 5: Report

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
