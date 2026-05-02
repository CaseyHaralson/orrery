const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseAgentResults,
  createDefaultResult,
  shouldTriggerFailover
} = require("../../lib/orchestration/agent-invoker");

// ============================================================================
// parseAgentResults - basic JSON parsing tests
// ============================================================================

test("parseAgentResults parses single JSON object", () => {
  const stdout =
    '{"stepId": "step-1", "status": "complete", "summary": "Done"}';
  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "step-1");
  assert.equal(results[0].status, "complete");
});

test("parseAgentResults parses multiple JSON objects", () => {
  const stdout = `{"stepId": "step-1", "status": "complete", "summary": "Done"}
{"stepId": "step-2", "status": "complete", "summary": "Also done"}`;

  const results = parseAgentResults(stdout);

  assert.equal(results.length, 2);
  assert.equal(results[0].stepId, "step-1");
  assert.equal(results[1].stepId, "step-2");
});

test("parseAgentResults parses JSON array", () => {
  const stdout =
    '[{"stepId": "step-1", "status": "complete"}, {"stepId": "step-2", "status": "complete"}]';
  const results = parseAgentResults(stdout);

  assert.equal(results.length, 2);
});

// ============================================================================
// parseAgentResults - markdown code block extraction
// ============================================================================

test("parseAgentResults extracts JSON from markdown code block", () => {
  const stdout = `Some text before
\`\`\`json
{"stepId": "step-1", "status": "complete", "summary": "Done"}
\`\`\`
Some text after`;

  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "step-1");
});

test("parseAgentResults extracts JSON from code block without language tag", () => {
  const stdout = `\`\`\`
{"stepId": "step-1", "status": "complete"}
\`\`\``;

  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "step-1");
});

test("parseAgentResults handles multiple code blocks", () => {
  const stdout = `\`\`\`json
{"stepId": "step-1", "status": "complete"}
\`\`\`
Some text
\`\`\`json
{"stepId": "step-2", "status": "blocked", "blockedReason": "Error"}
\`\`\``;

  const results = parseAgentResults(stdout);

  assert.equal(results.length, 2);
});

// ============================================================================
// parseAgentResults - balanced JSON extraction
// ============================================================================

test("parseAgentResults extracts JSON with surrounding text", () => {
  const stdout =
    'Some preamble {"stepId": "step-1", "status": "complete"} and more text';
  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "step-1");
});

test("parseAgentResults handles nested JSON objects", () => {
  const stdout =
    '{"stepId": "step-1", "status": "complete", "data": {"nested": true}}';
  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "step-1");
});

test("parseAgentResults handles JSON with escaped characters", () => {
  const stdout =
    '{"stepId": "step-1", "status": "complete", "summary": "Message with \\"quotes\\""}';
  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].summary, 'Message with "quotes"');
});

test("parseAgentResults handles JSON with braces in strings", () => {
  const stdout =
    '{"stepId": "step-1", "status": "complete", "summary": "Has { braces }"}';
  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].summary, "Has { braces }");
});

// ============================================================================
// parseAgentResults - validation and filtering
// ============================================================================

test("parseAgentResults filters out invalid results", () => {
  const stdout = `{"invalid": "object"}
{"stepId": "step-1", "status": "complete"}`;

  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "step-1");
});

test("parseAgentResults returns empty array for no valid JSON", () => {
  const stdout = "No JSON here at all";
  const results = parseAgentResults(stdout);

  assert.deepEqual(results, []);
});

test("parseAgentResults returns empty array for empty string", () => {
  const results = parseAgentResults("");
  assert.deepEqual(results, []);
});

// ============================================================================
// createDefaultResult - success cases
// ============================================================================

test("createDefaultResult creates complete result for exit code 0", () => {
  const result = createDefaultResult("step-1", 0, "");

  assert.equal(result.stepId, "step-1");
  assert.equal(result.status, "complete");
  assert.ok(result.summary.includes("completed"));
  assert.deepEqual(result.artifacts, []);
});

test("createDefaultResult generates commit message for success", () => {
  const result = createDefaultResult("my-step", 0, "");

  assert.equal(result.commitMessage, "feat: complete step my-step");
});

// ============================================================================
// createDefaultResult - failure cases
// ============================================================================

test("createDefaultResult creates blocked result for non-zero exit", () => {
  const result = createDefaultResult("step-1", 1, "Error message");

  assert.equal(result.stepId, "step-1");
  assert.equal(result.status, "blocked");
  assert.equal(result.blockedReason, "Error message");
});

test("createDefaultResult uses exit code in reason when no stderr", () => {
  const result = createDefaultResult("step-1", 42, "");

  assert.equal(result.blockedReason, "Agent exited with code 42");
});

test("createDefaultResult generates wip commit message for failure", () => {
  const result = createDefaultResult("step-1", 1, "Error");

  assert.equal(result.commitMessage, "wip: attempt step step-1");
});

// ============================================================================
// parseAgentResults - complex scenarios
// ============================================================================

test("parseAgentResults handles mixed valid and invalid JSON objects", () => {
  const stdout = `{"stepId": "step-1", "status": "complete"}
not json at all
{"stepId": "step-2", "status": "blocked", "blockedReason": "Failed"}
{"missing": "status"}`;

  const results = parseAgentResults(stdout);

  assert.equal(results.length, 2);
  assert.equal(results[0].stepId, "step-1");
  assert.equal(results[1].stepId, "step-2");
});

