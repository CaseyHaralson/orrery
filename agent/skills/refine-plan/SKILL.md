---
name: refine-plan
description: >
  Analyze and improve an existing plan file. Reviews plan structure, dependencies,
  context quality, and acceptance criteria, then implements improvements directly.
  Requires a plan file argument (e.g., /refine-plan .agent-work/plans/my-plan.yaml).
hooks:
  PostToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: "orrery validate-plan"
---

# Refine Plan Skill

## When to Use

Use this skill when you have an existing plan and want to **improve it** before execution. Unlike Simulate (which is read-only), Refine analyzes the plan and implements improvements directly.

**Triggers:**
- "This plan needs work"
- "Can you improve this plan?"
- "Check if this plan is ready for execution"
- "The context seems thin, can you fill it out?"
- "Make sure this plan follows the schema"
- Plan validation failed and you need to fix issues

**Skip if:**
- No plan exists yet (use Discovery first)
- You want to explore the plan interactively (use Simulate instead)
- You need to fundamentally restructure the plan or change outcomes (use Discovery)
- The plan is already validated and well-formed

---

## How to Do It

### Step 1: Load and Parse the Plan

Read the plan file and understand its structure:
- Parse the YAML to identify all steps, dependencies, and metadata
- Note the outcomes (what success looks like)
- Map the dependency graph
- Identify which steps have context_files, risk_notes, and other optional fields

Announce what you've loaded:
```
I've loaded [plan name]. It has [N] steps with [X] outcomes.
Let me analyze it for improvements.
```

### Step 2: Analyze for Improvements

Check each improvement category systematically. Build a list of findings.

For each issue found, note:
- What the problem is
- Which step(s) it affects
- What the fix should be

### Step 3: Report Findings or Exit Clean

**If no improvements found:**
```
The plan looks good. No structural issues, dependencies are correct,
context is sufficient for autonomous execution, and acceptance criteria
are testable. Ready for execution.
```
Exit cleanly without modifying the file.

**If improvements found:**
```
Found [N] improvements:
- [Category]: [Brief description] (steps X, Y)
- [Category]: [Brief description] (step Z)

Implementing these changes now.
```

### Step 4: Implement Improvements

Write the updated plan directly to the file. The PostToolUse hook will automatically validate the plan after writing.

Make changes in order of impact:
1. Schema compliance issues first (required fields)
2. Structural issues (malformed steps)
3. Dependency issues (missing deps, cycles)
4. Context and criteria improvements

### Step 5: Summarize Changes

After writing:
```
Updated the plan with [N] changes:
- Added missing deps to steps 2.1, 2.3 (they now depend on install step 0.1)
- Expanded context for step 1.2 to include integration patterns
- Made criteria in step 3.1 more specific and testable
- Added risk_notes to step 2.1 (high complexity)

Plan validated successfully.
```

---

## Improvement Categories

Check the plan against these categories:

### Structural Issues

- **Missing required fields**: Every step must have `id`, `description`, `context`, `requirements`, `criteria`
- **Malformed step IDs**: IDs should follow `{feature}.{step}` format (e.g., "1.1", "2.3")
- **Missing metadata**: Plan must have `created_at`, `created_by`, `outcomes`
- **Empty arrays**: Requirements and criteria must have at least one item

**Fix approach:** Add missing fields with sensible defaults or flag for user input if context is unclear.

### Dependency Issues

- **Missing install step deps**: If step "0.1" installs dependencies, ALL subsequent steps should include "0.1" in their deps
- **Circular dependencies**: Step A depends on B, B depends on A
- **Missing sequential deps**: Step uses output from another step but doesn't declare the dependency
- **Unnecessary sequential deps**: Steps that could run in parallel but have artificial dependencies

**Fix approach:** Add missing deps, remove circular deps, suggest parallelization opportunities.

### Context Quality

Thin context prevents autonomous execution. Check for:

- **Vague context**: "Add the feature" without explaining what, where, or why
- **Missing context_files**: Steps that reference existing code but don't list which files to read
- **No integration guidance**: Steps that modify existing code without explaining the patterns to follow
- **Assumed knowledge**: Context assumes the agent knows project-specific conventions

**Fix approach:** Expand context with specifics. Add relevant context_files. Reference existing patterns.

### Acceptance Criteria Quality

Criteria must be **specific** and **testable**. Check for:

