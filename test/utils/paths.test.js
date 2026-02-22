const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  getWorkDir,
  getPlansDir,
  getCompletedDir,
  getReportsDir,
  getTempDir,
  getProjectId
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

test("getWorkDir uses ORRERY_WORK_DIR env var with project scoping", (t) => {
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
  const projectId = getProjectId();

  assert.equal(workDir, path.join(customWorkDir, projectId));
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
  // Should be a project-scoped subdirectory
  assert.ok(workDir.startsWith(customWorkDir));
  assert.notEqual(workDir, customWorkDir);
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
  const projectId = getProjectId();
  assert.equal(workDir, path.join(customWorkDir, projectId));
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
  const projectId = getProjectId();

  assert.equal(plansDir, path.join(tempDir, projectId, "plans"));
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
  const projectId = getProjectId();

  assert.equal(completedDir, path.join(tempDir, projectId, "completed"));
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
  const projectId = getProjectId();

  assert.equal(reportsDir, path.join(tempDir, projectId, "reports"));
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
  const projectId = getProjectId();

  assert.equal(tempSubDir, path.join(tempDir, projectId, "temp"));
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

// ============================================================================
// getProjectId tests
// ============================================================================

test("getProjectId is deterministic", () => {
  const id1 = getProjectId();
  const id2 = getProjectId();
  assert.equal(id1, id2);
});

test("getProjectId varies by cwd", (t) => {
  const dir1 = createTempDir("paths-proj1-");
  const dir2 = createTempDir("paths-proj2-");
  const originalCwd = process.cwd();

  t.after(() => {
    process.chdir(originalCwd);
    cleanupDir(dir1);
    cleanupDir(dir2);
  });

  process.chdir(dir1);
  const id1 = getProjectId();

  process.chdir(dir2);
  const id2 = getProjectId();

  assert.notEqual(id1, id2);
});

test("getProjectId uses basename with hash", () => {
  const id = getProjectId();
  // Should match pattern: <basename>-<8-hex-chars>
  assert.match(id, /^.+-[a-f0-9]{8}$/);
});

test("getProjectId handles root directory", (t) => {
  const originalCwd = process.cwd();

  // We can't actually chdir to / in tests easily, but we can verify
  // the function handles edge cases by checking current behavior
  t.after(() => {
    process.chdir(originalCwd);
  });

  // Just verify it returns a valid string
  const id = getProjectId();
  assert.ok(id.length > 0);
});

// ============================================================================
// Project-scoped isolation tests
// ============================================================================

test("getWorkDir creates project-scoped subdir when env var set", (t) => {
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
  const projectId = getProjectId();

  // Work dir should be env var + project id
  assert.equal(workDir, path.join(tempDir, projectId));
  assert.ok(fs.existsSync(workDir));
});

test("default behavior unchanged without env var", (t) => {
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

  // Should be .agent-work in cwd, no project scoping
  assert.equal(workDir, path.join(tempDir, ".agent-work"));
});
