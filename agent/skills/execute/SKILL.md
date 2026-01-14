---
name: execute
description: >
  Write or modify code according to a plan step. Handle implementation,
  commits, and basic error recovery. This is Phase 3 of the workflow protocol.
metadata:
  version: "1.0"
  phase: 3
---

# Execute Skill

## When to Use

Use this skill to **implement code changes** defined in a plan step. This is where the actual development work happens.

**Triggers:**
- A plan exists with pending steps
- You're assigned (or self-assigned) to a step
- Dependencies for the step are satisfied

**Prerequisites:**
- Plan exists with clear step descriptions
- Step dependencies are marked `complete`
- You understand what needs to be built

---

## How to Do It

### Step 1: Mark Step In Progress

Update the plan to show you're working on this step:

```yaml
- id: "2"
  status: "in_progress"  # Changed from "pending"
```

### Step 2: Understand the Step

Read the step's:
- `description` - what to build
- `criteria` - how to know it's done
- `files` - what to create/modify
- `risk_notes` - what to watch out for

### Step 3: Examine Existing Code

Before writing, look at:
- Files you'll be modifying
- Related code for patterns to follow
- Existing tests for the area

### Step 4: Implement the Change

Write the code:
- Follow project conventions and patterns
- Keep changes focused on the step's scope
- Write clean, readable code
- Add comments only where logic isn't obvious

### Step 5: Run Quick Checks

Before committing:
- Does the code compile/run without syntax errors?
- Do basic smoke tests pass?
- Did you introduce obvious bugs?

### Step 6: Commit the Change

Make a commit with a meaningful message:

```
<type>: <short description>

<body explaining what and why, if needed>
```

**Types:**
- `feat` - new feature
- `fix` - bug fix
- `refactor` - code restructuring
- `test` - adding tests
- `docs` - documentation
- `chore` - maintenance

### Step 7: Update Plan Status

Mark the step complete (or blocked if issues arose):

```yaml
- id: "2"
  status: "complete"  # or "blocked" with notes
```

---

## Example

**Plan Step:**
```yaml
- id: "2"
  description: "Implement backend API endpoint for CSV upload"
  criteria: "POST /api/upload accepts CSV, returns stats"
  files:
    - "src/api/routes/upload.ts"
    - "src/api/services/csvParser.ts"
```

**Execution:**

1. Mark step `in_progress`

2. Check existing route patterns in `src/api/routes/`

3. Create `src/api/routes/upload.ts`:
```typescript
import { Router } from 'express';
import { parseCSV, computeStats } from '../services/csvParser';

const router = Router();

router.post('/upload', async (req, res) => {
  const file = req.file;
  const data = await parseCSV(file.buffer);
  const stats = computeStats(data);
  res.json(stats);
});

export default router;
```

4. Create `src/api/services/csvParser.ts` with parsing logic

5. Run `npm run build` - passes

6. Commit:
```
feat: add CSV upload endpoint with stats computation

Accepts CSV file via POST /api/upload
Returns count, mean, and median of numeric columns
```

7. Mark step `complete`

---

## Error Handling

### When Code Doesn't Work

1. **Read the error message carefully**
2. **Check your assumptions** - is the step description accurate?
3. **Try to fix it** - most issues are typos or simple mistakes
4. **If stuck after reasonable effort** - mark step `blocked` with details

### When to Mark Blocked

Mark a step `blocked` when:
- You've tried multiple approaches
- The issue is outside your control (missing dependency, unclear requirement)
- Continuing would waste significant time

Include in `risk_notes` or a comment:
- What you tried
- What failed
- What's needed to unblock

### Rollback Strategy

If a change breaks things badly:
1. Use `git stash` or `git checkout` to revert
2. Try a different approach
3. If the step is fundamentally flawed, mark `blocked` and surface to Coordinator

---

## Best Practices

### Keep Changes Focused

Only implement what the step describes. Don't:
- Refactor unrelated code
- Add features not in the plan
- Fix bugs you happen to notice (note them for later)

### Follow Existing Patterns

Look at how similar things are done in the codebase. Match:
- Naming conventions
- File organization
- Code style
- Error handling patterns

### Commit at Logical Points

- One commit per logical unit of work
- Don't commit broken code
- Don't make giant commits with unrelated changes

### Prefer Additive Changes

When possible:
- Add new code rather than modifying existing
- Use feature flags for risky changes
- Keep old code until new code is verified

---

## Multi-Step Execution

When executing multiple steps:

1. Complete one step fully before starting the next
2. Update plan status after each step
3. If a step creates something the next step needs, verify it works first
4. Don't batch status updates - mark complete immediately

---

## Common Pitfalls

- **Scope creep:** Doing more than the step asks for
- **No commits:** Building everything then committing once
- **Ignoring criteria:** Implementing something that doesn't meet acceptance criteria
- **Skipping checks:** Not running the code before marking complete
- **Silent failures:** Marking complete when you know something's wrong
