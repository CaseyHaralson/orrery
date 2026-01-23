const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  getWorkDir,
  getPlansDir,
  getCompletedDir,
  getReportsDir,
  getTempDir
} = require("../../lib/utils/paths");
const { createTempDir, cleanupDir } = require("../helpers/test-utils");

// ============================================================================
// getWorkDir tests
// ============================================================================

test("getWorkDir returns default .agent-work in cwd", (t) => {
  const tempDir = createTempDir("paths-");
  const originalCwd = process.cwd();
  const originalEnv = process.env.ORRERY_WORK_DIR;

  process.chdir(tempDir);
  delete process.env.ORRERY_WORK_DIR;

  t.after(() => {
    process.chdir(originalCwd);
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    }
    cleanupDir(tempDir);
  });

  const workDir = getWorkDir();

  assert.equal(workDir, path.join(tempDir, ".agent-work"));
  assert.ok(fs.existsSync(workDir));
});

test("getWorkDir uses ORRERY_WORK_DIR env var when set", (t) => {
  const tempDir = createTempDir("paths-");
  const customWorkDir = path.join(tempDir, "custom-work");
  const originalEnv = process.env.ORRERY_WORK_DIR;

  process.env.ORRERY_WORK_DIR = customWorkDir;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  const workDir = getWorkDir();

  assert.equal(workDir, customWorkDir);
  assert.ok(fs.existsSync(workDir));
});

test("getWorkDir creates directory if not exists", (t) => {
  const tempDir = createTempDir("paths-");
  const customWorkDir = path.join(tempDir, "new-work-dir");
  const originalEnv = process.env.ORRERY_WORK_DIR;

  process.env.ORRERY_WORK_DIR = customWorkDir;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  assert.ok(!fs.existsSync(customWorkDir));
  const workDir = getWorkDir();
  assert.ok(fs.existsSync(workDir));
});

test("getWorkDir trims whitespace from env var", (t) => {
  const tempDir = createTempDir("paths-");
  const customWorkDir = path.join(tempDir, "trimmed");
  const originalEnv = process.env.ORRERY_WORK_DIR;

  process.env.ORRERY_WORK_DIR = `  ${customWorkDir}  `;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  const workDir = getWorkDir();
  assert.equal(workDir, customWorkDir);
});

// ============================================================================
// getPlansDir tests
// ============================================================================

test("getPlansDir returns plans subdirectory", (t) => {
  const tempDir = createTempDir("paths-");
  const originalEnv = process.env.ORRERY_WORK_DIR;
  process.env.ORRERY_WORK_DIR = tempDir;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  const plansDir = getPlansDir();

  assert.equal(plansDir, path.join(tempDir, "plans"));
  assert.ok(fs.existsSync(plansDir));
});

// ============================================================================
// getCompletedDir tests
// ============================================================================

test("getCompletedDir returns completed subdirectory", (t) => {
  const tempDir = createTempDir("paths-");
  const originalEnv = process.env.ORRERY_WORK_DIR;
  process.env.ORRERY_WORK_DIR = tempDir;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  const completedDir = getCompletedDir();

  assert.equal(completedDir, path.join(tempDir, "completed"));
  assert.ok(fs.existsSync(completedDir));
});

// ============================================================================
// getReportsDir tests
// ============================================================================

test("getReportsDir returns reports subdirectory", (t) => {
  const tempDir = createTempDir("paths-");
  const originalEnv = process.env.ORRERY_WORK_DIR;
  process.env.ORRERY_WORK_DIR = tempDir;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  const reportsDir = getReportsDir();

  assert.equal(reportsDir, path.join(tempDir, "reports"));
  assert.ok(fs.existsSync(reportsDir));
});

// ============================================================================
// getTempDir tests
// ============================================================================

test("getTempDir returns temp subdirectory", (t) => {
  const tempDir = createTempDir("paths-");
  const originalEnv = process.env.ORRERY_WORK_DIR;
  process.env.ORRERY_WORK_DIR = tempDir;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  const tempSubDir = getTempDir();

  assert.equal(tempSubDir, path.join(tempDir, "temp"));
  assert.ok(fs.existsSync(tempSubDir));
});

// ============================================================================
// Integration tests
// ============================================================================

test("all path functions use same work dir", (t) => {
  const tempDir = createTempDir("paths-");
  const originalEnv = process.env.ORRERY_WORK_DIR;
  process.env.ORRERY_WORK_DIR = tempDir;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  const workDir = getWorkDir();
  const plansDir = getPlansDir();
  const completedDir = getCompletedDir();
  const reportsDir = getReportsDir();
  const tempSubDir = getTempDir();

  // All should be subdirectories of workDir
  assert.ok(plansDir.startsWith(workDir));
  assert.ok(completedDir.startsWith(workDir));
  assert.ok(reportsDir.startsWith(workDir));
  assert.ok(tempSubDir.startsWith(workDir));
});
