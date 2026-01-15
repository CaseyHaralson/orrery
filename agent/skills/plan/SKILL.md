---
name: plan
description: >
  Decompose a project request into a step-by-step implementation plan
  with dependencies and acceptance criteria. This is Phase 2
  of the workflow protocol.
metadata:
  version: "1.0"
  phase: 2
hooks:
  PostToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: "node agent/scripts/validate-plan.js"
---

# Plan Skill

## When to Use

Use this skill **after completing intake** to create a structured implementation plan. Every non-trivial task should have a plan before execution begins.

**Triggers:**
- Intake phase is complete and requirements are clear
- Task involves multiple steps or files
- Work may be handed off to another agent
- You need to coordinate with other agents/roles

**Skip planning if:**
- Task is a single, obvious change (one-liner fix)
- You're executing an existing plan

---

## How to Do It

### Step 1: Identify All Work Items

From the intake summary, list everything that needs to happen:
- Code to write or modify
- Tests to create or update
- Configurations to change
- Documentation updates (if required)

### Step 2: Order by Dependencies

Determine which items depend on others:
- What must be done first?
- What can be done in parallel?
- What blocks other work?

### Step 3: Define Acceptance Criteria

Each step needs clear "done" conditions:
- Be specific and verifiable
- Include test requirements where applicable
- Avoid vague criteria like "works correctly"

### Step 4: Output the Plan

Write the plan in YAML format following `agent/schemas/plan-schema.yaml`.

**Output Location:**
- Directory: `work/plans/`
- Filename: `<date>-<plan-name>.yaml`
- Date format: YYYY-MM-DD (e.g., `2026-01-11`)
- Plan name: kebab-case description of the task (e.g., `fix-clone-agent-skills`)
- Full example: `work/plans/2026-01-11-add-csv-upload-feature.yaml`

The directory will be created automatically if it doesn't exist.

### Step 5: Validate the Plan

Plan files are **automatically validated** via a PostToolUse hook when written to `work/plans/`. If the YAML is invalid, you'll see an error message with details on how to fix it.

For manual validation:
```bash
node agent/scripts/validate-plan.js work/plans/<your-plan>.yaml
```

This catches common issues like unquoted colons before they cause orchestrator failures.

---

## Plan Schema Reference

Each step requires:
- `id` - unique identifier (string)
- `description` - what to do (natural language)

Optional but recommended:
- `status` - `pending`, `in_progress`, `complete`, `blocked` (default: `pending`)
- `deps` - array of step IDs this depends on
- `criteria` - acceptance criteria for completion
- `files` - files that will be created/modified
- `commands` - specific commands to run
- `risk_notes` - warnings or things to watch out for
- `parallel` - boolean, can run alongside other steps

Full schema: `agent/schemas/plan-schema.yaml`

---

## Example

**Task:** Add CSV upload feature with summary statistics

**Plan Output:**

```yaml
# work/plans/2026-01-10-add-csv-upload-feature.yaml
metadata:
  created_at: "2026-01-10T14:00:00Z"
  created_by: "Claude"
  version: "1.0"

steps:
  - id: "1"
    description: "Create database migration for CSV metadata storage"
    status: "pending"
    deps: []
    criteria: "Migration runs successfully, creates csv_uploads table"
    files:
      - "db/migrations/001_create_csv_uploads.sql"
    risk_notes: "Ensure compatible with existing schema"

  - id: "2"
    description: "Implement backend API endpoint for CSV upload"
    status: "pending"
    deps: ["1"]
    criteria: "POST /api/upload accepts CSV, returns stats (count, mean, median)"
    files:
      - "src/api/routes/upload.ts"
      - "src/api/services/csvParser.ts"
    commands:
      - "npm test -- --grep 'upload'"

  - id: "3"
    description: "Build frontend upload component"
    status: "pending"
    deps: ["2"]
    criteria: "User can select file, see upload progress, view returned stats"
    files:
      - "src/components/UploadWidget.tsx"
      - "src/components/StatsDisplay.tsx"

  - id: "4"
    description: "Add integration tests for upload flow"
    status: "pending"
    deps: ["2", "3"]
    criteria: "E2E test passes: upload sample CSV, verify stats displayed"
    files:
      - "tests/e2e/upload.spec.ts"
    commands:
      - "npm run test:e2e"
```

---

## Planning Principles

### Right-Size Your Steps

- **Too granular:** "Create file", "Add import", "Write function" → combine these
- **Too coarse:** "Build the feature" → break it down
- **Just right:** One logical unit of work that can be verified independently

### Dependencies Should Be Explicit

If step 3 needs step 2's output, say so in `deps`. Don't rely on ordering alone.

### Criteria Must Be Testable

Bad: "API works correctly"
Good: "POST /api/upload returns 200 with {count, mean, median} for valid CSV"

### Plan for Verification

Include test steps in your plan. Don't assume verification will "just happen."

---

## YAML Formatting Rules

**Always quote strings that contain special characters:**

```yaml
# BAD - colons in unquoted strings break YAML parsing
criteria: Output shows: timestamp value

# GOOD - quote strings containing colons
criteria: "Output shows: timestamp value"

# BAD - nested quotes without escaping
criteria: "Shows 'Current time: 12:30'"

# GOOD - use single quotes inside double quotes (or escape)
criteria: "Shows 'Current time: 12:30'"
```

**Common YAML gotchas:**
- Colons followed by space (`: `) are interpreted as key-value separators
- Strings starting with special characters like brackets, braces, asterisks, ampersands, exclamation marks, pipes, quotes, or backticks need quoting
- Multi-line strings should use `|` (literal) or `>` (folded) block syntax

**When in doubt, use double quotes** around the entire value.

---

## Common Pitfalls

- **YAML formatting errors:** Unquoted colons cause parse failures - always validate your plan
- **Forgetting dependencies:** Steps fail because prerequisites aren't done
- **Vague criteria:** "It should work" doesn't tell you when you're done
- **No test steps:** Plan execution without planned verification
- **Over-planning:** Don't plan 50 micro-steps; keep it manageable (3-10 steps typical)
