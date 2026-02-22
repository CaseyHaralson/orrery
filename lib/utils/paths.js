const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const WORK_DIR_ENV = "ORRERY_WORK_DIR";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * Generate a deterministic project identifier from the current working directory.
 * Format: <sanitized-basename>-<hash8>
 * @returns {string} - Project identifier
 */
function getProjectId() {
  const cwd = path.resolve(process.cwd());
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
  return ensureDir(path.join(process.cwd(), ".agent-work"));
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

module.exports = {
  getWorkDir,
  getPlansDir,
  getCompletedDir,
  getReportsDir,
  getTempDir,
  getProjectId
};
