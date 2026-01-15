const fs = require("fs");
const path = require("path");

const WORK_DIR_ENV = "ORRERY_WORK_DIR";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function getWorkDir() {
  const envDir = process.env[WORK_DIR_ENV];
  if (envDir && envDir.trim()) {
    return ensureDir(envDir.trim());
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

module.exports = {
  getWorkDir,
  getPlansDir,
  getCompletedDir,
  getReportsDir,
};
