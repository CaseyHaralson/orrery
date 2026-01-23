/**
 * Shared test utilities for Orrery tests
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const YAML = require("yaml");

/**
 * Create a temporary directory with optional prefix
 * @param {string} prefix - Prefix for the temp directory name
 * @returns {string} - Absolute path to the created directory
 */
function createTempDir(prefix = "orrery-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Clean up a directory and all its contents
 * @param {string} dirPath - Path to the directory to remove
 */
function cleanupDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/**
 * Initialize a temporary git repository
 * @returns {string} - Path to the git repository
 */
function initTempGitRepo() {
  const gitDir = createTempDir("orrery-git-");
  execFileSync("git", ["init"], { cwd: gitDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Orrery Test"], {
    cwd: gitDir,
    stdio: "ignore"
  });
  execFileSync("git", ["config", "user.email", "orrery@example.com"], {
    cwd: gitDir,
    stdio: "ignore"
  });
  fs.writeFileSync(path.join(gitDir, "README.md"), "test\n");
  execFileSync("git", ["add", "."], { cwd: gitDir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], {
    cwd: gitDir,
    stdio: "ignore"
  });
  return gitDir;
}

/**
 * Create a mock plan object with helper methods (mimics loadPlan output)
 * @param {Array} steps - Array of step objects
 * @param {Object} metadata - Plan metadata
 * @returns {Object} - Mock plan object with helper methods
 */
function createMockPlan(steps = [], metadata = {}) {
  return {
    filePath: "/mock/plan.yaml",
    fileName: "plan.yaml",
    metadata,
    steps,

    getCompletedSteps() {
      return new Set(
        this.steps.filter((s) => s.status === "complete").map((s) => s.id)
      );
    },

    getBlockedSteps() {
      return new Set(
        this.steps.filter((s) => s.status === "blocked").map((s) => s.id)
      );
    },

    isComplete() {
      return this.steps.every(
        (s) => s.status === "complete" || s.status === "blocked"
      );
    },

    isSuccessful() {
      return this.steps.every((s) => s.status === "complete");
    }
  };
}

/**
 * Write a YAML plan file to a temp directory
 * @param {string} dir - Directory to write to
 * @param {string} fileName - Name of the file
 * @param {Object} content - Plan content object
 * @returns {string} - Absolute path to the written file
 */
function writeTempPlan(dir, fileName, content) {
  const filePath = path.join(dir, fileName);
  const yamlContent = YAML.stringify(content);
  fs.writeFileSync(filePath, yamlContent, "utf8");
  return filePath;
}

/**
 * Create a minimal valid plan object
 * @param {Object} overrides - Properties to override
 * @returns {Object} - Plan object
 */
function createMinimalPlan(overrides = {}) {
  return {
    metadata: {
      name: "test-plan",
      ...overrides.metadata
    },
    steps: overrides.steps || [
      { id: "step-1", description: "First step", status: "pending" }
    ]
  };
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Capture console output during a function execution
 * @param {Function} fn - Function to execute
 * @returns {Object} - Object with stdout, stderr arrays and result
 */
async function captureConsole(fn) {
  const stdout = [];
  const stderr = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  console.log = (...args) => stdout.push(args.join(" "));
  console.warn = (...args) => stderr.push(args.join(" "));
  console.error = (...args) => stderr.push(args.join(" "));
  console.debug = (...args) => stdout.push(args.join(" "));

  try {
    const result = await fn();
    return { stdout, stderr, result };
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    console.debug = originalDebug;
  }
}

module.exports = {
  createTempDir,
  cleanupDir,
  initTempGitRepo,
  createMockPlan,
  writeTempPlan,
  createMinimalPlan,
  sleep,
  captureConsole
};
