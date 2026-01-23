const assert = require("node:assert/strict");
const test = require("node:test");

const { ProgressTracker } = require("../../lib/orchestration/progress-tracker");
const {
  createMockPlan,
  captureConsole,
  sleep
} = require("../helpers/test-utils");

// ============================================================================
// Constructor tests
// ============================================================================

test("ProgressTracker initializes with correct values", () => {
  const tracker = new ProgressTracker(10, "test-plan.yaml");

  assert.equal(tracker.totalSteps, 10);
  assert.equal(tracker.planFileName, "test-plan.yaml");
  assert.equal(tracker.completedCount, 0);
  assert.equal(tracker.blockedCount, 0);
  assert.ok(tracker.startTime <= Date.now());
  assert.deepEqual(tracker.stepCompletionTimes, []);
  assert.equal(tracker.stepStartTimes.size, 0);
});

// ============================================================================
// initializeFromPlan tests
// ============================================================================

test("initializeFromPlan counts completed steps", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "complete" },
    { id: "step-3", status: "pending" }
  ]);

  tracker.initializeFromPlan(plan);
  assert.equal(tracker.completedCount, 2);
  assert.equal(tracker.blockedCount, 0);
});

test("initializeFromPlan counts blocked steps", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  const plan = createMockPlan([
    { id: "step-1", status: "blocked" },
    { id: "step-2", status: "pending" }
  ]);

  tracker.initializeFromPlan(plan);
  assert.equal(tracker.completedCount, 0);
  assert.equal(tracker.blockedCount, 1);
});

test("initializeFromPlan counts mixed statuses", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "blocked" },
    { id: "step-3", status: "in_progress" },
    { id: "step-4", status: "pending" }
  ]);

  tracker.initializeFromPlan(plan);
  assert.equal(tracker.completedCount, 1);
  assert.equal(tracker.blockedCount, 1);
});

// ============================================================================
// recordStart tests
// ============================================================================

test("recordStart records start time for single step", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.recordStart(["step-1"]);

  assert.ok(tracker.stepStartTimes.has("step-1"));
  assert.ok(tracker.stepStartTimes.get("step-1") <= Date.now());
});

test("recordStart records start time for multiple steps", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.recordStart(["step-1", "step-2", "step-3"]);

  assert.equal(tracker.stepStartTimes.size, 3);
  assert.ok(tracker.stepStartTimes.has("step-1"));
  assert.ok(tracker.stepStartTimes.has("step-2"));
  assert.ok(tracker.stepStartTimes.has("step-3"));
});

// ============================================================================
// recordComplete tests
// ============================================================================

test("recordComplete increments completedCount", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.recordComplete("step-1");

  assert.equal(tracker.completedCount, 1);
});

test("recordComplete records duration when start time exists", async () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.recordStart(["step-1"]);
  await sleep(10);
  tracker.recordComplete("step-1");

  assert.equal(tracker.stepCompletionTimes.length, 1);
  assert.ok(tracker.stepCompletionTimes[0] >= 10);
  assert.ok(!tracker.stepStartTimes.has("step-1"));
});

test("recordComplete handles step without start time", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.recordComplete("step-1");

  assert.equal(tracker.completedCount, 1);
  assert.equal(tracker.stepCompletionTimes.length, 0);
});

// ============================================================================
// recordBlocked tests
// ============================================================================

test("recordBlocked increments blockedCount", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.recordBlocked("step-1");

  assert.equal(tracker.blockedCount, 1);
});

test("recordBlocked removes step from start times", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.recordStart(["step-1"]);
  tracker.recordBlocked("step-1");

  assert.ok(!tracker.stepStartTimes.has("step-1"));
});

// ============================================================================
// getElapsed tests
// ============================================================================

test("getElapsed returns positive value", async () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  await sleep(10);
  const elapsed = tracker.getElapsed();

  assert.ok(elapsed > 0);
});

// ============================================================================
// getEstimatedRemaining tests
// ============================================================================

test("getEstimatedRemaining returns null with no completion data", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  const remaining = tracker.getEstimatedRemaining();

  assert.equal(remaining, null);
});

test("getEstimatedRemaining calculates based on average", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  // Simulate completion times
  tracker.stepCompletionTimes = [1000, 2000, 3000];
  tracker.completedCount = 3;
  tracker.blockedCount = 0;

  const remaining = tracker.getEstimatedRemaining();
  // Average is 2000ms, 2 steps remaining = 4000ms
  assert.equal(remaining, 4000);
});

test("getEstimatedRemaining accounts for blocked steps", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.stepCompletionTimes = [1000];
  tracker.completedCount = 2;
  tracker.blockedCount = 1;

  const remaining = tracker.getEstimatedRemaining();
  // 1 step completed with duration, 2 steps remaining = 2000ms
  assert.equal(remaining, 2000);
});

