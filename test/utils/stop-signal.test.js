const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  getStopSignalPath,
  requestStop,
  isStopRequested,
  clearStopSignal
} = require("../../lib/utils/stop-signal");
const { createTempDir, cleanupDir } = require("../helpers/test-utils");

// Helper to set up and tear down ORRERY_WORK_DIR
function withTempWorkDir(t) {
  const tempDir = createTempDir("stop-signal-");
  const originalEnv = process.env.ORRERY_WORK_DIR;
  process.env.ORRERY_WORK_DIR = tempDir;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  return tempDir;
}

// ============================================================================
// getStopSignalPath tests
// ============================================================================

test("getStopSignalPath returns global path when no planId", (t) => {
  withTempWorkDir(t);
  const signalPath = getStopSignalPath();
  assert.ok(signalPath.endsWith("stop.signal"));
});

test("getStopSignalPath returns plan-specific path with planId", (t) => {
  withTempWorkDir(t);
  const signalPath = getStopSignalPath("my-plan");
  assert.ok(signalPath.endsWith("stop-my-plan.signal"));
});

// ============================================================================
// requestStop / isStopRequested tests
// ============================================================================

test("isStopRequested returns false when no signal exists", (t) => {
  withTempWorkDir(t);
  assert.ok(!isStopRequested());
  assert.ok(!isStopRequested("my-plan"));
});

test("requestStop creates signal file and isStopRequested detects it", (t) => {
  withTempWorkDir(t);

  requestStop();
  assert.ok(isStopRequested());
  assert.ok(!isStopRequested("my-plan"));
});

test("requestStop with planId creates plan-specific signal", (t) => {
  withTempWorkDir(t);

  requestStop("my-plan");
  assert.ok(!isStopRequested());
  assert.ok(isStopRequested("my-plan"));
});

test("signal file contains a timestamp", (t) => {
  withTempWorkDir(t);

  requestStop();
  const content = fs.readFileSync(getStopSignalPath(), "utf8").trim();
  // Should be a valid ISO date string
  const date = new Date(content);
  assert.ok(!isNaN(date.getTime()));
});

// ============================================================================
// clearStopSignal tests
// ============================================================================

test("clearStopSignal removes the signal file", (t) => {
  withTempWorkDir(t);

  requestStop();
  assert.ok(isStopRequested());

  clearStopSignal();
  assert.ok(!isStopRequested());
});

test("clearStopSignal with planId removes only that plan signal", (t) => {
  withTempWorkDir(t);

  requestStop();
  requestStop("my-plan");
  assert.ok(isStopRequested());
  assert.ok(isStopRequested("my-plan"));

  clearStopSignal("my-plan");
  assert.ok(isStopRequested()); // global still exists
  assert.ok(!isStopRequested("my-plan"));
});

test("clearStopSignal does not throw when file does not exist", (t) => {
  withTempWorkDir(t);

  // Should not throw
  clearStopSignal();
  clearStopSignal("nonexistent");
});
