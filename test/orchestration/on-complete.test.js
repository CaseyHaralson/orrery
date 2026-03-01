const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { runOnCompleteHook } = require("../../lib/orchestration");
const {
  createTempDir,
  cleanupDir,
  captureConsole
} = require("../helpers/test-utils");

// ============================================================================
// runOnCompleteHook tests
// ============================================================================

test("hook runs with correct env vars on success", async (t) => {
  const tempDir = createTempDir("on-complete-");
  t.after(() => cleanupDir(tempDir));

  const envFile = path.join(tempDir, "env-output.json");
  const command = `${process.execPath} -e "const fs = require('fs'); const env = {}; for (const k of Object.keys(process.env)) { if (k.startsWith('ORRERY_')) env[k] = process.env[k]; } fs.writeFileSync('${envFile.replace(/\\/g, "\\\\")}', JSON.stringify(env));"`;

  const context = {
    planName: "my-feature.yaml",
    planFile: "/tmp/plans/my-feature.yaml",
    outcome: "success",
    workBranch: "plan/my-feature",
    sourceBranch: "main",
    prUrl: "https://github.com/user/repo/pull/42",
    stepsTotal: 5,
    stepsCompleted: 5,
    stepsBlocked: 0
  };

  await captureConsole(() => {
    runOnCompleteHook(command, context, tempDir);
  });

  const envOutput = JSON.parse(fs.readFileSync(envFile, "utf8"));

  assert.equal(envOutput.ORRERY_PLAN_NAME, "my-feature.yaml");
  assert.equal(envOutput.ORRERY_PLAN_FILE, "/tmp/plans/my-feature.yaml");
  assert.equal(envOutput.ORRERY_PLAN_OUTCOME, "success");
  assert.equal(envOutput.ORRERY_WORK_BRANCH, "plan/my-feature");
  assert.equal(envOutput.ORRERY_SOURCE_BRANCH, "main");
  assert.equal(envOutput.ORRERY_PR_URL, "https://github.com/user/repo/pull/42");
  assert.equal(envOutput.ORRERY_STEPS_TOTAL, "5");
  assert.equal(envOutput.ORRERY_STEPS_COMPLETED, "5");
  assert.equal(envOutput.ORRERY_STEPS_BLOCKED, "0");
});

test("hook runs with outcome 'partial' when some steps blocked", async (t) => {
  const tempDir = createTempDir("on-complete-");
  t.after(() => cleanupDir(tempDir));

  const envFile = path.join(tempDir, "env-output.json");
  const command = `${process.execPath} -e "const fs = require('fs'); const env = {}; for (const k of Object.keys(process.env)) { if (k.startsWith('ORRERY_')) env[k] = process.env[k]; } fs.writeFileSync('${envFile.replace(/\\/g, "\\\\")}', JSON.stringify(env));"`;

  const context = {
    planName: "my-feature.yaml",
    planFile: "/tmp/plans/my-feature.yaml",
    outcome: "partial",
    workBranch: "plan/my-feature",
    sourceBranch: "main",
    prUrl: "",
    stepsTotal: 5,
    stepsCompleted: 4,
    stepsBlocked: 1
  };

  await captureConsole(() => {
    runOnCompleteHook(command, context, tempDir);
  });

  const envOutput = JSON.parse(fs.readFileSync(envFile, "utf8"));
  assert.equal(envOutput.ORRERY_PLAN_OUTCOME, "partial");
  assert.equal(envOutput.ORRERY_STEPS_COMPLETED, "4");
  assert.equal(envOutput.ORRERY_STEPS_BLOCKED, "1");
});

test("hook runs with outcome 'incomplete' when plan stops early", async (t) => {
  const tempDir = createTempDir("on-complete-");
  t.after(() => cleanupDir(tempDir));

  const envFile = path.join(tempDir, "env-output.json");
  const command = `${process.execPath} -e "const fs = require('fs'); const env = {}; for (const k of Object.keys(process.env)) { if (k.startsWith('ORRERY_')) env[k] = process.env[k]; } fs.writeFileSync('${envFile.replace(/\\/g, "\\\\")}', JSON.stringify(env));"`;

  const context = {
    planName: "my-feature.yaml",
    planFile: "/tmp/plans/my-feature.yaml",
    outcome: "incomplete",
    workBranch: "plan/my-feature",
    sourceBranch: "main",
    prUrl: "",
    stepsTotal: 5,
    stepsCompleted: 2,
    stepsBlocked: 0
  };

  await captureConsole(() => {
    runOnCompleteHook(command, context, tempDir);
  });

  const envOutput = JSON.parse(fs.readFileSync(envFile, "utf8"));
  assert.equal(envOutput.ORRERY_PLAN_OUTCOME, "incomplete");
  assert.equal(envOutput.ORRERY_STEPS_COMPLETED, "2");
  assert.equal(envOutput.ORRERY_PR_URL, "");
});

