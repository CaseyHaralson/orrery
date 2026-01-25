const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getReadySteps,
  resolveExecutionGroups,
  detectCycles,
  getBlockedDependents,
  partitionSteps,
  getImplicitBarrier,
  isSubset
} = require("../../lib/orchestration/dependency-resolver");
const { createMockPlan } = require("../helpers/test-utils");

// ============================================================================
// getReadySteps tests
// ============================================================================

test("getReadySteps returns first pending step with no dependencies", () => {
  // With implicit barriers, only step-1 is ready because step-2 is blocked
  // by the preceding serial step (step-1 with no deps acts as barrier)
  const plan = createMockPlan([
    { id: "step-1", status: "pending" },
    { id: "step-2", status: "pending" }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-1");
});

test("getReadySteps returns all parallel steps with no barriers", () => {
  // When all steps are parallel with no deps, all can be ready
  const plan = createMockPlan([
    { id: "step-1", status: "pending", parallel: true },
    { id: "step-2", status: "pending", parallel: true }
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

test("getReadySteps returns step with deps complete but respects barriers", () => {
  // step-1 is complete, step-2 and step-3 both depend on it
  // But step-3 is also blocked by implicit barrier from step-2 (serial step)
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending", deps: ["step-1"] },
    { id: "step-3", status: "pending", deps: ["step-1"] }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-2");
});

test("getReadySteps returns all parallel steps with deps complete", () => {
  // When steps are parallel, they can all be ready once deps are satisfied
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending", deps: ["step-1"], parallel: true },
    { id: "step-3", status: "pending", deps: ["step-1"], parallel: true }
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
// partitionSteps tests (respects plan order)
// ============================================================================

test("partitionSteps returns first serial step when it comes first", () => {
  const readySteps = [
    { id: "step-1", parallel: false },
    { id: "step-2", parallel: true },
    { id: "step-3", parallel: true }
  ];

  const result = partitionSteps(readySteps, 10);
  // Serial step first, so only return that one
  assert.equal(result.parallel.length, 0);
  assert.equal(result.serial.length, 1);
  assert.equal(result.serial[0].id, "step-1");
});

test("partitionSteps returns consecutive parallel steps when parallel comes first", () => {
  const readySteps = [
    { id: "step-1", parallel: true },
    { id: "step-2", parallel: true },
    { id: "step-3", parallel: false }
  ];

  const result = partitionSteps(readySteps, 10);
  // Parallel steps first, collect them until serial
  assert.equal(result.parallel.length, 2);
  assert.equal(result.serial.length, 0);
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

test("partitionSteps stops at serial step even with slots available", () => {
  const readySteps = [
    { id: "step-1", parallel: true },
    { id: "step-2", parallel: false },
    { id: "step-3", parallel: true }
  ];

  const result = partitionSteps(readySteps, 10);
  // Stops at step-2 because it's serial
  assert.equal(result.parallel.length, 1);
  assert.equal(result.parallel[0].id, "step-1");
  assert.equal(result.serial.length, 0);
});

test("partitionSteps returns only first serial step", () => {
  const readySteps = [{ id: "step-1" }, { id: "step-2" }, { id: "step-3" }];

  const result = partitionSteps(readySteps, 10);
  // All serial, so only return the first one
  assert.equal(result.parallel.length, 0);
  assert.equal(result.serial.length, 1);
  assert.equal(result.serial[0].id, "step-1");
});

test("partitionSteps handles empty ready steps", () => {
  const result = partitionSteps([], 5);
  assert.deepEqual(result, { parallel: [], serial: [] });
});

// ============================================================================
// isSubset tests
// ============================================================================

test("isSubset returns true for empty set", () => {
  assert.equal(isSubset(new Set(), new Set(["a", "b"])), true);
});

test("isSubset returns true when all elements present", () => {
  assert.equal(isSubset(new Set(["a"]), new Set(["a", "b"])), true);
});

test("isSubset returns false when element missing", () => {
  assert.equal(isSubset(new Set(["a", "c"]), new Set(["a", "b"])), false);
});

test("isSubset returns true for equal sets", () => {
  assert.equal(isSubset(new Set(["a", "b"]), new Set(["a", "b"])), true);
});

// ============================================================================
// getImplicitBarrier tests
// ============================================================================

test("getImplicitBarrier returns null for first step", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending" },
    { id: "step-2", status: "pending" }
  ]);

  const barrier = getImplicitBarrier(plan, plan.steps[0]);
  assert.equal(barrier, null);
});

test("getImplicitBarrier finds preceding serial step with no deps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending", parallel: false },
    { id: "step-2", status: "pending", parallel: true }
  ]);

  const barrier = getImplicitBarrier(plan, plan.steps[1]);
  assert.equal(barrier, "step-1");
});

test("getImplicitBarrier skips parallel steps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending", parallel: false },
    { id: "step-2", status: "pending", parallel: true },
    { id: "step-3", status: "pending", parallel: true }
  ]);

  // step-3 should find step-1 as barrier (skipping step-2 which is parallel)
  const barrier = getImplicitBarrier(plan, plan.steps[2]);
  assert.equal(barrier, "step-1");
});

