---
name: orrery-verify
description: >
  Run tests, linting, and validation to verify changes work correctly.
  Use after implementation to check acceptance criteria, run test suites,
  and ensure nothing is broken.
user-invocable: false
---

# Verify Skill

## When to Use

Use this skill **after execution** to validate that changes work correctly and meet acceptance criteria.

**Triggers:**

- Execution phase is complete.
- You have been handed off from the **Execute** skill.

**Never skip verification.** Even trivial changes should have at least basic checks.

---

## How to Do It

### Step 0: Check Repository Guidelines

Before running generic commands, check for project-specific instructions:

1. **Plan metadata.notes** - Use testing/linting commands specified here
2. **Project guideline files** - Check for files like `CLAUDE.md`, `AGENTS.md`, `COPILOT.md`, or similar at the repo root. Follow their validation steps (e.g., `npm run fix`, `npm run validate`)
3. **CONTRIBUTING.md** - Check for any validation requirements

Use project-specific commands instead of generic ones when available.

### Step 1: Run the Test Suite

Execute the project's tests:

```bash
# Common test commands
npm test
pytest
go test ./...
cargo test
```

### Step 2: Run Formatting and Linting

If the project has formatting/linting configured:

1. **Run formatters first** (e.g., `npm run fix`, `prettier --write`)
2. **Then run linters** (e.g., `npm run lint`, `eslint .`)

Check project guideline files and plan notes for the exact commands.

### Step 2.5: Update CHANGELOG (if required)

If project guideline files require CHANGELOG updates:

1. Check if changes touch user-facing code (lib/, bin/, etc.)
2. If yes, add an entry under `[Unreleased]` with appropriate category
3. Use the correct category: Added, Changed, Fixed, Removed, Deprecated, Security

### Step 3: Check Acceptance Criteria

For each completed step, verify its `criteria` field from the plan.
Ask yourself: Does the implementation actually satisfy this?

### Step 4: Decision & Handoff

**Case A: Verification FAILED**
If tests fail, linting errors occur, or criteria are not met:

1.  Analyze the error.
2.  **Return to Execute:** Invoke the `orrery-execute` skill using the Skill tool to fix the issues.
3.  _Do not_ proceed to Report until issues are resolved (unless completely blocked).

**Case B: Verification PASSED**
If all checks pass:

1.  **Gather Stats:** Note the number of tests passed (e.g., "8/8 passed").
2.  **Handoff to Report:** Invoke the `orrery-report` skill using the Skill tool to finalize the step.

---

## Example

**Scenario:** You implemented `src/api/routes/upload.ts`.

1.  **Run tests:** `npm test` -> **FAIL** (ReferenceError).
    - **Action:** Invoke the `orrery-execute` skill using the Skill tool to fix the ReferenceError.

2.  **Run tests (Attempt 2):** `npm test` -> **PASS** (5 tests passed).
3.  **Run lint:** `npm run lint` -> **PASS**.
4.  **Action:** Invoke the `orrery-report` skill using the Skill tool.

---

## Common Pitfalls

- **Ignoring failures:** Passing a failed test suite to the Report skill.
- **Skipping regression checks:** Not running the full suite to ensure old code still works.
- **Infinite Loops:** If you keep bouncing between Execute and Verify without progress, stop and invoke the `orrery-report` skill using the Skill tool with a "Blocked" status.
