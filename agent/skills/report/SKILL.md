---
name: report
description: >
  Summarize execution results and communicate status to stakeholders.
  This is Phase 5 of the workflow protocol.
metadata:
  version: "1.0"
  phase: 5
---

# Report Skill

## When to Use

Use this skill **after verification** to summarize what was accomplished and communicate results.

**Triggers:**
- Verification is complete
- Task is finished (successfully or not)
- Handoff to another agent or human
- End of a work session

**The report closes the loop** with the user and creates a record for future reference.

---

## How to Do It

### Step 1: Gather Information

Collect from the completed work:
- Final plan status (all steps)
- Verification results (test outcomes)
- Artifacts created (files, commits, branches)
- Any issues or blockers encountered

### Step 2: Summarize What Was Done

Write a clear summary:
- What was the task?
- What was accomplished?
- What approach was taken?

Keep it concise - details are in the artifacts.

### Step 3: Report Results

Include verification outcomes:
- Test results (pass/fail)
- Whether acceptance criteria were met
- Any warnings or concerns

### Step 4: Note Next Steps

If applicable:
- Remaining work
- Blocked items needing attention
- Recommendations for follow-up
- Known issues or technical debt

### Step 5: Provide References

Point to relevant artifacts:
- Commit hashes or branch names
- Files created or modified
- PR link (if created)
- Plan file location

---

## Output Format

Reports can be delivered in two ways:

### In-Chat Summary (Interactive Mode)

For immediate feedback to a user:

```
## Summary

Added CSV upload feature with statistics computation.

## What Was Done

- Created database migration for csv_uploads table
- Implemented POST /api/upload endpoint
- Built frontend upload component with stats display
- Added integration tests

## Results

- All tests passing (8/8)
- Acceptance criteria met
- No regressions

## Artifacts

- Branch: `feature/csv-upload`
- Commits: abc123, def456
- Files: src/api/routes/upload.ts, src/components/UploadWidget.tsx

## Next Steps

- Ready for code review
- Consider adding file size validation in future iteration
```

### Structured Report (File Output)

For machine-readable handoff, use `agent/schemas/report-schema.yaml`:

```yaml
step_id: "all"
outcome: "success"
details: "Implemented CSV upload feature with stats computation"
timestamp: "2026-01-10T16:30:00Z"

artifacts:
  - file: "src/api/routes/upload.ts"
    status: "created"
  - file: "src/components/UploadWidget.tsx"
    status: "created"
  - test: "tests/api/upload.test.ts"
    result: "PASSED (4 tests)"
  - test: "tests/e2e/upload.spec.ts"
    result: "PASSED (2 tests)"

metadata:
  branch: "feature/csv-upload"
  commits: ["abc123", "def456"]
  total_tests: 8
  tests_passed: 8
```

---

## Example

**Task:** Add dark mode to the application

**Report:**

```
## Summary

Implemented dark mode theme with user preference persistence.

## What Was Done

1. Created dark color palette in theme system
2. Added DarkModeToggle component to settings page
3. Implemented localStorage persistence for preference
4. Applied theme switching to all existing components

## Results

- Tests: 12 passed, 0 failed
- All acceptance criteria met
- Manual testing confirmed theme applies correctly
- Preference persists across page reloads

## Artifacts

- Branch: `feature/dark-mode`
- Commit: `a1b2c3d feat: add dark mode with persistence`
- Key files:
  - src/styles/themes/dark.ts
  - src/components/settings/DarkModeToggle.tsx
  - src/hooks/useTheme.ts

## Next Steps

- Ready for review
- Consider: OS preference detection (prefers-color-scheme)
- Note: A few third-party components may need custom dark styles
```

---

## Report Content Guidelines

### Be Concise

- Lead with the most important information
- Use bullet points, not paragraphs
- Details are in the code - don't repeat everything

### Be Honest

- Report failures and blockers clearly
- Don't hide problems
- Distinguish between "done" and "done with caveats"

### Be Actionable

- If there are next steps, be specific
- If blocked, explain what's needed to unblock
- If there are concerns, state them clearly

---

## When Things Went Wrong

If the task didn't fully succeed:

```
## Summary

Partially completed CSV upload feature. Backend done, frontend blocked.

## What Was Done

- Created database migration (complete)
- Implemented backend API endpoint (complete)
- Frontend component (blocked - see below)

## Issues

Frontend implementation blocked:
- File upload library incompatible with current React version
- Attempted: react-dropzone, react-file-upload
- Both require React 18+, project uses React 17

## Recommendation

Options to unblock:
1. Upgrade React to v18 (may have other impacts)
2. Use native file input with custom styling
3. Find a React 17-compatible library

## Artifacts

- Branch: `feature/csv-upload` (partial work)
- Backend tests passing
- Frontend step marked `blocked` in plan
```

---

## Per-Step vs. Full-Task Reports

### Per-Step Reports

After each step, you may write a brief report:
- Useful for long-running tasks
- Enables Coordinator to track progress
- Format: use `report-schema.yaml` with `step_id` specified

### Full-Task Reports

At task completion:
- Comprehensive summary of all work
- Use `step_id: "all"` or omit it
- Include references to per-step reports if they exist

---

## Common Pitfalls

- **Too verbose:** Writing essays instead of summaries
- **Too terse:** "Done" with no details
- **Hiding problems:** Not mentioning issues or blockers
- **Missing artifacts:** Forgetting to include commit/branch references
- **No next steps:** Leaving the reader wondering what happens now
