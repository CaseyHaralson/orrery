const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const YAML = require("yaml");

const {
  getCompletedDependencies,
  generateCondensedPlan,
  writeCondensedPlan,
  deleteCondensedPlan,
} = require("../../lib/orchestration/condensed-plan");
const { createMockPlan, createTempDir, cleanupDir, captureConsole } = require("../helpers/test-utils");

// ============================================================================
// getCompletedDependencies tests
// ============================================================================

test("getCompletedDependencies returns direct completed deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "complete" },
    { id: "step-3", status: "pending", deps: ["step-1", "step-2"] },
  ]);

  const deps = getCompletedDependencies(plan, ["step-3"]);

  assert.equal(deps.length, 2);
  assert.ok(deps.some((d) => d.id === "step-1"));
  assert.ok(deps.some((d) => d.id === "step-2"));
});

test("getCompletedDependencies returns transitive completed deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "complete", deps: ["step-1"] },
    { id: "step-3", status: "pending", deps: ["step-2"] },
  ]);

  const deps = getCompletedDependencies(plan, ["step-3"]);

  assert.equal(deps.length, 2);
  assert.ok(deps.some((d) => d.id === "step-1"));
  assert.ok(deps.some((d) => d.id === "step-2"));
});

test("getCompletedDependencies excludes non-complete deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending" },
    { id: "step-3", status: "pending", deps: ["step-1", "step-2"] },
  ]);

  const deps = getCompletedDependencies(plan, ["step-3"]);

  assert.equal(deps.length, 1);
  assert.equal(deps[0].id, "step-1");
});

test("getCompletedDependencies handles step with no deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending" },
  ]);

  const deps = getCompletedDependencies(plan, ["step-1"]);
  assert.deepEqual(deps, []);
});

test("getCompletedDependencies handles multiple step IDs", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "complete" },
    { id: "step-3", status: "pending", deps: ["step-1"] },
    { id: "step-4", status: "pending", deps: ["step-2"] },
  ]);

  const deps = getCompletedDependencies(plan, ["step-3", "step-4"]);

  assert.equal(deps.length, 2);
  assert.ok(deps.some((d) => d.id === "step-1"));
  assert.ok(deps.some((d) => d.id === "step-2"));
});

test("getCompletedDependencies deduplicates shared deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending", deps: ["step-1"] },
    { id: "step-3", status: "pending", deps: ["step-1"] },
  ]);

  const deps = getCompletedDependencies(plan, ["step-2", "step-3"]);

  assert.equal(deps.length, 1);
  assert.equal(deps[0].id, "step-1");
});

// ============================================================================
// generateCondensedPlan tests
// ============================================================================

test("generateCondensedPlan includes assigned steps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending" },
    { id: "step-2", status: "pending" },
    { id: "step-3", status: "pending" },
  ]);

  const condensed = generateCondensedPlan(plan, ["step-2"]);

  assert.equal(condensed.steps.length, 1);
  assert.equal(condensed.steps[0].id, "step-2");
});

test("generateCondensedPlan includes completed dependencies", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending", deps: ["step-1"] },
  ]);

  const condensed = generateCondensedPlan(plan, ["step-2"]);

  assert.equal(condensed.steps.length, 2);
  assert.ok(condensed.steps.some((s) => s.id === "step-1"));
  assert.ok(condensed.steps.some((s) => s.id === "step-2"));
});

test("generateCondensedPlan adds condensed metadata", () => {
  const plan = createMockPlan(
    [{ id: "step-1", status: "pending" }],
    { name: "original-plan" }
  );

  const condensed = generateCondensedPlan(plan, ["step-1"]);

  assert.equal(condensed.metadata.condensed, true);
  assert.equal(condensed.metadata.source_plan, plan.filePath);
  assert.ok(condensed.metadata.condensed_at);
  assert.deepEqual(condensed.metadata.assigned_steps, ["step-1"]);
  assert.equal(condensed.metadata.name, "original-plan");
});

test("generateCondensedPlan sorts steps by id", () => {
  const plan = createMockPlan([
    { id: "step-10", status: "complete" },
    { id: "step-2", status: "complete" },
    { id: "step-5", status: "pending", deps: ["step-2", "step-10"] },
  ]);

  const condensed = generateCondensedPlan(plan, ["step-5"]);

  // With numeric sorting: step-2, step-5, step-10
  assert.equal(condensed.steps[0].id, "step-2");
  assert.equal(condensed.steps[1].id, "step-5");
  assert.equal(condensed.steps[2].id, "step-10");
});

// ============================================================================
// writeCondensedPlan tests
// ============================================================================

test("writeCondensedPlan writes YAML file to temp dir", (t) => {
  // Set up temp work dir through env
  const tempDir = createTempDir("condensed-plan-");
  const workDir = path.join(tempDir, ".agent-work");
  const originalEnv = process.env.ORRERY_WORK_DIR;
  process.env.ORRERY_WORK_DIR = workDir;
  t.after(() => {
    process.env.ORRERY_WORK_DIR = originalEnv;
    cleanupDir(tempDir);
  });

  const condensedPlan = {
    metadata: { name: "test" },
    steps: [{ id: "step-1" }],
  };

  const filePath = writeCondensedPlan(condensedPlan, "/original/plan.yaml", ["step-1"]);

  assert.ok(fs.existsSync(filePath));
  assert.ok(filePath.includes("plan-step-1"));
  assert.ok(filePath.endsWith(".yaml"));

  const content = fs.readFileSync(filePath, "utf8");
  const parsed = YAML.parse(content);
  assert.equal(parsed.metadata.name, "test");
});

test("writeCondensedPlan handles multiple step IDs in filename", (t) => {
  const tempDir = createTempDir("condensed-plan-");
  const workDir = path.join(tempDir, ".agent-work");
  const originalEnv = process.env.ORRERY_WORK_DIR;
  process.env.ORRERY_WORK_DIR = workDir;
  t.after(() => {
    process.env.ORRERY_WORK_DIR = originalEnv;
    cleanupDir(tempDir);
  });

  const condensedPlan = {
    metadata: {},
    steps: [],
  };

  const filePath = writeCondensedPlan(condensedPlan, "/original/test.yaml", ["step-1", "step-2"]);

  assert.ok(filePath.includes("step-1-step-2"));
});

// ============================================================================
// deleteCondensedPlan tests
// ============================================================================

test("deleteCondensedPlan removes existing file", (t) => {
  const tempDir = createTempDir("condensed-plan-");
  t.after(() => cleanupDir(tempDir));

  const filePath = path.join(tempDir, "test.yaml");
  fs.writeFileSync(filePath, "test");
  assert.ok(fs.existsSync(filePath));

  deleteCondensedPlan(filePath);

  assert.ok(!fs.existsSync(filePath));
});

test("deleteCondensedPlan handles non-existent file gracefully", () => {
  // Should not throw
  deleteCondensedPlan("/non/existent/file.yaml");
});

test("deleteCondensedPlan warns on permission error", async (t) => {
  const tempDir = createTempDir("condensed-plan-");
  t.after(() => cleanupDir(tempDir));

  // Create a directory (can't unlink a directory, will cause an error)
  const dirPath = path.join(tempDir, "dir");
  fs.mkdirSync(dirPath);

  const { stderr } = await captureConsole(() => {
    deleteCondensedPlan(dirPath);
  });

  assert.ok(stderr.some((line) => line.includes("Warning")));
});
