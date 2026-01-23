const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  loadPlan,
  savePlan,
  updateStepStatus,
  updateStepsStatus,
  getPlanFiles,
  movePlanToCompleted,
  getCompletedPlanNames
} = require("../../lib/orchestration/plan-loader");
const {
  createTempDir,
  cleanupDir,
  createMinimalPlan,
  writeTempPlan
} = require("../helpers/test-utils");

// ============================================================================
// loadPlan tests
// ============================================================================

test("loadPlan loads and parses YAML plan file", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    metadata: { name: "my-plan" },
    steps: [
      { id: "step-1", description: "First step", status: "pending" },
      { id: "step-2", description: "Second step", status: "complete" }
    ]
  });
  const planPath = writeTempPlan(tempDir, "test-plan.yaml", planContent);

  const plan = loadPlan(planPath);

  assert.equal(plan.fileName, "test-plan.yaml");
  assert.equal(plan.filePath, planPath);
  assert.equal(plan.metadata.name, "my-plan");
  assert.equal(plan.steps.length, 2);
});

test("loadPlan provides getCompletedSteps helper", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [
      { id: "step-1", status: "complete" },
      { id: "step-2", status: "pending" },
      { id: "step-3", status: "complete" }
    ]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  const plan = loadPlan(planPath);
  const completed = plan.getCompletedSteps();

  assert.ok(completed instanceof Set);
  assert.equal(completed.size, 2);
  assert.ok(completed.has("step-1"));
  assert.ok(completed.has("step-3"));
});

test("loadPlan provides getBlockedSteps helper", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [
      { id: "step-1", status: "blocked" },
      { id: "step-2", status: "pending" }
    ]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  const plan = loadPlan(planPath);
  const blocked = plan.getBlockedSteps();

  assert.ok(blocked instanceof Set);
  assert.equal(blocked.size, 1);
  assert.ok(blocked.has("step-1"));
});

test("loadPlan provides isComplete helper", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [
      { id: "step-1", status: "complete" },
      { id: "step-2", status: "blocked" }
    ]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  const plan = loadPlan(planPath);
  assert.equal(plan.isComplete(), true);
});

test("loadPlan isComplete returns false with pending steps", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [
      { id: "step-1", status: "complete" },
      { id: "step-2", status: "pending" }
    ]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  const plan = loadPlan(planPath);
  assert.equal(plan.isComplete(), false);
});

test("loadPlan provides isSuccessful helper", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [
      { id: "step-1", status: "complete" },
      { id: "step-2", status: "complete" }
    ]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  const plan = loadPlan(planPath);
  assert.equal(plan.isSuccessful(), true);
});

test("loadPlan isSuccessful returns false with blocked steps", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [
      { id: "step-1", status: "complete" },
      { id: "step-2", status: "blocked" }
    ]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  const plan = loadPlan(planPath);
  assert.equal(plan.isSuccessful(), false);
});

// ============================================================================
// savePlan tests
// ============================================================================

test("savePlan writes updated plan to file", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [{ id: "step-1", status: "pending" }]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  const plan = loadPlan(planPath);
  plan.steps[0].status = "complete";
  savePlan(plan);

  const reloaded = loadPlan(planPath);
  assert.equal(reloaded.steps[0].status, "complete");
});

test("savePlan preserves metadata updates", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    metadata: { name: "original" }
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  const plan = loadPlan(planPath);
  plan.metadata.work_branch = "plan/test";
  savePlan(plan);

  const reloaded = loadPlan(planPath);
  assert.equal(reloaded.metadata.work_branch, "plan/test");
});

// ============================================================================
// updateStepStatus tests
// ============================================================================

test("updateStepStatus updates step status in file", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [
      { id: "step-1", status: "pending" },
      { id: "step-2", status: "pending" }
    ]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  updateStepStatus(planPath, "step-1", "complete");

  const plan = loadPlan(planPath);
  assert.equal(plan.steps[0].status, "complete");
  assert.equal(plan.steps[1].status, "pending");
});

test("updateStepStatus adds extra fields", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [{ id: "step-1", status: "pending" }]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  updateStepStatus(planPath, "step-1", "blocked", {
    blocked_reason: "API down"
  });

  const plan = loadPlan(planPath);
  assert.equal(plan.steps[0].status, "blocked");
  assert.equal(plan.steps[0].blocked_reason, "API down");
});

// ============================================================================
// updateStepsStatus tests
// ============================================================================

test("updateStepsStatus updates multiple steps at once", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [
      { id: "step-1", status: "pending" },
      { id: "step-2", status: "pending" },
      { id: "step-3", status: "pending" }
    ]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  updateStepsStatus(planPath, [
    { stepId: "step-1", status: "complete" },
    { stepId: "step-3", status: "blocked", extras: { blocked_reason: "Error" } }
  ]);

  const plan = loadPlan(planPath);
  assert.equal(plan.steps[0].status, "complete");
  assert.equal(plan.steps[1].status, "pending");
  assert.equal(plan.steps[2].status, "blocked");
  assert.equal(plan.steps[2].blocked_reason, "Error");
});

