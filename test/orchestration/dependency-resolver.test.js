const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getReadySteps,
  resolveExecutionGroups,
  detectCycles,
  getBlockedDependents,
  partitionSteps
} = require("../../lib/orchestration/dependency-resolver");
const { createMockPlan } = require("../helpers/test-utils");

// ============================================================================
// getReadySteps tests
// ============================================================================

test("getReadySteps returns pending steps with no dependencies", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending" },
    { id: "step-2", status: "pending" }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 2);
  assert.deepEqual(
    ready.map((s) => s.id),
    ["step-1", "step-2"]
  );
});

test("getReadySteps excludes non-pending steps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "in_progress" },
    { id: "step-3", status: "blocked" },
    { id: "step-4", status: "pending" }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-4");
});

test("getReadySteps returns steps with all deps complete", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending", deps: ["step-1"] },
    { id: "step-3", status: "pending", deps: ["step-1"] }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 2);
  assert.deepEqual(ready.map((s) => s.id).sort(), ["step-2", "step-3"]);
});

test("getReadySteps excludes steps with incomplete deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending" },
    { id: "step-2", status: "pending", deps: ["step-1"] }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-1");
});

test("getReadySteps excludes steps with blocked deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "blocked" },
    { id: "step-2", status: "pending", deps: ["step-1"] }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 0);
});

test("getReadySteps excludes steps with in_progress deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "in_progress" },
    { id: "step-2", status: "pending", deps: ["step-1"] }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 0);
});

test("getReadySteps handles steps with multiple deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "complete" },
    { id: "step-3", status: "pending", deps: ["step-1", "step-2"] }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-3");
});

test("getReadySteps returns empty for steps with partial deps complete", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending" },
    { id: "step-3", status: "pending", deps: ["step-1", "step-2"] }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-2");
});

// ============================================================================
// resolveExecutionGroups tests
// ============================================================================

test("resolveExecutionGroups returns single group for independent steps", () => {
  const steps = [{ id: "step-1" }, { id: "step-2" }, { id: "step-3" }];

  const groups = resolveExecutionGroups(steps);
  // All are serial by default (parallel !== true), so each is its own group
  assert.equal(groups.length, 3);
});

test("resolveExecutionGroups groups parallel steps together", () => {
  const steps = [
    { id: "step-1", parallel: true },
    { id: "step-2", parallel: true },
    { id: "step-3", parallel: true }
  ];

  const groups = resolveExecutionGroups(steps);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 3);
});

test("resolveExecutionGroups respects dependency ordering", () => {
  const steps = [
    { id: "step-1" },
    { id: "step-2", deps: ["step-1"] },
    { id: "step-3", deps: ["step-2"] }
  ];

  const groups = resolveExecutionGroups(steps);
  assert.equal(groups.length, 3);
  assert.equal(groups[0][0].id, "step-1");
  assert.equal(groups[1][0].id, "step-2");
  assert.equal(groups[2][0].id, "step-3");
});

test("resolveExecutionGroups handles diamond dependencies", () => {
  const steps = [
    { id: "step-1" },
    { id: "step-2", deps: ["step-1"], parallel: true },
    { id: "step-3", deps: ["step-1"], parallel: true },
    { id: "step-4", deps: ["step-2", "step-3"] }
  ];

  const groups = resolveExecutionGroups(steps);
  assert.equal(groups.length, 3);
  assert.equal(groups[0][0].id, "step-1");
  assert.equal(groups[1].length, 2); // step-2 and step-3 in parallel
  assert.equal(groups[2][0].id, "step-4");
});

test("resolveExecutionGroups throws on circular dependency", () => {
  const steps = [
    { id: "step-1", deps: ["step-2"] },
    { id: "step-2", deps: ["step-1"] }
  ];

  assert.throws(
    () => resolveExecutionGroups(steps),
    /Circular dependency detected/
  );
});

test("resolveExecutionGroups handles self-referencing dependency", () => {
  const steps = [{ id: "step-1", deps: ["step-1"] }];

  assert.throws(
    () => resolveExecutionGroups(steps),
    /Circular dependency detected/
  );
});

test("resolveExecutionGroups handles empty step list", () => {
  const groups = resolveExecutionGroups([]);
  assert.deepEqual(groups, []);
});

test("resolveExecutionGroups handles mixed parallel and serial at same level", () => {
  const steps = [
    { id: "step-1", parallel: true },
    { id: "step-2", parallel: true },
    { id: "step-3", parallel: false }
  ];

  const groups = resolveExecutionGroups(steps);
  // First group: parallel steps together
  // Then: serial step alone
  assert.equal(groups.length, 2);
  assert.equal(groups[0].length, 2);
  assert.equal(groups[1].length, 1);
});

// ============================================================================
// detectCycles tests
// ============================================================================

