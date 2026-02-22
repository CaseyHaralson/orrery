const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const { orchestrate } = require("../../orchestration");
const { getWorkDir } = require("../../utils/paths");

module.exports = function registerOrchestrateCommand(program) {
  program
    .command("orchestrate")
    .alias("exec")
    .description("Run plan orchestration for the current project")
    .option("--plan <file>", "Process only a specific plan file")
    .option("--dry-run", "Show what would be executed without running agents")
    .option("--verbose", "Show detailed agent output")
    .option("--resume", "Resume orchestration on the current work branch")
    .option("--review", "Enable code review loop after each step")
    .option(
      "--parallel",
      "Enable parallel execution with git worktrees for isolation"
    )
    .option(
      "--background",
      "Run orchestration as a detached background process"
    )
    .action(async (options) => {
      // Background mode: re-spawn as detached process
      if (options.background) {
        if (options.dryRun) {
          console.log(
            "Note: --background with --dry-run runs in foreground.\n"
          );
          // Fall through to normal execution
        } else {
          const args = [];
          if (options.plan) args.push("--plan", options.plan);
          if (options.verbose) args.push("--verbose");
          if (options.resume) args.push("--resume");
          if (options.review) args.push("--review");
          if (options.parallel) args.push("--parallel");

          const logFile = path.join(getWorkDir(), "exec.log");
          const logFd = fs.openSync(logFile, "a");

          const binPath = path.join(
            __dirname,
            "..",
            "..",
            "..",
            "bin",
            "orrery.js"
          );
          const child = spawn(process.execPath, [binPath, "exec", ...args], {
            detached: true,
            stdio: ["ignore", logFd, logFd],
            cwd: process.cwd(),
            env: process.env
          });

          child.unref();
          fs.closeSync(logFd);

          console.log(`Background execution started (PID ${child.pid})`);
          console.log(`Log file: ${logFile}`);
          console.log("\nUse 'orrery status' to check progress.");
          return;
        }
      }

      try {
        await orchestrate({
          plan: options.plan,
          dryRun: options.dryRun,
          verbose: options.verbose,
          resume: options.resume,
          review: options.review,
          parallel: options.parallel
        });
      } catch (error) {
        console.error(error && error.message ? error.message : error);
        process.exitCode = 1;
      }
    });
};
