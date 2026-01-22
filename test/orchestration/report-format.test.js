const assert = require("node:assert/strict");
const test = require("node:test");

const {
  REPORT_FIELDS,
  validateAgentOutput,
  getFormatInstructions,
} = require("../../lib/orchestration/report-format");

// ============================================================================
// validateAgentOutput tests - valid inputs
// ============================================================================

test("validateAgentOutput accepts valid complete report", () => {
  const data = {
    stepId: "step-1",
    status: "complete",
    summary: "Did the thing",
    artifacts: ["src/file.js"],
    testResults: "5/5 passed",
    commitMessage: "feat: add feature",
  };

  const result = validateAgentOutput(data);
  assert.equal(result.stepId, "step-1");
  assert.equal(result.status, "complete");
  assert.equal(result.summary, "Did the thing");
  assert.deepEqual(result.artifacts, ["src/file.js"]);
  assert.equal(result.testResults, "5/5 passed");
  assert.equal(result.commitMessage, "feat: add feature");
});

test("validateAgentOutput accepts valid blocked report", () => {
  const data = {
    stepId: "step-2",
    status: "blocked",
    blockedReason: "API is down",
    summary: "Could not verify",
  };

  const result = validateAgentOutput(data);
  assert.equal(result.stepId, "step-2");
  assert.equal(result.status, "blocked");
  assert.equal(result.blockedReason, "API is down");
  assert.equal(result.summary, "Could not verify");
});

test("validateAgentOutput accepts minimal complete report", () => {
  const data = {
    stepId: "step-1",
    status: "complete",
  };

  const result = validateAgentOutput(data);
  assert.equal(result.stepId, "step-1");
  assert.equal(result.status, "complete");
  assert.equal(result.summary, "Step completed");
  assert.deepEqual(result.artifacts, []);
  assert.equal(result.testResults, null);
  assert.equal(result.blockedReason, null);
  assert.equal(result.commitMessage, "feat: complete step step-1");
});

test("validateAgentOutput accepts minimal blocked report", () => {
  const data = {
    stepId: "step-1",
    status: "blocked",
    blockedReason: "Something failed",
  };

  const result = validateAgentOutput(data);
  assert.equal(result.status, "blocked");
  assert.equal(result.summary, "Step blocked");
  assert.equal(result.blockedReason, "Something failed");
});

// ============================================================================
// validateAgentOutput tests - invalid inputs
// ============================================================================

test("validateAgentOutput throws on null input", () => {
  assert.throws(
    () => validateAgentOutput(null),
    /Report data must be an object/
  );
});

test("validateAgentOutput throws on non-object input", () => {
  assert.throws(
    () => validateAgentOutput("string"),
    /Report data must be an object/
  );
});

test("validateAgentOutput throws on missing stepId", () => {
  const data = {
    status: "complete",
  };

  assert.throws(
    () => validateAgentOutput(data),
    /Report missing required field: stepId/
  );
});

test("validateAgentOutput throws on non-string stepId", () => {
  const data = {
    stepId: 123,
    status: "complete",
  };

  assert.throws(
    () => validateAgentOutput(data),
    /Report missing required field: stepId/
  );
});

test("validateAgentOutput throws on missing status", () => {
  const data = {
    stepId: "step-1",
  };

  assert.throws(
    () => validateAgentOutput(data),
    /Invalid status/
  );
});

test("validateAgentOutput throws on invalid status value", () => {
  const data = {
    stepId: "step-1",
    status: "pending",
  };

  assert.throws(
    () => validateAgentOutput(data),
    /Invalid status: pending/
  );
});

test("validateAgentOutput throws on blocked without blockedReason", () => {
  const data = {
    stepId: "step-1",
    status: "blocked",
  };

  assert.throws(
    () => validateAgentOutput(data),
    /Report with status 'blocked' must include 'blockedReason'/
  );
});

// ============================================================================
// validateAgentOutput tests - normalization
// ============================================================================

test("validateAgentOutput normalizes non-array artifacts to empty array", () => {
  const data = {
    stepId: "step-1",
    status: "complete",
    artifacts: "not-an-array",
  };

  const result = validateAgentOutput(data);
  assert.deepEqual(result.artifacts, []);
});

test("validateAgentOutput normalizes undefined artifacts to empty array", () => {
  const data = {
    stepId: "step-1",
    status: "complete",
  };

  const result = validateAgentOutput(data);
  assert.deepEqual(result.artifacts, []);
});

test("validateAgentOutput preserves valid artifacts array", () => {
  const data = {
    stepId: "step-1",
    status: "complete",
    artifacts: ["file1.js", "file2.js"],
  };

  const result = validateAgentOutput(data);
  assert.deepEqual(result.artifacts, ["file1.js", "file2.js"]);
});

test("validateAgentOutput generates default commit message for complete", () => {
  const data = {
    stepId: "my-step",
    status: "complete",
  };

  const result = validateAgentOutput(data);
  assert.equal(result.commitMessage, "feat: complete step my-step");
});

// ============================================================================
// getFormatInstructions tests
// ============================================================================

test("getFormatInstructions returns non-empty string", () => {
  const instructions = getFormatInstructions();
  assert.ok(typeof instructions === "string");
  assert.ok(instructions.length > 0);
});

test("getFormatInstructions mentions JSON format", () => {
  const instructions = getFormatInstructions();
  assert.ok(instructions.includes("JSON"));
});

test("getFormatInstructions mentions stepId field", () => {
  const instructions = getFormatInstructions();
  assert.ok(instructions.includes("stepId"));
});

test("getFormatInstructions mentions both status values", () => {
  const instructions = getFormatInstructions();
  assert.ok(instructions.includes("complete"));
  assert.ok(instructions.includes("blocked"));
});

test("getFormatInstructions provides examples", () => {
  const instructions = getFormatInstructions();
  assert.ok(instructions.includes("Success Example"));
  assert.ok(instructions.includes("Blocked Example"));
});

// ============================================================================
// REPORT_FIELDS tests
// ============================================================================

test("REPORT_FIELDS contains expected fields", () => {
  assert.ok("stepId" in REPORT_FIELDS);
  assert.ok("status" in REPORT_FIELDS);
  assert.ok("summary" in REPORT_FIELDS);
  assert.ok("artifacts" in REPORT_FIELDS);
  assert.ok("testResults" in REPORT_FIELDS);
  assert.ok("blockedReason" in REPORT_FIELDS);
  assert.ok("commitMessage" in REPORT_FIELDS);
});

test("REPORT_FIELDS values are descriptive strings", () => {
  for (const [key, value] of Object.entries(REPORT_FIELDS)) {
    assert.ok(typeof value === "string", `${key} should have string description`);
    assert.ok(value.length > 0, `${key} should have non-empty description`);
  }
});
