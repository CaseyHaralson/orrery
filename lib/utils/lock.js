const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { getWorkDir } = require("./paths");

const LOCK_FILE = "exec.lock";

function getLockPath() {
  return path.join(getWorkDir(), LOCK_FILE);
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
    // Linux: read /proc/<pid>/cmdline
    const cmdlinePath = `/proc/${pid}/cmdline`;
    if (fs.existsSync(cmdlinePath)) {
      const cmdline = fs.readFileSync(cmdlinePath, "utf8");
      return cmdline.includes("orrery");
    }

    // macOS/other: use ps
    const args = execSync(`ps -p ${pid} -o args=`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return args.includes("orrery");
  } catch {
    // Cannot determine — treat as stale (safe default)
    return false;
  }
}

/**
 * Read and parse the lock file.
 * @returns {{pid: number, startedAt: string, command: string}|null}
 */
function readLock() {
  const lockPath = getLockPath();
  try {
    const content = fs.readFileSync(lockPath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Attempt to acquire the execution lock.
 * @returns {{acquired: boolean, reason?: string, pid?: number}}
 */
function acquireLock() {
  const lockPath = getLockPath();
  const lockData = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    command: process.argv.slice(2).join(" ")
  };

  // Check for existing lock
  const existing = readLock();
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
      const raceWinner = readLock();
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
 */
function releaseLock() {
  const lockPath = getLockPath();
  const existing = readLock();

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
 * @returns {{locked: boolean, pid?: number, startedAt?: string, stale: boolean}}
 */
function getLockStatus() {
  const existing = readLock();

  if (!existing) {
    return { locked: false, stale: false };
  }

  const running = isProcessRunning(existing.pid);
  const isOrrery = running && isOrreryProcess(existing.pid);

  return {
    locked: isOrrery,
    pid: existing.pid,
    startedAt: existing.startedAt,
    stale: !isOrrery
  };
}

module.exports = {
  acquireLock,
  releaseLock,
  getLockStatus,
  isProcessRunning,
  isOrreryProcess
};