test("parseAgentResults prioritizes code block JSON over raw JSON", () => {
  // When code block contains valid JSON, it should be used
  const stdout = `{"stepId": "raw-1", "status": "complete"}
\`\`\`json
{"stepId": "block-1", "status": "complete"}
\`\`\``;

  const results = parseAgentResults(stdout);

  // Code block results come first if found
  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "block-1");
});

test("parseAgentResults normalizes output with defaults", () => {
  const stdout = '{"stepId": "step-1", "status": "complete"}';
  const results = parseAgentResults(stdout);

  // Should have normalized fields
  assert.equal(results[0].summary, "Step completed");
  assert.deepEqual(results[0].artifacts, []);
  assert.equal(results[0].testResults, null);
  assert.ok(results[0].commitMessage);
});

test("parseAgentResults handles blocked status with required blockedReason", () => {
  const stdout =
    '{"stepId": "step-1", "status": "blocked", "blockedReason": "API down"}';
  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].status, "blocked");
  assert.equal(results[0].blockedReason, "API down");
});

test("parseAgentResults rejects blocked without blockedReason", () => {
  const stdout = '{"stepId": "step-1", "status": "blocked"}';
  const results = parseAgentResults(stdout);

  // Should be filtered out due to missing blockedReason
  assert.equal(results.length, 0);
});

// ============================================================================
// shouldTriggerFailover
// ============================================================================

// ============================================================================
// parseAgentResults - edge cases for balanced JSON extraction
// ============================================================================

test("parseAgentResults handles truncated/unbalanced JSON gracefully", () => {
  const stdout = '{"stepId": "step-1", "status":';
  const results = parseAgentResults(stdout);

  assert.deepEqual(results, []);
});

test("parseAgentResults handles backslash-escaped paths in strings", () => {
  const stdout =
    '{"stepId": "step-1", "status": "complete", "summary": "Path is C:\\\\test\\\\file.js"}';
  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "step-1");
});

test("parseAgentResults handles empty code block and falls back to raw scan", () => {
  const stdout = `\`\`\`json
\`\`\`
{"stepId": "step-1", "status": "complete"}`;

  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "step-1");
});

test("parseAgentResults handles code block with invalid JSON and falls back to raw scan", () => {
  const stdout = `\`\`\`json
this is not json at all
\`\`\`
{"stepId": "step-1", "status": "complete", "summary": "Done"}`;

  const results = parseAgentResults(stdout);

  assert.equal(results.length, 1);
  assert.equal(results[0].stepId, "step-1");
});

test("parseAgentResults handles JSON array inside code block", () => {
  const stdout = `\`\`\`json
[{"stepId": "step-1", "status": "complete"}, {"stepId": "step-2", "status": "complete"}]
\`\`\``;

  const results = parseAgentResults(stdout);

  assert.equal(results.length, 2);
  assert.equal(results[0].stepId, "step-1");
  assert.equal(results[1].stepId, "step-2");
});

// ============================================================================
// shouldTriggerFailover
// ============================================================================

test("shouldTriggerFailover triggers on non-zero exit with no stdout", () => {
  const result = { exitCode: 1, stdout: "", stderr: "" };
  const { shouldFailover, reason } = shouldTriggerFailover(result, null, false);

  assert.equal(shouldFailover, true);
  assert.equal(reason, "agent_error");
});

test("shouldTriggerFailover triggers on usage limit error", () => {
  const result = {
    exitCode: 1,
    stdout: "",
    stderr: "ERROR: You've hit your usage limit. Upgrade to Pro..."
  };
  const { shouldFailover, reason } = shouldTriggerFailover(result, null, false);

  assert.equal(shouldFailover, true);
  assert.equal(reason, "agent_error");
});

test("shouldTriggerFailover triggers on arbitrary unknown error", () => {
  const result = {
    exitCode: 1,
    stdout: "",
    stderr: "Something completely unexpected happened"
  };
  const { shouldFailover, reason } = shouldTriggerFailover(result, null, false);

  assert.equal(shouldFailover, true);
  assert.equal(reason, "agent_error");
});

test("shouldTriggerFailover does NOT trigger when agent produced valid structured output", () => {
  const result = {
    exitCode: 1,
    stdout:
      '{"stepId": "step-1", "status": "blocked", "blockedReason": "Tests failing"}',
    stderr: "Agent exited with error"
  };
  const { shouldFailover, reason } = shouldTriggerFailover(result, null, false);

  assert.equal(shouldFailover, false);
  assert.equal(reason, null);
});

test("shouldTriggerFailover does NOT trigger on exit code 0", () => {
  const result = { exitCode: 0, stdout: "", stderr: "" };
  const { shouldFailover, reason } = shouldTriggerFailover(result, null, false);

  assert.equal(shouldFailover, false);
  assert.equal(reason, null);
});

test("shouldTriggerFailover triggers on spawn ENOENT", () => {
  const spawnError = new Error("spawn ENOENT");
  spawnError.code = "ENOENT";
  const { shouldFailover, reason } = shouldTriggerFailover(
    null,
    spawnError,
    false
  );

  assert.equal(shouldFailover, true);
  assert.equal(reason, "command_not_found");
});

test("shouldTriggerFailover triggers on generic spawn error", () => {
  const spawnError = new Error("spawn failed");
  const { shouldFailover, reason } = shouldTriggerFailover(
    null,
    spawnError,
    false
  );

  assert.equal(shouldFailover, true);
  assert.equal(reason, "spawn_error");
});

test("shouldTriggerFailover triggers on timeout", () => {
  const { shouldFailover, reason } = shouldTriggerFailover(null, null, true);

  assert.equal(shouldFailover, true);
  assert.equal(reason, "timeout");
});
