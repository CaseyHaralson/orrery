#!/usr/bin/env node

/**
 * Dependency resolution utilities for plan step execution ordering.
 * Uses Kahn's algorithm for topological sorting.
 */

/**
 * Get steps that are ready to execute (pending with all deps satisfied)
 * @param {Object} plan - The plan object
 * @returns {Array} - Array of step objects ready to execute
 */
function getReadySteps(plan) {
  const completed = plan.getCompletedSteps();
  const blocked = plan.getBlockedSteps();

  return plan.steps.filter((step) => {
    // Must be pending
    if (step.status !== "pending") return false;

    // All dependencies must be complete (not pending, not blocked, not in_progress)
    const deps = step.deps || [];
    return deps.every((depId) => completed.has(depId));
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
      throw new Error(`Circular dependency detected among steps: ${cycleSteps}`);
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
 * Partition ready steps into groups respecting maxParallel limit
 * @param {Array} readySteps - Steps ready to execute
 * @param {number} maxParallel - Maximum concurrent steps
 * @param {number} currentlyRunning - Number of steps currently in progress
 * @returns {{parallel: Array, serial: Array}} - Steps grouped by execution type
 */
function partitionSteps(readySteps, maxParallel, currentlyRunning = 0) {
  const availableSlots = Math.max(0, maxParallel - currentlyRunning);

  const parallel = readySteps.filter((s) => s.parallel === true);
  const serial = readySteps.filter((s) => s.parallel !== true);

  return {
    parallel: parallel.slice(0, availableSlots),
    serial: serial.slice(0, Math.max(0, availableSlots - parallel.length)),
  };
}

module.exports = {
  getReadySteps,
  resolveExecutionGroups,
  detectCycles,
  getBlockedDependents,
  partitionSteps,
};
