/**
 * Integration test sandbox utilities.
 *
 * Creates isolated target repos, runs orrery as a subprocess,
 * and provides assertion helpers for plan outcomes.
 */

const { execFile, execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const YAML = require("yaml");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const BIN_PATH = path.join(REPO_ROOT, "bin", "orrery.js");
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "target-repo");

// ─── Sandbox lifecycle ───────────────────────────────────────────────

/**
 * Create a fresh sandbox: temp dir with target repo copy, git init, and
 * .agent-work directories ready for orrery.
 */
function createSandbox(name) {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), `orrery-integration-${name}-`)
  );

  // Copy target repo fixture
  copyDirSync(FIXTURES_DIR, dir);

  // Init git repo with initial commit
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Integration Test"], {
    cwd: dir,
    stdio: "ignore"
  });
  execFileSync("git", ["config", "user.email", "test@orrery.dev"], {
    cwd: dir,
    stdio: "ignore"
  });
  execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "initial commit"], {
    cwd: dir,
    stdio: "ignore"
  });

  // Create .agent-work directories
  const workDir = path.join(dir, ".agent-work");
  fs.mkdirSync(path.join(workDir, "plans"), { recursive: true });
  fs.mkdirSync(path.join(workDir, "completed"), { recursive: true });
  fs.mkdirSync(path.join(workDir, "reports"), { recursive: true });

  return { dir, workDir, name };
}

/**
 * Remove the sandbox directory. Skipped when KEEP_SANDBOX=1 for debugging.
 */
function destroySandbox(sandbox) {
  if (process.env.KEEP_SANDBOX === "1") {
    console.log(`  [KEEP_SANDBOX] preserved: ${sandbox.dir}`);
    return;
  }
  fs.rmSync(sandbox.dir, { recursive: true, force: true });
}

// ─── Plan helpers ────────────────────────────────────────────────────

/**
 * Write a plan YAML file into the sandbox's plans directory.
 */
function writePlan(sandbox, filename, yamlString) {
  const dest = path.join(sandbox.workDir, "plans", filename);
  fs.writeFileSync(dest, yamlString, "utf8");
  return dest;
}

/**
 * Load the final plan from plans/ or completed/ (checks both).
 * Returns the parsed YAML object.
 */
function loadFinalPlan(sandbox, filename) {
  const plansPath = path.join(sandbox.workDir, "plans", filename);
  const completedPath = path.join(sandbox.workDir, "completed", filename);

  let filePath;
  if (fs.existsSync(plansPath)) {
    filePath = plansPath;
  } else if (fs.existsSync(completedPath)) {
    filePath = completedPath;
  } else {
    throw new Error(
      `Plan "${filename}" not found in plans/ or completed/ under ${sandbox.workDir}`
    );
  }

  return YAML.parse(fs.readFileSync(filePath, "utf8"));
}

// ─── Orrery invocation ──────────────────────────────────────────────

/**
 * Run orrery as a subprocess against the sandbox.
 * Returns { code, stdout, stderr }.
 */
function runOrrery(sandbox, args, env = {}) {
  return new Promise((resolve) => {
    const mergedEnv = {
      ...process.env,
      ORRERY_AGENT_TIMEOUT: "120000",
      ...env
    };
    // Remove ORRERY_WORK_DIR so orrery uses <cwd>/.agent-work
    delete mergedEnv.ORRERY_WORK_DIR;

    execFile(
      process.execPath,
      [BIN_PATH, ...args],
      {
        cwd: sandbox.dir,
        encoding: "utf8",
        timeout: 300_000, // 5 minutes
        env: mergedEnv
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof error.code === "number" ? error.code : error ? 1 : 0;
        resolve({ code, stdout: stdout || "", stderr: stderr || "" });
      }
    );
  });
}

// ─── Assertions ─────────────────────────────────────────────────────

function assertAllStepsComplete(plan) {
  for (const step of plan.steps) {
    assert.equal(
      step.status,
      "complete",
      `Expected step "${step.id}" to be complete but was "${step.status}"`
    );
  }
}

function assertStepStatus(plan, stepId, expectedStatus) {
  const step = plan.steps.find((s) => s.id === stepId);
  assert.ok(step, `Step "${stepId}" not found in plan`);
  assert.equal(
    step.status,
    expectedStatus,
    `Expected step "${stepId}" to be "${expectedStatus}" but was "${step.status}"`
  );
}

function assertFileExists(sandbox, relativePath) {
  const fullPath = path.join(sandbox.dir, relativePath);
  assert.ok(fs.existsSync(fullPath), `Expected file to exist: ${relativePath}`);
}

