const assert = require("node:assert/strict");
const test = require("node:test");

const {
  blockStepAfterReviewMaxIterations,
  REVIEW_MAX_ITERATIONS_BLOCKED_REASON
} = require("../../lib/orchestration");

test("blockStepAfterReviewMaxIterations converts complete result to blocked", () => {
  const result = blockStepAfterReviewMaxIterations({
    stepId: "1",
    status: "complete",
    summary: "Implemented modulo",
    artifacts: ["src/math.js"],
    testResults: "3/3 passed",
    commitMessage: "feat: add modulo"
  });

  assert.deepEqual(result, {
    stepId: "1",
    status: "blocked",
    summary: "Implemented modulo",
    artifacts: ["src/math.js"],
    testResults: "3/3 passed",
    commitMessage: "feat: add modulo",
    blockedReason: REVIEW_MAX_ITERATIONS_BLOCKED_REASON
  });
});

test("blockStepAfterReviewMaxIterations supplies fallback summary", () => {
  const result = blockStepAfterReviewMaxIterations({
    stepId: "1",
    status: "complete"
  });

  assert.equal(result.status, "blocked");
  assert.equal(
    result.summary,
    "Step blocked because review did not approve the changes."
  );
  assert.equal(result.blockedReason, REVIEW_MAX_ITERATIONS_BLOCKED_REASON);
});
