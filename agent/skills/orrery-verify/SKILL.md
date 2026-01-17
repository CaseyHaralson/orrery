---
name: orrery-verify
description: >
  Run tests and validation to ensure changes meet acceptance criteria
  and nothing is broken. This is Phase 4 of the workflow protocol.
metadata:
  version: "1.1"
  phase: 4
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

### Step 1: Run the Test Suite

Execute the project's tests:

```bash
# Common test commands
npm test
pytest
go test ./...
cargo test
```

### Step 2: Run Linters

If the project has them configured:

```bash
# Examples
npm run lint
eslint .
```

### Step 3: Check Acceptance Criteria

For each completed step, verify its `criteria` field from the plan.
Ask yourself: Does the implementation actually satisfy this?

### Step 4: Decision & Handoff

**Case A: Verification FAILED**
If tests fail, linting errors occur, or criteria are not met:
1.  Analyze the error.
2.  **Return to Execute:** Activate the **Execute** skill to fix the issues.
3.  *Do not* proceed to Report until issues are resolved (unless completely blocked).

**Case B: Verification PASSED**
If all checks pass:
1.  **Gather Stats:** Note the number of tests passed (e.g., "8/8 passed").
2.  **Activate Report:** Activate the **Report** skill to finalize the step.

---

## Example

**Scenario:** You implemented `src/api/routes/upload.ts`.

1.  **Run tests:** `npm test` -> **FAIL** (ReferenceError).
    *   **Action:** Activate `execute` to fix the ReferenceError.

2.  **Run tests (Attempt 2):** `npm test` -> **PASS** (5 tests passed).
3.  **Run lint:** `npm run lint` -> **PASS**.
4.  **Action:** Activate `report`.

---

## Common Pitfalls

- **Ignoring failures:** Passing a failed test suite to the Report skill.
- **Skipping regression checks:** Not running the full suite to ensure old code still works.
- **Infinite Loops:** If you keep bouncing between Execute and Verify without progress, stop and activate **Report** with a "Blocked" status.