test("hook failure is caught and logged (no throw)", async (t) => {
  const tempDir = createTempDir("on-complete-");
  t.after(() => cleanupDir(tempDir));

  const context = {
    planName: "test.yaml",
    planFile: "/tmp/test.yaml",
    outcome: "success",
    workBranch: "plan/test",
    sourceBranch: "main",
    prUrl: "",
    stepsTotal: 1,
    stepsCompleted: 1,
    stepsBlocked: 0
  };

  const { stderr } = await captureConsole(() => {
    runOnCompleteHook("exit 1", context, tempDir);
  });

  // Should not throw, but should log an error
  assert.ok(
    stderr.some((line) => line.includes("on-complete hook failed")),
    "Expected error message about hook failure"
  );
});

test("hook is skipped when command is null", async (t) => {
  const tempDir = createTempDir("on-complete-");
  t.after(() => cleanupDir(tempDir));

  const context = {
    planName: "test.yaml",
    planFile: "/tmp/test.yaml",
    outcome: "success",
    workBranch: "plan/test",
    sourceBranch: "main",
    prUrl: "",
    stepsTotal: 1,
    stepsCompleted: 1,
    stepsBlocked: 0
  };

  const { stdout } = await captureConsole(() => {
    runOnCompleteHook(null, context, tempDir);
  });

  // Should produce no output when command is null
  assert.equal(stdout.length, 0, "Expected no output when command is null");
});

test("hook is skipped when command is undefined", async (t) => {
  const tempDir = createTempDir("on-complete-");
  t.after(() => cleanupDir(tempDir));

  const context = {
    planName: "test.yaml",
    planFile: "/tmp/test.yaml",
    outcome: "success",
    workBranch: "plan/test",
    sourceBranch: "main",
    prUrl: "",
    stepsTotal: 1,
    stepsCompleted: 1,
    stepsBlocked: 0
  };

  const { stdout } = await captureConsole(() => {
    runOnCompleteHook(undefined, context, tempDir);
  });

  assert.equal(
    stdout.length,
    0,
    "Expected no output when command is undefined"
  );
});

test("numeric values are stringified in env vars", async (t) => {
  const tempDir = createTempDir("on-complete-");
  t.after(() => cleanupDir(tempDir));

  const envFile = path.join(tempDir, "env-output.json");
  const command = `${process.execPath} -e "const fs = require('fs'); const env = {}; for (const k of Object.keys(process.env)) { if (k.startsWith('ORRERY_')) env[k] = process.env[k]; } fs.writeFileSync('${envFile.replace(/\\/g, "\\\\")}', JSON.stringify(env));"`;

  const context = {
    planName: "test.yaml",
    planFile: "/tmp/test.yaml",
    outcome: "success",
    workBranch: "plan/test",
    sourceBranch: "main",
    prUrl: "",
    stepsTotal: 10,
    stepsCompleted: 8,
    stepsBlocked: 2
  };

  await captureConsole(() => {
    runOnCompleteHook(command, context, tempDir);
  });

  const envOutput = JSON.parse(fs.readFileSync(envFile, "utf8"));

  // All values should be strings
  assert.equal(typeof envOutput.ORRERY_STEPS_TOTAL, "string");
  assert.equal(typeof envOutput.ORRERY_STEPS_COMPLETED, "string");
  assert.equal(typeof envOutput.ORRERY_STEPS_BLOCKED, "string");
  assert.equal(envOutput.ORRERY_STEPS_TOTAL, "10");
  assert.equal(envOutput.ORRERY_STEPS_COMPLETED, "8");
  assert.equal(envOutput.ORRERY_STEPS_BLOCKED, "2");
});
