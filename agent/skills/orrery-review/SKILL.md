---
name: orrery-review
description: >
  Review code changes after each step execution and provide structured feedback.
user-invocable: false
---

# Review Skill

## When to Use

Use this skill **after a step execution** to review the changes and provide
feedback to an editor agent.

**Triggers:**

- You are invoked by the orchestrator for a review phase.
- You receive step context, list of modified files, and a git diff.

**Do not** apply fixes yourself. Only review and report.

---

## How to Do It

### Step 1: Read Context

- Read the step description and requirements provided by the orchestrator.
- Read the git diff to understand the changes.

### Step 2: Read Full Files (Required)

For every modified or added file, **read the full file contents** to
understand broader context. Do not review only the diff.

### Step 3: Review Criteria

Check the changes against these criteria:

- Correctness: Does the code do what it should? Any logic mistakes?
- Bug risks: Edge cases, null handling, off-by-one errors.
- Security: Injection, auth issues, data exposure, unsafe inputs.
- Performance: Obvious inefficiencies, N+1 patterns, memory leaks.
- Code quality: Readability, naming, complexity, maintainability.
- Architecture: Duplication, separation of concerns, module boundaries.
- Error handling: Errors handled gracefully, no silent failures.
- Testing: Test coverage gaps, testability, missing edge cases.

### Step 4: Prioritize Feedback

- Mark **blocking** issues that must be fixed (bugs, security, correctness).
- Mark **suggestions** for improvements that are optional or non-critical.
- Keep feedback concise and actionable; avoid style-only nits.

### Step 5: Decide Status

- `approved` if there are **no blocking** issues.
- `needs_changes` if **any blocking** issue exists.

---

## Output Contract (CRITICAL)

Return a single JSON object to stdout.

```json
{
  "status": "approved | needs_changes",
  "feedback": [
    {
      "file": "path/to/file.js",
      "line": 42,
      "severity": "blocking | suggestion",
      "comment": "Explain the issue and expected fix."
    }
  ]
}
```

**Rules:**

1. Output **valid JSON on a single line**.
2. No markdown code blocks in your final output.
3. `line` is optional if not applicable.
4. `feedback` may be empty only when `status` is `approved`.

---

## Example

**Scenario:** Missing null check in `src/service.js`.

```json
{
  "status": "needs_changes",
  "feedback": [
    {
      "file": "src/service.js",
      "line": 87,
      "severity": "blocking",
      "comment": "Guard against null `user` before accessing `user.id` to avoid runtime errors."
    }
  ]
}
```
