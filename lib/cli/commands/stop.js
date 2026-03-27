const path = require("path");

const { derivePlanId } = require("../../utils/git");
const {
  getLockStatus,
  listPlanLocks,
  readLock,
  isOrreryProcess
} = require("../../utils/lock");
const { requestStop, clearStopSignal } = require("../../utils/stop-signal");

function supportsColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text, color) {
  if (!supportsColor()) return text;
  const colors = {
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    reset: "\x1b[0m"
  };
  return `${colors[color] || ""}${text}${colors.reset}`;
}

/**
 * Send SIGTERM to a process after verifying it's an orrery process.
 * @param {number} pid - Process ID
 * @param {string} label - Label for log messages
 * @returns {boolean} - Whether the signal was sent
 */
function killProcess(pid, label) {
  if (!isOrreryProcess(pid)) {
    console.log(
      `  ${colorize("skipped", "yellow")} ${label} — PID ${pid} is not an orrery process`
    );
    return false;
  }

  try {
    process.kill(pid, "SIGTERM");
    console.log(
      `  ${colorize("stopped", "green")} ${label} (PID ${pid}, sent SIGTERM)`
    );
    return true;
  } catch (err) {
    if (err.code === "ESRCH") {
      console.log(
        `  ${colorize("skipped", "yellow")} ${label} — PID ${pid} already exited`
      );
    } else {
      console.log(`  ${colorize("failed", "red")} ${label} — ${err.message}`);
    }
    return false;
  }
}

module.exports = function registerStopCommand(program) {
  program
    .command("stop")
    .description("Stop running orchestrations")
    .option("--plan <file>", "Stop a specific plan by name or file")
    .option(
      "--graceful",
      "Finish current step(s) then stop (instead of immediate SIGTERM)"
    )
    .action((options) => {
      const graceful = options.graceful || false;

      if (options.plan) {
        // Stop a specific plan
        const planBasename = path.basename(options.plan);
        const planId = derivePlanId(planBasename);

        const lock = readLock(planId);
        if (!lock) {
          console.log(`No active execution found for plan "${planId}".`);
          return;
        }

        const status = getLockStatus(planId);
        if (status.stale) {
          console.log(
            `Lock for plan "${planId}" is stale (PID ${lock.pid} no longer running).`
          );
          return;
        }

        if (!status.locked) {
          console.log(`No active execution found for plan "${planId}".`);
          return;
        }

        if (graceful) {
          requestStop(planId);
          console.log(
            `Graceful stop requested for plan "${planId}" — will stop after current step(s) finish.`
          );
        } else {
          killProcess(lock.pid, `plan "${planId}"`);
          clearStopSignal(planId);
        }
        return;
      }

      // Stop all running plans
      const planLocks = listPlanLocks();
      const activeLocks = planLocks.filter((l) => l.active);

      // Also check global lock
      const globalStatus = getLockStatus();
      const globalLock = globalStatus.locked ? readLock() : null;

      if (activeLocks.length === 0 && !globalLock) {
        console.log("No active orchestrations found.");
        return;
      }

      if (graceful) {
        // Write signal files for all active plans + global
        if (globalLock) {
          requestStop();
          console.log(
            "Graceful stop requested for global execution — will stop after current step(s) finish."
          );
        }
        for (const pl of activeLocks) {
          requestStop(pl.planId);
          console.log(
            `Graceful stop requested for plan "${pl.planId}" — will stop after current step(s) finish.`
          );
        }
      } else {
        // Immediate stop via SIGTERM
        if (globalLock) {
          killProcess(globalLock.pid, "global execution");
          clearStopSignal();
        }
        for (const pl of activeLocks) {
          killProcess(pl.pid, `plan "${pl.planId}"`);
          clearStopSignal(pl.planId);
        }
      }
    });
};
