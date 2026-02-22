---
name: orrery-execute
description: >
  Write or modify code according to a plan step. Handle implementation.
user-invocable: false
---

# Execute Skill

## When to Use

Use this skill to **implement code changes** defined in a plan step.

**Triggers:**

- You are invoked by the Orchestrator to work on specific `stepIds`.
- A plan exists with pending steps.

**Prerequisites:**

- Plan exists with clear step descriptions.
- You understand what needs to be built.

---

## How to Do It

### Repository Guidelines

Before implementing, check for project-specific guidelines:

1. **Check for guideline files** - Look for project guideline files at the repo root (e.g., `CLAUDE.md`, `AGENTS.md`, `COPILOT.md`, or similar). Read and follow their working agreements (formatting commands, validation steps, changelog requirements, etc.)

2. **Check Plan Notes** - Read the plan's `metadata.notes` field for project-specific commands and conventions (testing commands, build commands, tool-specific notes).

3. **Check CONTRIBUTING.md** - If present, follow commit message conventions and coding standards.

These guidelines override generic examples in this skill. For example, if a guideline file says "run `npm run fix` after changes", do that instead of generic lint commands.

### Git State

The orchestrator modifies plan and work directory files before you start (marking steps `in_progress`, creating temp files). This is expected. **Ignore changes in the orchestrator work directory** (e.g., `.agent-work/` or the path from `orrery plans-dir`) when checking git status - these are orchestrator bookkeeping files, not unexpected changes.

### Step 1: Read the Plan

Read the plan file provided in your instructions.

- Identify the steps you are assigned to (via `stepIds`).
- Read the `description`, `criteria`, `files`, and `risk_notes` for those steps.
- **Do not edit the plan file.**

### Step 2: Implement the Change

Write the code:

- Follow project conventions and patterns.
- Keep changes focused on the step's scope.
- Write clean, readable code.
- **Do not** add comments to the plan file.

### Step 3: Initial Check

Before handing off:

- **Compile/Build:** Ensure no syntax errors.
- **Smoke Test:** Does it run?

### Step 4: Handoff to Verify

Once implementation is complete, invoke the `orrery-verify` skill using the Skill tool.

**Important:** Do NOT commit your changes. The orchestrator handles all commits after receiving your report.

---

## Example

**Plan Step:**

```yaml
- id: "2"
  description: "Implement backend API endpoint for CSV upload"
```

**Execution:**

1. **Read** the plan to understand Step 2.
2. **Implement** `src/api/routes/upload.ts`.
3. **Run** `npm build` -> Passes.
4. **Invoke** the `orrery-verify` skill using the Skill tool.

---

## Error Handling

### When Code Doesn't Work

1. **Read error messages.**
2. **Fix specific issues.**
3. **If stuck:** You may mark the step as blocked by invoking the `orrery-report` skill directly using the Skill tool with a "Blocked" status (see Report skill for details).

### Rollback Strategy

If a change breaks things badly and you cannot fix it:

1. `git stash` or `git checkout` to revert.
2. Invoke the `orrery-report` skill using the Skill tool to report the blockage.