- **Vague criteria**: "Works correctly" or "Handles errors"
- **Untestable criteria**: "Code is clean" or "Performance is good"
- **Missing criteria**: Steps with empty or single-item criteria arrays
- **Inconsistent scope**: Criteria that don't match what the step actually delivers

**Fix approach:** Rewrite vague criteria with specific, observable conditions. Add missing criteria based on requirements.

**Examples:**
- Bad: "Error handling works"
- Good: "Returns 400 status with error message when input validation fails"

- Bad: "Component renders correctly"
- Good: "Component renders loading skeleton while data fetches; displays chart when data arrives; shows error message if API returns 500"

### Risk Coverage

- **High complexity without notes**: Steps with many requirements or external integrations but no risk_notes
- **Missing edge cases**: Obvious failure modes not acknowledged
- **Underestimated steps**: Steps that look simple but have hidden complexity

**Fix approach:** Add risk_notes for complex steps. Call out edge cases and potential blockers.

### Schema Compliance

Validate against `../discovery/schemas/plan-schema.yaml`:

- Field types match schema (arrays vs strings, required vs optional)
- Status values are valid enum values
- All referenced step IDs in deps actually exist

**Fix approach:** Correct type mismatches, fix invalid values, remove dangling dep references.

---

## Reference Schema

The plan schema is defined at:
```
agent/skills/discovery/schemas/plan-schema.yaml
```

Key required fields:
- **metadata**: `created_at`, `created_by`, `outcomes`
- **steps[].required**: `id`, `description`, `context`, `requirements`, `criteria`
- **steps[].optional**: `status`, `deps`, `parallel`, `files`, `context_files`, `commands`, `risk_notes`

---

## Exit Conditions

Exit **without changes** when:
- All required fields are present
- Dependencies are correct (no cycles, install steps properly referenced)
- Context is sufficient for autonomous execution
- Criteria are specific and testable
- No schema violations

In this case, report:
```
Plan analysis complete. No improvements needed.

- Structure: Valid
- Dependencies: Correct
- Context: Sufficient
- Criteria: Testable
- Schema: Compliant

Ready for execution.
```

---

## Example Dialogue

```
User: /refine-plan .agent-work/plans/analytics-dashboard.yaml

Agent: I've loaded the analytics dashboard plan. It has 6 steps delivering
two outcomes. Let me analyze it for improvements.

Found 4 improvements:

1. Dependency issues: Steps 1.1, 2.1, 2.2 don't depend on the install step (0.1)
2. Context quality: Step 1.2 has thin context - doesn't explain the caching pattern
3. Criteria quality: Step 2.3 has vague criteria ("error handling works")
4. Risk coverage: Step 2.1 (Chart.js integration) has no risk_notes despite complexity

Implementing these changes now.

[Writes updated plan file]

Updated the plan:
- Added "0.1" to deps for steps 1.1, 2.1, 2.2
- Expanded step 1.2 context with reference to cache.ts middleware pattern
- Rewrote step 2.3 criteria: "Shows loading skeleton during fetch",
  "Displays error toast with retry button on API failure"
- Added risk_notes to step 2.1: "Chart.js bundle size impact - verify no
  significant increase to main bundle"

Plan validated successfully. Ready for execution.
```

---

## Boundaries

### What Refine Does

- Fixes structural issues (missing fields, malformed data)
- Corrects dependency problems
- Expands thin context
- Improves vague criteria
- Adds missing risk notes
- Ensures schema compliance

### What Refine Does NOT Do

- **Change outcomes**: If the outcomes are wrong, use Discovery
- **Restructure the plan**: Refine improves existing steps, doesn't reorganize them
- **Add new features**: Refine doesn't expand scope
- **Remove steps**: Refine improves steps, doesn't delete them
- **Question the approach**: That's what Simulate is for

If you find yourself wanting to fundamentally change the plan (new steps, different outcomes, restructured features), suggest returning to Discovery instead.

---

## Common Pitfalls

- **Over-refining**: Making changes that don't materially improve the plan. If it's good enough, say so.
- **Changing scope**: Refine improves quality, not content. Don't add features or change what the plan delivers.
- **Forgetting validation**: Always let the PostToolUse hook validate after writing. If validation fails, fix and write again.
- **Missing the install step pattern**: This is the most common dependency issue. Always check if 0.1 exists and if subsequent steps depend on it.
- **Vague improvements**: Don't just say "expanded context" - show specifically what changed.
