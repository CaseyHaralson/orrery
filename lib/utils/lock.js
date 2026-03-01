const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { getWorkDir } = require("./paths");

const LOCK_FILE = "exec.lock";

/**
 * Get the lock file path.
 * @param {string} [planId] - Optional plan ID for per-plan locks
 * @returns {string} - Path to the lock file
 */
function getLockPath(planId) {
  const fileName = planId ? `exec-${planId}.lock` : LOCK_FILE;
  return path.join(getWorkDir(), fileName);
}

/**
 * Check if a process with the given PID is running.
 * @param {number} pid - Process ID
 * @returns {boolean}
 */
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a PID belongs to an orrery process.
 * @param {number} pid - Process ID
 * @returns {boolean}
 */
function isOrreryProcess(pid) {
  try {
    // Linux: read /proc/<pid>/cmdline (null-separated args)
    const cmdlinePath = `/proc/${pid}/cmdline`;
    if (fs.existsSync(cmdlinePath)) {
      const raw = fs.readFileSync(cmdlinePath, "utf8");
      const args = raw.split("\0").filter(Boolean);
      // Check if any argument ends with the orrery binary (bin/orrery.js or bin/orrery)
      return args.some(
        (arg) => arg.endsWith("bin/orrery.js") || arg.endsWith("bin/orrery")
      );
    }

    // macOS/other: use ps
    const args = execSync(`ps -p ${pid} -o args=`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return args.includes("bin/orrery.js") || args.includes("bin/orrery ");
  } catch {
    // Cannot determine — treat as stale (safe default)
    return false;
  }
}

/**
 * Read and parse the lock file.
 * @param {string} [planId] - Optional plan ID for per-plan locks
 * @returns {{pid: number, startedAt: string, command: string, planId?: string, worktreePath?: string}|null}
 */
function readLock(planId) {
  const lockPath = getLockPath(planId);
  try {
    const content = fs.readFileSync(lockPath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Attempt to acquire the execution lock.
 * @param {string} [planId] - Optional plan ID for per-plan locks
 * @param {{worktreePath?: string}} [extras] - Extra fields to store in the lock
 * @returns {{acquired: boolean, reason?: string, pid?: number}}
 */
function acquireLock(planId, extras) {
  const lockPath = getLockPath(planId);
  const lockData = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    command: process.argv.slice(2).join(" ")
  };
  if (planId) lockData.planId = planId;
  if (extras && extras.worktreePath) {
    lockData.worktreePath = extras.worktreePath;
  }

  // Check for existing lock
  const existing = readLock(planId);
  if (existing) {
    const running = isProcessRunning(existing.pid);
    if (running && isOrreryProcess(existing.pid)) {
      return {
        acquired: false,
        reason: `Another orrery process is running (PID ${existing.pid}, started ${existing.startedAt})`,
        pid: existing.pid
      };
    }

    // Stale lock — remove it
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Atomic create
  try {
    fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2) + "\n", {
      flag: "wx"
    });
    return { acquired: true };
  } catch (err) {
    if (err.code === "EEXIST") {
      // Race condition — another process acquired between check and write
      const raceWinner = readLock(planId);
      return {
        acquired: false,
        reason: `Another orrery process just started (PID ${raceWinner?.pid || "unknown"})`,
        pid: raceWinner?.pid
      };
    }
    return {
      acquired: false,
      reason: `Failed to create lock file: ${err.message}`
    };
  }
}

/**
 * Release the execution lock (only if owned by current process).
 * @param {string} [planId] - Optional plan ID for per-plan locks
 */
function releaseLock(planId) {
  const lockPath = getLockPath(planId);
  const existing = readLock(planId);

  if (existing && existing.pid === process.pid) {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get the current lock status (read-only).
 * @param {string} [planId] - Optional plan ID for per-plan locks
 * @returns {{locked: boolean, pid?: number, startedAt?: string, stale: boolean, planId?: string, worktreePath?: string}}
 */
function getLockStatus(planId) {
  const existing = readLock(planId);

  if (!existing) {
    return { locked: false, stale: false };
  }

  const running = isProcessRunning(existing.pid);
  const isOrrery = running && isOrreryProcess(existing.pid);

  const status = {
    locked: isOrrery,
    pid: existing.pid,
    startedAt: existing.startedAt,
    stale: !isOrrery
  };
  if (existing.planId) status.planId = existing.planId;
  if (existing.worktreePath) status.worktreePath = existing.worktreePath;
  return status;
}

/**
 * List all per-plan locks in the work directory.
 * @returns {Array<{planId: string, pid: number, startedAt: string, active: boolean, stale: boolean, worktreePath?: string}>}
 */
function listPlanLocks() {
  const workDir = getWorkDir();
  const results = [];

  let entries;
  try {
    entries = fs.readdirSync(workDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const match = entry.match(/^exec-(.+)\.lock$/);
    if (!match) continue;

    const planId = match[1];
    const lockPath = path.join(workDir, entry);
    let lockData;
    try {
      lockData = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    } catch {
      continue;
    }

    const running = isProcessRunning(lockData.pid);
    const active = running && isOrreryProcess(lockData.pid);

    const info = {
      planId,
      pid: lockData.pid,
      startedAt: lockData.startedAt,
      active,
      stale: !active
    };
    if (lockData.worktreePath) info.worktreePath = lockData.worktreePath;
    results.push(info);
  }

  return results;
}

module.exports = {
  acquireLock,
  releaseLock,
  getLockStatus,
  listPlanLocks,
  readLock,
  isProcessRunning,
  isOrreryProcess
};
