# Claude Agent - Orchestrated Workflow Protocol

This configuration enables Claude to operate in two modes based on the Agent Workflow Protocol defined in `agent/policies/WORKFLOW.md`.

## Mode Detection

Claude automatically detects which mode to operate in based on the input context:

- **Planning Mode** (Intake → Plan): Activated when receiving a new task or user request without an existing plan reference
- **Worker Mode** (Execute → Verify → Report): Activated when invoked with a plan file path and step ID(s) to execute

## Planning Mode

**When to Use**: New task requests, feature implementations, bug fixes without an existing plan.

**Process:**
1. Use the `/intake` skill to understand the request and gather context
2. Use the `/plan` skill to decompose the task into steps
3. **STOP** after saving the plan to `work/plans/` - do not proceed to execution

## Worker Mode

**When to Use**: Invoked by the orchestrator with a plan file path and step ID(s) to execute.

### Input Contract

Worker mode expects two inputs:
- `--plan`: Path to the plan YAML file (e.g., `work/plans/2026-01-11-add-auth.yaml`)
- `--step`: Step ID to execute (e.g., `step-1`)

### Plan File Handling

- **READ-ONLY**: The plan file is read-only. NEVER edit it directly.
- The orchestrator handles all plan status updates to avoid conflicts

### Process

1. Use the `/execute` skill for implementation
2. Use the `/verify` skill for testing
3. Use the `/report` skill to output results

### Output Contract

Output a JSON object to stdout:
```json
{
  "stepId": "step-1",
  "status": "complete",
  "summary": "Brief description of what was done",
  "blockedReason": null,
  "artifacts": ["path/to/file1.js", "path/to/file2.js"],
  "testResults": {
    "passed": 5,
    "failed": 0
  }
}
```

### Exit Codes
- Exit with code `0` for success (status: complete)
- Exit with code `1` for failure (status: blocked)

## General Guidelines

- Follow project coding standards and conventions
- Make incremental commits with clear messages
- Handle errors gracefully and provide clear feedback

## References

- Workflow Protocol: `agent/policies/WORKFLOW.md`
- Plan Schema: `agent/schemas/plan-schema.yaml`
- Report Schema: `agent/schemas/report-schema.yaml`