test("getImplicitBarrier respects deps subset rule", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending", parallel: false, deps: ["step-1"] },
    { id: "step-3", status: "pending", parallel: true, deps: ["step-1"] }
  ]);

  // step-3 has same deps as step-2, so step-2 is a barrier
  const barrier = getImplicitBarrier(plan, plan.steps[2]);
  assert.equal(barrier, "step-2");
});

test("getImplicitBarrier returns null when no serial step precedes", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending", parallel: true },
    { id: "step-2", status: "pending", parallel: true }
  ]);

  const barrier = getImplicitBarrier(plan, plan.steps[1]);
  assert.equal(barrier, null);
});

// ============================================================================
// getReadySteps with implicit barriers tests
// ============================================================================

test("getReadySteps blocks step until implicit barrier has started", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending", parallel: false },
    { id: "step-2", status: "pending", parallel: true }
  ]);

  const ready = getReadySteps(plan);
  // Only step-1 should be ready; step-2 is blocked by implicit barrier
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-1");
});

test("getReadySteps allows step when implicit barrier has started", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "in_progress", parallel: false },
    { id: "step-2", status: "pending", parallel: true }
  ]);

  const ready = getReadySteps(plan);
  // step-1 is in_progress (started), so step-2 can proceed
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-2");
});

test("getReadySteps allows step when implicit barrier is complete", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete", parallel: false },
    { id: "step-2", status: "pending", parallel: true }
  ]);

  const ready = getReadySteps(plan);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-2");
});

test("getReadySteps respects both explicit deps and implicit barriers", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending", parallel: false, deps: ["step-1"] },
    { id: "step-3", status: "pending", parallel: true, deps: ["step-1"] }
  ]);

  const ready = getReadySteps(plan);
  // step-2 is ready (explicit dep complete)
  // step-3 has explicit dep complete but implicit barrier (step-2) not started
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "step-2");
});

test("getReadySteps serial step runs before parallel even when both ready", () => {
  // This tests the scenario from the bug report: step 0.1 (serial) should run
  // before step 0.2 (parallel) when both have no deps
  const plan = createMockPlan([
    { id: "0.1", status: "pending", parallel: false },
    { id: "0.2", status: "pending", parallel: true }
  ]);

  const ready = getReadySteps(plan);
  // Only 0.1 should be ready because 0.2 is blocked by implicit barrier
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, "0.1");
});

// ============================================================================
// getStartedSteps tests
// ============================================================================

test("getStartedSteps returns empty set for all pending", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "pending" },
    { id: "step-2", status: "pending" }
  ]);

  const started = plan.getStartedSteps();
  assert.equal(started.size, 0);
});

test("getStartedSteps includes in_progress steps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "in_progress" },
    { id: "step-2", status: "pending" }
  ]);

  const started = plan.getStartedSteps();
  assert.equal(started.size, 1);
  assert.ok(started.has("step-1"));
});

test("getStartedSteps includes complete steps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "complete" },
    { id: "step-2", status: "pending" }
  ]);

  const started = plan.getStartedSteps();
  assert.equal(started.size, 1);
  assert.ok(started.has("step-1"));
});

test("getStartedSteps includes blocked steps", () => {
  const plan = createMockPlan([
    { id: "step-1", status: "blocked" },
    { id: "step-2", status: "pending" }
  ]);

  const started = plan.getStartedSteps();
  assert.equal(started.size, 1);
  assert.ok(started.has("step-1"));
});
