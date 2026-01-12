# Claude Agent - Orchestrated Workflow Protocol

This configuration enables Claude to operate in two modes based on the Agent Workflow Protocol defined in `agent/policies/WORKFLOW.md`.

## Mode Detection

Claude automatically detects which mode to operate in based on the input context:

- **Planning Mode** (Intake → Plan): Activated when receiving a new task or user request without an existing plan reference
- **Worker Mode** (Execute → Verify → Report): Activated when invoked with a plan file path and step ID(s) to execute

## Planning Mode (Intake → Plan)

**When to Use**: New task requests, feature implementations, bug fixes without an existing plan.

### Intake Phase

1. **Understand the Request**
   - Summarize the user's request in your own words
   - Identify any missing details or ambiguous requirements
   - Ask clarifying questions using the available tools (don't assume)
   - Search the codebase for related files, existing patterns, or similar features
   - Confirm the final understood requirements with the user if needed

2. **Gather Context**
   - Use search tools to find relevant code
   - Review existing implementations
   - Understand project structure and conventions
   - Document assumptions made

### Plan Phase

1. **Decompose the Task**
   - Break down the task into discrete, actionable steps
   - Identify dependencies between steps
   - Assign owners to each step (use "self" for single-agent work, or specific agent roles)
   - Define clear acceptance criteria for each step
   - Note any files that will be created or modified
   - Add risk notes for complex or dangerous operations

2. **Create Plan File**
   - Generate a YAML file following the schema in `agent/schemas/plan-schema.yaml`
   - Use filename format: `work/plans/<YYYY-MM-DD>-<descriptive-name>.yaml`
   - Include metadata (created_at, created_by, version)
   - Structure steps with proper dependencies

3. **Plan File Structure**
   ```yaml
   metadata:
     created_at: <ISO 8601 timestamp>
     created_by: claude
     version: "1.0"

   steps:
     - id: step-1
       description: Natural language summary of the task
       owner: self  # or specific agent role
       status: pending
       deps: []  # List of step IDs this depends on
       parallel: false
       criteria: Acceptance criteria for completion
       commands: []  # Optional: specific commands to run
       files: []  # Files this step will create/modify
       risk_notes: ""  # Optional: warnings or things to watch out for
   ```

4. **Stopping Point**
   - **IMPORTANT**: After creating the plan file, STOP. Do not proceed to execution.
   - Planning mode ends after the plan is saved to `work/plans/`
   - The orchestrator will handle execution, or the user can manually approve and execute

### Error Handling in Planning Mode

- If requirements are ambiguous: Ask clarifying questions before creating the plan
- If missing context: Search the codebase or request more information
- If unsure about approach: Document assumptions in the plan and note alternatives in risk_notes

## Worker Mode (Execute → Verify → Report)

**When to Use**: Invoked by the orchestrator with a plan file path and step ID(s) to execute.

### Input Contract

Worker mode expects two inputs:
- `--plan`: Path to the plan YAML file (e.g., `work/plans/2026-01-11-add-auth.yaml`)
- `--step`: Step ID to execute (e.g., `step-1`)

### Plan File Handling

- **READ-ONLY**: The plan file is read-only. NEVER edit it directly.
- The orchestrator handles all plan status updates to avoid conflicts
- Extract step requirements, dependencies, and acceptance criteria from the plan
- Assume all dependencies listed in `deps` are already satisfied

### Execute Phase

1. **Load Skills**
   - Use the execute skill for implementation
   - Use the verify skill for testing
   - Use the report skill for results

2. **Implement the Step**
   - Read the step description and criteria from the plan
   - Write code following project conventions
   - Make changes to files listed in the `files` array
   - Create commits at logical points with meaningful messages
   - Follow the commit format from WORKFLOW.md (feat/fix/refactor/test/docs/chore)

3. **Handle Failures**
   - If the step cannot be completed, set status to "blocked"
   - Document the reason in `blockedReason`
   - Do not proceed to verify if execution failed

### Verify Phase

1. **Run Tests**
   - Execute the project's test suite
   - Run linters and static analysis if available
   - For UI changes, verify visually if possible

2. **Check Acceptance Criteria**
   - Validate that the step's acceptance criteria are met
   - Collect test results (pass/fail counts)
   - Document any errors or warnings

3. **Handle Test Failures**
   - If tests fail, attempt to fix issues
   - If unable to fix, mark step as blocked with reason
   - Include test results in the output

### Report Phase

1. **Generate Output**
   - Output a JSON object to stdout with the following structure:
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

2. **Status Values**
   - `complete`: Step finished successfully, all criteria met
   - `blocked`: Step could not be completed (include blockedReason)

3. **Exit Codes**
   - Exit with code `0` for success (status: complete)
   - Exit with code `1` for failure (status: blocked)

### Error Handling in Worker Mode

- **Execution failures**: Set status to "blocked", document reason, exit with code 1
- **Verification failures**: Include test results in output, attempt to fix if possible
- **Missing files/dependencies**: Mark as blocked, explain what's missing
- **Unexpected errors**: Catch exceptions, log details, mark as blocked

## General Guidelines

- Follow project coding standards and conventions
- Make incremental commits with clear messages
- Prefer additive changes over destructive ones
- Use version control branches for major changes
- Document assumptions and decisions
- Handle errors gracefully and provide clear feedback

## References

- Workflow Protocol: `agent/policies/WORKFLOW.md`
- Plan Schema: `agent/schemas/plan-schema.yaml`
- Report Schema: `agent/schemas/report-schema.yaml`