test("detectCycles returns hasCycle false for valid plan", () => {
  const plan = createMockPlan([
    { id: "step-1" },
    { id: "step-2", deps: ["step-1"] }
  ]);

  const result = detectCycles(plan);
  assert.equal(result.hasCycle, false);
  assert.equal(result.cycleSteps, undefined);
});

test("detectCycles returns hasCycle true for circular dependency", () => {
  const plan = createMockPlan([
    { id: "step-1", deps: ["step-3"] },
    { id: "step-2", deps: ["step-1"] },
    { id: "step-3", deps: ["step-2"] }
  ]);

  const result = detectCycles(plan);
  assert.equal(result.hasCycle, true);
  assert.ok(Array.isArray(result.cycleSteps));
  assert.ok(result.cycleSteps.length > 0);
});

test("detectCycles handles empty plan", () => {
  const plan = createMockPlan([]);

  const result = detectCycles(plan);
  assert.equal(result.hasCycle, false);
});

// ============================================================================
// getBlockedDependents tests
// ============================================================================

test("getBlockedDependents returns direct dependents", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "blocked" },
    { id: "step-2", deps: ["step-1"] },
    { id: "step-3", deps: ["step-1"] }
  ]);

  const dependents = getBlockedDependents(plan, "step-1");
  assert.deepEqual(dependents.sort(), ["step-2", "step-3"]);
});

test("getBlockedDependents returns transitive dependents", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "blocked" },
    { id: "step-2", deps: ["step-1"] },
    { id: "step-3", deps: ["step-2"] },
    { id: "step-4", deps: ["step-3"] }
  ]);

  const dependents = getBlockedDependents(plan, "step-1");
  assert.deepEqual(dependents.sort(), ["step-2", "step-3", "step-4"]);
});

test("getBlockedDependents returns empty for step with no dependents", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "blocked" },
    { id: "step-2" }
  ]);

  const dependents = getBlockedDependents(plan, "step-1");
  assert.deepEqual(dependents, []);
});

test("getBlockedDependents handles diamond dependency pattern", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "blocked" },
    { id: "step-2", deps: ["step-1"] },
    { id: "step-3", deps: ["step-1"] },
    { id: "step-4", deps: ["step-2", "step-3"] }
  ]);

  const dependents = getBlockedDependents(plan, "step-1");
  assert.equal(dependents.length, 3);
  assert.ok(dependents.includes("step-2"));
  assert.ok(dependents.includes("step-3"));
  assert.ok(dependents.includes("step-4"));
});

// ============================================================================
// partitionSteps tests
// ============================================================================

test("partitionSteps separates parallel and serial steps", () => {
  const readySteps = [
    { id: "step-1", parallel: true },
    { id: "step-2", parallel: true },
    { id: "step-3", parallel: false }
  ];

  const result = partitionSteps(readySteps, 10);
  assert.equal(result.parallel.length, 2);
  assert.equal(result.serial.length, 1);
});

test("partitionSteps respects maxParallel limit", () => {
  const readySteps = [
    { id: "step-1", parallel: true },
    { id: "step-2", parallel: true },
    { id: "step-3", parallel: true },
    { id: "step-4", parallel: true }
  ];

  const result = partitionSteps(readySteps, 2);
  assert.equal(result.parallel.length, 2);
  assert.equal(result.serial.length, 0);
});

test("partitionSteps accounts for currently running steps", () => {
  const readySteps = [
    { id: "step-1", parallel: true },
    { id: "step-2", parallel: true }
  ];

  const result = partitionSteps(readySteps, 3, 2);
  // Only 1 slot available (3 - 2)
  assert.equal(result.parallel.length, 1);
});

test("partitionSteps returns empty when no slots available", () => {
  const readySteps = [{ id: "step-1", parallel: true }, { id: "step-2" }];

  const result = partitionSteps(readySteps, 2, 2);
  assert.equal(result.parallel.length, 0);
  assert.equal(result.serial.length, 0);
});

test("partitionSteps fills serial slots after parallel", () => {
  const readySteps = [
    { id: "step-1", parallel: true },
    { id: "step-2" },
    { id: "step-3" }
  ];

  const result = partitionSteps(readySteps, 3);
  assert.equal(result.parallel.length, 1);
  assert.equal(result.serial.length, 2);
});

test("partitionSteps handles all serial steps", () => {
  const readySteps = [{ id: "step-1" }, { id: "step-2" }, { id: "step-3" }];

  const result = partitionSteps(readySteps, 2);
  assert.equal(result.parallel.length, 0);
  assert.equal(result.serial.length, 2);
});

test("partitionSteps handles empty ready steps", () => {
  const result = partitionSteps([], 5);
  assert.deepEqual(result, { parallel: [], serial: [] });
});
