---
name: verify
description: >
  Run tests and validation to ensure changes meet acceptance criteria
  and nothing is broken. This is Phase 4 of the workflow protocol.
metadata:
  version: "1.0"
  phase: 4
---

# Verify Skill

## When to Use

Use this skill **after execution** to validate that changes work correctly and meet acceptance criteria.

**Triggers:**
- Execute phase is complete for one or more steps
- Before marking work as done
- Before creating a report
- When resuming to check current state

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

Record:
- Total tests run
- Passed / Failed / Skipped counts
- Any error messages

### Step 2: Run Linters and Static Analysis

If the project has them configured:

```bash
# Examples
npm run lint
eslint .
pylint src/
go vet ./...
```

Fix any new issues your changes introduced.

### Step 3: Check Acceptance Criteria

For each completed step, verify its `criteria` field:

```yaml
- id: "2"
  criteria: "POST /api/upload returns 200 with {count, mean, median}"
```

Ask yourself: Does the implementation actually satisfy this?

### Step 4: Manual Smoke Test (if applicable)

For features that can be manually tested:
- Run the application
- Try the new feature
- Check that basic flows still work

### Step 5: Check for Regressions

Verify that existing functionality still works:
- Did any previously passing tests start failing?
- Are there obvious broken behaviors?

### Step 6: Document Results

Record what you verified:
- Test results (pass/fail counts)
- Any issues found
- Any warnings or concerns

---

## Verification Checklist

Use this checklist for each verification pass:

- [ ] **Tests pass** - All automated tests succeed
- [ ] **No new lint errors** - Code passes static analysis
- [ ] **Criteria met** - Each step's acceptance criteria satisfied
- [ ] **No regressions** - Existing features still work
- [ ] **Code runs** - Application starts without errors
- [ ] **Changes make sense** - Implementation matches intent

---

## Example

**After executing CSV upload feature:**

1. **Run tests:**
```bash
$ npm test
  PASS  tests/api/upload.test.ts
  PASS  tests/services/csvParser.test.ts

Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

2. **Run linter:**
```bash
$ npm run lint
No issues found.
```

3. **Check acceptance criteria:**
   - Step 1: "Migration creates csv_uploads table" → ✓ Verified via migration log
   - Step 2: "POST /api/upload returns stats" → ✓ Tested manually with curl
   - Step 3: "User can upload and see stats" → ✓ Tested in browser

4. **Smoke test:**
   - Started dev server
   - Uploaded a sample CSV
   - Stats displayed correctly
   - Tried an invalid file - got appropriate error

5. **Results:**
   - All tests passing
   - All criteria met
   - No regressions observed

**Ready for Report phase.**

---

## When Verification Fails

### Test Failures

1. **Read the failure message** - understand what broke
2. **Determine if it's your change** - did you break it or was it already broken?
3. **If your change broke it:**
   - Go back to Execute
   - Fix the issue
   - Re-run verification
4. **If it was already broken:**
   - Note it in the report
   - Consider if it blocks your work

### Criteria Not Met

If a step's acceptance criteria isn't satisfied:

1. **Is the criteria realistic?** - Maybe the plan was wrong
2. **Is the implementation incomplete?** - Go back to Execute
3. **Is there a misunderstanding?** - May need to revisit Intake

### Flaky Tests

If tests pass sometimes and fail others:

1. Document the flakiness
2. Run multiple times to confirm your changes aren't the cause
3. Note in the report

---

## Verification Depth

Adjust verification depth based on risk:

### Low Risk (small changes)
- Run affected tests
- Quick lint check
- Basic smoke test

### Medium Risk (new features)
- Full test suite
- Complete lint pass
- Manual testing of feature
- Check related functionality

### High Risk (core changes, refactors)
- Full test suite
- Extended manual testing
- Performance spot-checks
- Review by another agent (if available)

---

## Automated vs Manual Verification

### Prefer Automated

Automated checks are:
- Reproducible
- Fast
- Documented by default

Always run automated tests if they exist.

### When Manual is Needed

Some things require manual verification:
- UI/UX changes (does it look right?)
- Integration with external services
- Performance characteristics
- Edge cases not covered by tests

Document manual verification steps so others can repeat them.

---

## Common Pitfalls

- **Skipping verification:** "It's a small change" - small changes can have big impacts
- **Ignoring failures:** Marking complete despite failing tests
- **Not checking criteria:** Tests pass but the feature doesn't work as specified
- **Shallow testing:** Only testing the happy path
- **Not documenting:** Verifying but not recording what was checked
