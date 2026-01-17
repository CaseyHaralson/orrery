---
name: orrery-execute
description: >
  Write or modify code according to a plan step. Handle implementation.
  This is Phase 3 of the workflow protocol.
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

Once implementation is complete, activate the **Verify** skill.

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
4. **Activate Skill:** `verify`

---

## Error Handling

### When Code Doesn't Work
1. **Read error messages.**
2. **Fix specific issues.**
3. **If stuck:** You may mark the step as blocked by activating the **Report** skill directly with a "Blocked" status (see Report skill for details).

### Rollback Strategy
If a change breaks things badly and you cannot fix it:
1. `git stash` or `git checkout` to revert.
2. Activate the **Report** skill to report the blockage.