function assertFileContains(sandbox, relativePath, pattern) {
  const fullPath = path.join(sandbox.dir, relativePath);
  assert.ok(fs.existsSync(fullPath), `File does not exist: ${relativePath}`);
  const content = fs.readFileSync(fullPath, "utf8");
  assert.match(
    content,
    pattern,
    `File "${relativePath}" does not match ${pattern}`
  );
}

function assertGitCommits(sandbox, minCount) {
  const log = execFileSync("git", ["log", "--oneline"], {
    cwd: sandbox.dir,
    encoding: "utf8"
  }).trim();
  const count = log.split("\n").length;
  // Subtract 1 for the initial commit
  const actual = count - 1;
  assert.ok(
    actual >= minCount,
    `Expected at least ${minCount} commit(s) beyond initial, found ${actual}`
  );
}

function assertReportExists(sandbox, planName, stepId) {
  const reportsDir = path.join(sandbox.workDir, "reports");
  if (!fs.existsSync(reportsDir)) {
    assert.fail(`Reports directory does not exist: ${reportsDir}`);
  }
  const files = fs.readdirSync(reportsDir);
  const match = files.find((f) => f.includes(planName) && f.includes(stepId));
  assert.ok(
    match,
    `No report found for plan "${planName}" step "${stepId}" in: ${files.join(", ") || "(empty)"}`
  );
}

/**
 * Switch the sandbox repo to the work branch so file assertions see the
 * agent's changes. The work branch name is read from the plan metadata.
 */
function checkoutWorkBranch(sandbox, filename) {
  const plan = loadFinalPlan(sandbox, filename);
  const workBranch = plan.metadata && plan.metadata.work_branch;
  if (!workBranch) {
    throw new Error(
      `Plan "${filename}" has no work_branch in metadata — was it dispatched?`
    );
  }

  // Prune stale worktree references so the branch can be checked out
  try {
    execFileSync("git", ["worktree", "prune"], {
      cwd: sandbox.dir,
      stdio: "ignore"
    });
  } catch {
    // Ignore prune errors
  }

  try {
    execFileSync("git", ["checkout", "--force", workBranch], {
      cwd: sandbox.dir,
      stdio: "ignore"
    });
  } catch (err) {
    // Provide diagnostic info on failure
    const branches = execFileSync("git", ["branch", "-a"], {
      cwd: sandbox.dir,
      encoding: "utf8"
    }).trim();
    const worktrees = execFileSync("git", ["worktree", "list"], {
      cwd: sandbox.dir,
      encoding: "utf8"
    }).trim();
    throw new Error(
      `Failed to checkout "${workBranch}" for plan "${filename}".\n` +
        `Branches:\n${branches}\n` +
        `Worktrees:\n${worktrees}\n` +
        `Original error: ${err.message}`,
      { cause: err }
    );
  }
}

// ─── Internal helpers ───────────────────────────────────────────────

function copyDirSync(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Load a report YAML file for the given plan/step and assert that it contains
 * the expected fields. `expectations` is an object of key-value pairs to match
 * against the report's top-level fields (e.g., { outcome: "success" }).
 */
function assertReportContains(sandbox, planName, stepId, expectations) {
  const reportsDir = path.join(sandbox.workDir, "reports");
  assert.ok(
    fs.existsSync(reportsDir),
    `Reports directory does not exist: ${reportsDir}`
  );

  const files = fs.readdirSync(reportsDir);
  const match = files.find((f) => f.includes(planName) && f.includes(stepId));
  assert.ok(
    match,
    `No report found for plan "${planName}" step "${stepId}" in: ${files.join(", ") || "(empty)"}`
  );

  const content = fs.readFileSync(path.join(reportsDir, match), "utf8");
  const report = YAML.parse(content);

  for (const [key, expected] of Object.entries(expectations)) {
    assert.equal(
      report[key],
      expected,
      `Report field "${key}" expected "${expected}" but got "${report[key]}"`
    );
  }
}

function assertPlanNotArchived(sandbox, filename) {
  const plansPath = path.join(sandbox.workDir, "plans", filename);
  const completedPath = path.join(sandbox.workDir, "completed", filename);
  assert.ok(
    fs.existsSync(plansPath),
    `Expected plan "${filename}" to remain in plans/`
  );
  assert.ok(
    !fs.existsSync(completedPath),
    `Expected plan "${filename}" NOT to be in completed/`
  );
}

module.exports = {
  createSandbox,
  destroySandbox,
  writePlan,
  loadFinalPlan,
  runOrrery,
  assertAllStepsComplete,
  assertStepStatus,
  assertFileExists,
  assertFileContains,
  checkoutWorkBranch,
  assertGitCommits,
  assertReportExists,
  assertReportContains,
  assertPlanNotArchived
};
