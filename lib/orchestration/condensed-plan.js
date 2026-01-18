/**
 * Condensed Plan Generator
 *
 * Creates temporary condensed plans containing only the steps an agent needs,
 * reducing context usage for large plans.
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const { getTempDir } = require("../utils/paths");

/**
 * Get all completed dependencies for a set of step IDs (recursive)
 * @param {Object} plan - The loaded plan object
 * @param {string[]} stepIds - Step IDs to find dependencies for
 * @returns {Object[]} - Array of completed dependency steps
 */
function getCompletedDependencies(plan, stepIds) {
  const stepMap = new Map(plan.steps.map((s) => [s.id, s]));
  const collected = new Set();

  function collectDeps(stepId) {
    const step = stepMap.get(stepId);
    if (!step || !step.deps) return;

    for (const depId of step.deps) {
      if (collected.has(depId)) continue;

      const depStep = stepMap.get(depId);
      if (depStep && depStep.status === "complete") {
        collected.add(depId);
        collectDeps(depId);
      }
    }
  }

  for (const stepId of stepIds) {
    collectDeps(stepId);
  }

  return Array.from(collected)
    .map((id) => stepMap.get(id))
    .filter(Boolean);
}

/**
 * Generate a condensed plan containing only assigned steps and their completed dependencies
 * @param {Object} plan - The loaded plan object
 * @param {string[]} stepIds - Step IDs assigned to the agent
 * @returns {Object} - Condensed plan data (plain object, not a plan object)
 */
function generateCondensedPlan(plan, stepIds) {
  const stepSet = new Set(stepIds);
  const assignedSteps = plan.steps.filter((s) => stepSet.has(s.id));
  const completedDeps = getCompletedDependencies(plan, stepIds);

  // Build ordered steps: completed deps + assigned steps, sorted by ascending ID
  const depIds = new Set(completedDeps.map((s) => s.id));
  const orderedSteps = [
    ...completedDeps,
    ...assignedSteps.filter((s) => !depIds.has(s.id)),
  ].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

  // Copy metadata and add condensed indicators
  const condensedMetadata = {
    ...plan.metadata,
    condensed: true,
    source_plan: plan.filePath,
    condensed_at: new Date().toISOString(),
    assigned_steps: stepIds,
  };

  return {
    metadata: condensedMetadata,
    steps: orderedSteps,
  };
}

/**
 * Write a condensed plan to a temp file
 * @param {Object} condensedPlan - The condensed plan data
 * @param {string} originalPlanPath - Path to the original plan file
 * @param {string[]} stepIds - Step IDs for filename generation
 * @returns {string} - Path to the written temp file
 */
function writeCondensedPlan(condensedPlan, originalPlanPath, stepIds) {
  const tempDir = getTempDir();
  const baseName = path.basename(originalPlanPath, path.extname(originalPlanPath));
  const stepSuffix = stepIds.join("-").replace(/[^a-zA-Z0-9.-]/g, "_");
  const timestamp = Date.now();
  const fileName = `${baseName}-${stepSuffix}-${timestamp}.yaml`;
  const filePath = path.join(tempDir, fileName);

  const content = YAML.stringify(condensedPlan);
  fs.writeFileSync(filePath, content, "utf8");

  return filePath;
}

/**
 * Delete a condensed plan temp file
 * @param {string} tempPlanPath - Path to the temp plan file
 */
function deleteCondensedPlan(tempPlanPath) {
  try {
    if (fs.existsSync(tempPlanPath)) {
      fs.unlinkSync(tempPlanPath);
    }
  } catch (err) {
    console.warn(`Warning: Failed to delete temp plan ${tempPlanPath}: ${err.message}`);
  }
}

module.exports = {
  generateCondensedPlan,
  getCompletedDependencies,
  writeCondensedPlan,
  deleteCondensedPlan,
};