// ============================================================================
// formatDuration tests
// ============================================================================

test("formatDuration formats milliseconds under 1 second", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  assert.equal(tracker.formatDuration(500), "<1s");
  assert.equal(tracker.formatDuration(0), "<1s");
  assert.equal(tracker.formatDuration(999), "<1s");
});

test("formatDuration formats seconds", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  assert.equal(tracker.formatDuration(1000), "1s");
  assert.equal(tracker.formatDuration(30000), "30s");
  assert.equal(tracker.formatDuration(59000), "59s");
});

test("formatDuration formats minutes and seconds", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  assert.equal(tracker.formatDuration(60000), "1m 0s");
  assert.equal(tracker.formatDuration(90000), "1m 30s");
  assert.equal(tracker.formatDuration(150000), "2m 30s");
});

test("formatDuration formats hours and minutes", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  assert.equal(tracker.formatDuration(3600000), "1h 0m");
  assert.equal(tracker.formatDuration(3660000), "1h 1m");
  assert.equal(tracker.formatDuration(5400000), "1h 30m");
});

// ============================================================================
// getPercentComplete tests
// ============================================================================

test("getPercentComplete returns 0 for no progress", () => {
  const tracker = new ProgressTracker(10, "test.yaml");
  assert.equal(tracker.getPercentComplete(), 0);
});

test("getPercentComplete calculates correct percentage", () => {
  const tracker = new ProgressTracker(10, "test.yaml");
  tracker.completedCount = 5;
  assert.equal(tracker.getPercentComplete(), 50);
});

test("getPercentComplete includes blocked in calculation", () => {
  const tracker = new ProgressTracker(10, "test.yaml");
  tracker.completedCount = 3;
  tracker.blockedCount = 2;
  assert.equal(tracker.getPercentComplete(), 50);
});

test("getPercentComplete returns 100 when all done", () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.completedCount = 4;
  tracker.blockedCount = 1;
  assert.equal(tracker.getPercentComplete(), 100);
});

test("getPercentComplete rounds to nearest integer", () => {
  const tracker = new ProgressTracker(3, "test.yaml");
  tracker.completedCount = 1;
  // 1/3 = 33.33...%
  assert.equal(tracker.getPercentComplete(), 33);
});

// ============================================================================
// logStart tests
// ============================================================================

test("logStart outputs progress message", async () => {
  const tracker = new ProgressTracker(5, "test-plan.yaml");
  const { stdout } = await captureConsole(() => {
    tracker.logStart();
  });

  assert.ok(
    stdout.some((line) => line.includes("Starting plan: test-plan.yaml"))
  );
  assert.ok(stdout.some((line) => line.includes("Total steps: 5")));
});

// ============================================================================
// logStepStart tests
// ============================================================================

test("logStepStart logs single step", async () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  const { stdout } = await captureConsole(() => {
    tracker.logStepStart(["step-1"]);
  });

  assert.ok(stdout.some((line) => line.includes("Starting step-1")));
  assert.ok(tracker.stepStartTimes.has("step-1"));
});

test("logStepStart logs multiple steps", async () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  const { stdout } = await captureConsole(() => {
    tracker.logStepStart(["step-1", "step-2"]);
  });

  assert.ok(stdout.some((line) => line.includes("Starting 2 steps")));
  assert.ok(stdout.some((line) => line.includes("step-1, step-2")));
});

// ============================================================================
// logProgress tests
// ============================================================================

test("logProgress outputs current progress", async () => {
  const tracker = new ProgressTracker(10, "test.yaml");
  tracker.completedCount = 5;
  const { stdout } = await captureConsole(() => {
    tracker.logProgress();
  });

  assert.ok(stdout.some((line) => line.includes("5/10 steps")));
  assert.ok(stdout.some((line) => line.includes("50%")));
});

test("logProgress shows ETA when available", async () => {
  const tracker = new ProgressTracker(10, "test.yaml");
  tracker.completedCount = 5;
  tracker.stepCompletionTimes = [1000];
  const { stdout } = await captureConsole(() => {
    tracker.logProgress();
  });

  assert.ok(stdout.some((line) => line.includes("ETA:")));
});

// ============================================================================
// logSummary tests
// ============================================================================

test("logSummary outputs final summary", async () => {
  const tracker = new ProgressTracker(5, "test.yaml");
  tracker.completedCount = 4;
  tracker.blockedCount = 1;
  const { stdout } = await captureConsole(() => {
    tracker.logSummary();
  });

  assert.ok(stdout.some((line) => line.includes("Summary")));
  assert.ok(stdout.some((line) => line.includes("4 complete")));
  assert.ok(stdout.some((line) => line.includes("1 blocked")));
});
