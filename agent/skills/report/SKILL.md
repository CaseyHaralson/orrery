---
name: report
description: >
  Summarize execution results and communicate status to the Orchestrator.
  This is Phase 5 of the workflow protocol.
metadata:
  version: "1.1"
  phase: 5
---

# Report Skill

## When to Use

Use this skill **after verification** to finalize your work on a step and communicate the result to the Orchestrator.

**Triggers:**
- Execution and Verification phases are complete.
- You have been handed off from the **Verify** skill.
- Or, you need to report a **Blocked** status.

---

## Output Contract (CRITICAL)

The Orchestrator expects a **single JSON object** printed to `stdout`. This is how you "report" your status.

**Success JSON:**
```json
{
  "stepId": "<id>",
  "status": "complete",
  "summary": "Brief description of work done and verification results",
  "artifacts": ["file1.js", "src/components/NewComp.tsx"],
  "testResults": "Passed 8/8 tests" 
}
```

**Blocked JSON:**
```json
{
  "stepId": "<id>",
  "status": "blocked",
  "blockedReason": "Detailed reason why the step cannot be completed",
  "summary": "Work attempted but failed due to..."
}
```

**Rules:**
1. **NO Markdown:** Do not wrap the JSON in ```json ... ``` blocks.
2. **Clean Output:** Ensure the JSON is valid and on its own line.
3. **One Object Per Step:** If you are working on multiple steps, you may output multiple JSON objects (one per line).

---

## How to Do It

### Step 1: Gather Information

Collect from your execution and verification:
- **Status:** Did it pass verification? (`complete` vs `blocked`)
- **Artifacts:** List of files created or modified.
- **Summary:** A concise sentence describing the implementation.
- **Test Results:** Summary of test outcomes (e.g., "Pass: 5, Fail: 0").

### Step 2: Construct the JSON

Map your gathered info to the JSON fields.

*   `stepId`: The ID from the plan you are working on.
*   `status`: "complete" (if verified) or "blocked".
*   `summary`: Human-readable explanation.
*   `artifacts`: Array of file paths.

### Step 3: Output to Stdout

Print the JSON string. **This is your final action.**

---

## Example

**Scenario:** You implemented a "Login" feature (Step 3).

**1. Handoff:** You came from `verify` where 2/2 tests passed.
**2. Constructing Report:**
   - ID: "3"
   - Status: "complete"
   - Summary: "Implemented login logic."
   - Artifacts: ["src/auth/login.ts"]
   - Test Results: "2/2 passed"

**3. Action:**
```json
{"stepId": "3", "status": "complete", "summary": "Implemented login logic and verified with unit tests", "artifacts": ["src/auth/login.ts"], "testResults": "2/2 passed"}
```

---

## Common Pitfalls

- **Outputting Text:** "I have finished the step." (The Orchestrator cannot read this).
- **Outputting YAML:** Do not output YAML. The Orchestrator converts your JSON to a YAML report file automatically.
- **Markdown Blocks:** ```json { ... } ``` (This breaks the parser).