#!/usr/bin/env node

/**
 * Dependency resolution utilities for plan step execution ordering.
 * Uses Kahn's algorithm for topological sorting.
 */

/**
 * Check if setA is a subset of setB
 * @param {Set} setA - Set to check
 * @param {Set} setB - Set to check against
 * @returns {boolean}
 */
function isSubset(setA, setB) {
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

/**
 * Find the implicit barrier (preceding serial step) for a given step.
 * Serial steps create implicit barriers for subsequent steps to ensure
 * plan order is respected even without explicit dependencies.
 * @param {Object} plan - The plan object
 * @param {Object} step - The step to check
 * @returns {string|null} - ID of the barrier step, or null if none
 */
function getImplicitBarrier(plan, step) {
  const stepIndex = plan.steps.findIndex((s) => s.id === step.id);
  if (stepIndex <= 0) return null;

  const stepDeps = new Set(step.deps || []);

  // Look backwards for the most recent serial step
  for (let i = stepIndex - 1; i >= 0; i--) {
    const priorStep = plan.steps[i];
    if (priorStep.parallel !== true) {
      // This is a serial step - check if it's a barrier for us
      const priorDeps = new Set(priorStep.deps || []);

      // If prior step has no deps, or its deps are a subset of our deps,
      // it's an implicit barrier we must wait for
      if (priorDeps.size === 0 || isSubset(priorDeps, stepDeps)) {
        return priorStep.id;
      }
    }
  }
  return null;
}

/**
 * Get steps that are ready to execute (pending with all deps satisfied
 * and implicit barriers started)
 * @param {Object} plan - The plan object
 * @returns {Array} - Array of step objects ready to execute
 */
function getReadySteps(plan) {
  const completed = plan.getCompletedSteps();
  const started = plan.getStartedSteps();

  return plan.steps.filter((step) => {
    // Must be pending
    if (step.status !== "pending") return false;

    // All explicit dependencies must be complete
    const deps = step.deps || [];
    if (!deps.every((depId) => completed.has(depId))) return false;

    // Check implicit barrier - preceding serial steps must have started
    const barrier = getImplicitBarrier(plan, step);
    if (barrier && !started.has(barrier)) return false;

    return true;
  });
}

/**
 * Group steps for parallel execution based on dependency levels.
 * Uses Kahn's algorithm to find execution groups.
 * @param {Array} steps - Array of step objects (with id, deps, parallel fields)
 * @returns {Array<Array>} - Array of step groups, each group can run in parallel
 */
function resolveExecutionGroups(steps) {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const remaining = new Set(steps.map((s) => s.id));
  const groups = [];

  while (remaining.size > 0) {
    // Find all steps with no remaining dependencies
    const ready = [...remaining].filter((id) => {
      const step = stepMap.get(id);
      const deps = step.deps || [];
      return deps.every((dep) => !remaining.has(dep));
    });

    if (ready.length === 0 && remaining.size > 0) {
      const cycleSteps = [...remaining].join(", ");
      throw new Error(
        `Circular dependency detected among steps: ${cycleSteps}`
      );
    }

    // Separate parallel and serial steps
    const parallelSteps = ready
      .filter((id) => stepMap.get(id).parallel === true)
      .map((id) => stepMap.get(id));

    const serialSteps = ready
      .filter((id) => stepMap.get(id).parallel !== true)
      .map((id) => stepMap.get(id));

    // Add parallel steps as a single group (can run together)
    if (parallelSteps.length > 0) {
      groups.push(parallelSteps);
    }

    // Add serial steps as individual groups (run one at a time)
    for (const step of serialSteps) {
      groups.push([step]);
    }

    // Remove processed steps from remaining
    for (const id of ready) {
      remaining.delete(id);
    }
  }

  return groups;
}

/**
 * Check if a plan has any circular dependencies
 * @param {Object} plan - The plan object
 * @returns {{hasCycle: boolean, cycleSteps?: string[]}} - Result with cycle info
 */
function detectCycles(plan) {
  try {
    resolveExecutionGroups(plan.steps);
    return { hasCycle: false };
  } catch (error) {
    if (error.message.includes("Circular dependency")) {
      // Extract step IDs from error message
      const match = error.message.match(/steps: (.+)$/);
      const cycleSteps = match ? match[1].split(", ") : [];
      return { hasCycle: true, cycleSteps };
    }
    throw error;
  }
}

/**
 * Get steps that are blocked due to a specific step being blocked
 * (i.e., steps that depend on the blocked step directly or transitively)
 * @param {Object} plan - The plan object
 * @param {string} blockedStepId - ID of the blocked step
 * @returns {string[]} - Array of step IDs that are blocked as a result
 */
function getBlockedDependents(plan, blockedStepId) {
  const dependents = new Set();

  function findDependents(stepId) {
    for (const step of plan.steps) {
      const deps = step.deps || [];
      if (deps.includes(stepId) && !dependents.has(step.id)) {
        dependents.add(step.id);
        findDependents(step.id);
      }
    }
  }

  findDependents(blockedStepId);
  return [...dependents];
}

/**
 * Partition ready steps into groups respecting maxParallel limit and plan order.
 * Steps are processed in plan order:
 * - If the first ready step is parallel, collect consecutive parallel steps
 * - If the first ready step is serial, take just that one
 * This ensures serial steps act as barriers and plan order is respected.
 * @param {Array} readySteps - Steps ready to execute (in plan order)
 * @param {number} maxParallel - Maximum concurrent steps
 * @param {number} currentlyRunning - Number of steps currently in progress
 * @returns {{parallel: Array, serial: Array}} - Steps grouped by execution type
 */
function partitionSteps(readySteps, maxParallel, currentlyRunning = 0) {
  const availableSlots = Math.max(0, maxParallel - currentlyRunning);
  if (availableSlots === 0 || readySteps.length === 0) {
    return { parallel: [], serial: [] };
  }

  // Process in plan order - take first step(s)
  const firstStep = readySteps[0];

  if (firstStep.parallel === true) {
    // Collect consecutive parallel steps (up to availableSlots)
    const parallelBatch = [];
    for (const step of readySteps) {
      if (step.parallel !== true) break;
      if (parallelBatch.length >= availableSlots) break;
      parallelBatch.push(step);
    }
    return { parallel: parallelBatch, serial: [] };
  } else {
    // Serial step - take just this one
    return { parallel: [], serial: [firstStep] };
  }
}

module.exports = {
  getReadySteps,
  resolveExecutionGroups,
  detectCycles,
  getBlockedDependents,
  partitionSteps,
  getImplicitBarrier,
  isSubset
};
