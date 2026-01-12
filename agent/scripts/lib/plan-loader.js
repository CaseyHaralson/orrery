#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

/**
 * Load a plan from a YAML file
 * @param {string} filePath - Absolute path to the plan YAML file
 * @returns {Object} - Parsed plan object with helper methods
 */
function loadPlan(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const data = yaml.load(content);

  return {
    filePath,
    fileName: path.basename(filePath),
    metadata: data.metadata || {},
    steps: data.steps || [],

    /**
     * Get set of completed step IDs
     * @returns {Set<string>}
     */
    getCompletedSteps() {
      return new Set(
        this.steps.filter((s) => s.status === "complete").map((s) => s.id)
      );
    },

    /**
     * Get set of blocked step IDs
     * @returns {Set<string>}
     */
    getBlockedSteps() {
      return new Set(
        this.steps.filter((s) => s.status === "blocked").map((s) => s.id)
      );
    },

    /**
     * Check if all steps are complete or blocked
     * @returns {boolean}
     */
    isComplete() {
      return this.steps.every(
        (s) => s.status === "complete" || s.status === "blocked"
      );
    },

    /**
     * Check if all steps are complete (none blocked)
     * @returns {boolean}
     */
    isSuccessful() {
      return this.steps.every((s) => s.status === "complete");
    },
  };
}

/**
 * Save a plan back to its YAML file
 * @param {Object} plan - The plan object (with filePath, metadata, steps)
 */
function savePlan(plan) {
  const data = {
    metadata: plan.metadata,
    steps: plan.steps,
  };

  const content = yaml.dump(data, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    noRefs: true,
  });

  fs.writeFileSync(plan.filePath, content, "utf8");
}

/**
 * Update a specific step's status in a plan file
 * @param {string} filePath - Path to the plan file
 * @param {string} stepId - ID of the step to update
 * @param {string} status - New status value (pending, in_progress, complete, blocked)
 * @param {Object} [extras] - Optional extra fields to update (e.g., blockedReason)
 */
function updateStepStatus(filePath, stepId, status, extras = {}) {
  const plan = loadPlan(filePath);
  const step = plan.steps.find((s) => s.id === stepId);

  if (step) {
    step.status = status;
    Object.assign(step, extras);
    savePlan(plan);
  }
}

/**
 * Update multiple steps' status at once
 * @param {string} filePath - Path to the plan file
 * @param {Array<{stepId: string, status: string, extras?: Object}>} updates - Array of updates
 */
function updateStepsStatus(filePath, updates) {
  const plan = loadPlan(filePath);

  for (const { stepId, status, extras = {} } of updates) {
    const step = plan.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = status;
      Object.assign(step, extras);
    }
  }

  savePlan(plan);
}

/**
 * Get all YAML plan files in a directory
 * @param {string} dir - Directory to scan
 * @returns {string[]} - Array of absolute file paths, sorted by name
 */
function getPlanFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f))
    .sort();
}

/**
 * Move a completed plan to the completed directory
 * @param {string} planFile - Current path of the plan
 * @param {string} completedDir - Destination directory
 */
function movePlanToCompleted(planFile, completedDir) {
  const fileName = path.basename(planFile);
  const destPath = path.join(completedDir, fileName);

  if (!fs.existsSync(completedDir)) {
    fs.mkdirSync(completedDir, { recursive: true });
  }

  fs.renameSync(planFile, destPath);
  return destPath;
}

/**
 * Get filenames of completed plans (for exclusion filtering)
 * @param {string} completedDir - Path to completed directory
 * @returns {Set<string>} - Set of filenames
 */
function getCompletedPlanNames(completedDir) {
  if (!fs.existsSync(completedDir)) return new Set();

  return new Set(
    fs.readdirSync(completedDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
  );
}

module.exports = {
  loadPlan,
  savePlan,
  updateStepStatus,
  updateStepsStatus,
  getPlanFiles,
  movePlanToCompleted,
  getCompletedPlanNames,
};
