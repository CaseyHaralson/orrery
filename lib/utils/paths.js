const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const WORK_DIR_ENV = "ORRERY_WORK_DIR";
const REPO_ROOT_ENV = "ORRERY_REPO_ROOT";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * Get the effective repo root for path resolution.
 * Uses ORRERY_REPO_ROOT if set (when running inside a worktree), otherwise process.cwd().
 * @returns {string} - Resolved repo root path
 */
function getEffectiveRoot() {
  const envRoot = process.env[REPO_ROOT_ENV];
  if (envRoot && envRoot.trim()) {
    return path.resolve(envRoot.trim());
  }
  return path.resolve(process.cwd());
}

/**
 * Generate a deterministic project identifier from the current working directory.
 * Format: <sanitized-basename>-<hash8>
 * When ORRERY_REPO_ROOT is set (inside a worktree), uses that instead of cwd
 * so the project ID stays consistent.
 * @returns {string} - Project identifier
 */
function getProjectId() {
  const cwd = getEffectiveRoot();
  const basename = path.basename(cwd) || "root";
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const hash = crypto
    .createHash("sha256")
    .update(cwd)
    .digest("hex")
    .slice(0, 8);
  return `${sanitized}-${hash}`;
}

function getWorkDir() {
  const envDir = process.env[WORK_DIR_ENV];
  if (envDir && envDir.trim()) {
    const projectScoped = path.join(envDir.trim(), getProjectId());
    return ensureDir(projectScoped);
  }
  return ensureDir(path.join(getEffectiveRoot(), ".agent-work"));
}

function getPlansDir() {
  return ensureDir(path.join(getWorkDir(), "plans"));
}

function getCompletedDir() {
  return ensureDir(path.join(getWorkDir(), "completed"));
}

function getReportsDir() {
  return ensureDir(path.join(getWorkDir(), "reports"));
}

function getTempDir() {
  return ensureDir(path.join(getWorkDir(), "temp"));
}

function isWorkDirExternal() {
  const workDir = path.resolve(getWorkDir());
  const root = getEffectiveRoot();
  return !workDir.startsWith(root + path.sep) && workDir !== root;
}

module.exports = {
  getWorkDir,
  getPlansDir,
  getCompletedDir,
  getReportsDir,
  getTempDir,
  getProjectId,
  isWorkDirExternal
};