test("updateStepsStatus removes fields with null value", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const planContent = createMinimalPlan({
    steps: [{ id: "step-1", status: "blocked", blocked_reason: "Error" }]
  });
  const planPath = writeTempPlan(tempDir, "test.yaml", planContent);

  updateStepsStatus(planPath, [
    { stepId: "step-1", status: "pending", extras: { blocked_reason: null } }
  ]);

  const plan = loadPlan(planPath);
  assert.equal(plan.steps[0].status, "pending");
  assert.equal(plan.steps[0].blocked_reason, undefined);
});

// ============================================================================
// getPlanFiles tests
// ============================================================================

test("getPlanFiles returns yaml files from directory", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(tempDir, "plan-a.yaml"), "metadata: {}");
  fs.writeFileSync(path.join(tempDir, "plan-b.yml"), "metadata: {}");
  fs.writeFileSync(path.join(tempDir, "other.txt"), "not a plan");

  const files = getPlanFiles(tempDir);

  assert.equal(files.length, 2);
  assert.ok(files[0].endsWith("plan-a.yaml"));
  assert.ok(files[1].endsWith("plan-b.yml"));
});

test("getPlanFiles returns sorted files", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(tempDir, "z-plan.yaml"), "metadata: {}");
  fs.writeFileSync(path.join(tempDir, "a-plan.yaml"), "metadata: {}");
  fs.writeFileSync(path.join(tempDir, "m-plan.yaml"), "metadata: {}");

  const files = getPlanFiles(tempDir);

  assert.ok(files[0].endsWith("a-plan.yaml"));
  assert.ok(files[1].endsWith("m-plan.yaml"));
  assert.ok(files[2].endsWith("z-plan.yaml"));
});

test("getPlanFiles returns empty array for non-existent directory", () => {
  const files = getPlanFiles("/non/existent/path");
  assert.deepEqual(files, []);
});

test("getPlanFiles returns empty array for empty directory", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  const files = getPlanFiles(tempDir);
  assert.deepEqual(files, []);
});

// ============================================================================
// movePlanToCompleted tests
// ============================================================================

test("movePlanToCompleted moves file to destination", (t) => {
  const tempDir = createTempDir("plan-loader-");
  const completedDir = path.join(tempDir, "completed");
  t.after(() => cleanupDir(tempDir));

  const planPath = path.join(tempDir, "test-plan.yaml");
  fs.writeFileSync(planPath, "metadata: {}");

  const destPath = movePlanToCompleted(planPath, completedDir);

  assert.ok(!fs.existsSync(planPath));
  assert.ok(fs.existsSync(destPath));
  assert.equal(path.basename(destPath), "test-plan.yaml");
});

test("movePlanToCompleted creates completed directory if not exists", (t) => {
  const tempDir = createTempDir("plan-loader-");
  const completedDir = path.join(tempDir, "completed");
  t.after(() => cleanupDir(tempDir));

  const planPath = path.join(tempDir, "test.yaml");
  fs.writeFileSync(planPath, "metadata: {}");

  assert.ok(!fs.existsSync(completedDir));
  movePlanToCompleted(planPath, completedDir);
  assert.ok(fs.existsSync(completedDir));
});

// ============================================================================
// getCompletedPlanNames tests
// ============================================================================

test("getCompletedPlanNames returns set of yaml filenames", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(tempDir, "plan-a.yaml"), "");
  fs.writeFileSync(path.join(tempDir, "plan-b.yml"), "");

  const names = getCompletedPlanNames(tempDir);

  assert.ok(names instanceof Set);
  assert.equal(names.size, 2);
  assert.ok(names.has("plan-a.yaml"));
  assert.ok(names.has("plan-b.yml"));
});

test("getCompletedPlanNames returns empty set for non-existent directory", () => {
  const names = getCompletedPlanNames("/non/existent/path");
  assert.ok(names instanceof Set);
  assert.equal(names.size, 0);
});

test("getCompletedPlanNames excludes non-yaml files", (t) => {
  const tempDir = createTempDir("plan-loader-");
  t.after(() => cleanupDir(tempDir));

  fs.writeFileSync(path.join(tempDir, "plan.yaml"), "");
  fs.writeFileSync(path.join(tempDir, "readme.txt"), "");
  fs.writeFileSync(path.join(tempDir, "data.json"), "");

  const names = getCompletedPlanNames(tempDir);

  assert.equal(names.size, 1);
  assert.ok(names.has("plan.yaml"));
});
