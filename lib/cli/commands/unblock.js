const fs = require("fs");
const path = require("path");

const { getPlansDir } = require("../../utils/paths");
const { loadPlan, updateStepsStatus } = require("../../orchestration/plan-loader");
const { findPlanForCurrentBranch } = require("../../utils/plan-detect");

function supportsColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text, color) {
  if (!supportsColor()) return text;
  const colors = {
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    reset: "\x1b[0m",
  };
  return `${colors[color] || ""}${text}${colors.reset}`;
}

function resolvePlanPath(planArg) {
  if (!planArg) return null;
  if (path.isAbsolute(planArg)) return planArg;
  if (planArg.includes(path.sep)) return path.resolve(process.cwd(), planArg);
  return path.join(getPlansDir(), planArg);
}

module.exports = function registerUnblockCommand(program) {
  program
    .command("unblock [plan]")
    .description("Reset blocked steps to pending. Auto-detects plan when on a work branch.")
    .option("--step <id>", "Unblock a specific step by ID")
    .option("--all", "Unblock all blocked steps")
    .option("--dry-run", "Preview changes without modifying the plan file")
    .action((planArg, options) => {
      let planPath;

      // Resolve plan path - auto-detect if not provided
      if (planArg) {
        planPath = resolvePlanPath(planArg);
        if (!planPath || !fs.existsSync(planPath)) {
          console.error(`Plan not found: ${planArg}`);
          process.exitCode = 1;
          return;
        }
      } else {
        // Try auto-detect from current branch
        try {
          const match = findPlanForCurrentBranch();
          if (!match) {
            console.error("No plan specified and not on a work branch.");
            console.log("Usage: orrery unblock <plan> [--step <id>] [--all]");
            process.exitCode = 1;
            return;
          }
          planPath = match.planFile;
          console.log(`(detected plan: ${path.basename(planPath)})\n`);
        } catch (error) {
          console.error("No plan specified and could not detect from branch.");
          console.log("Usage: orrery unblock <plan> [--step <id>] [--all]");
          process.exitCode = 1;
          return;
        }
      }

      const plan = loadPlan(planPath);
      const blockedSteps = plan.steps.filter((s) => s.status === "blocked");

      // No blocked steps
      if (blockedSteps.length === 0) {
        console.log(`No blocked steps in ${plan.fileName}`);
        return;
      }

      // If no --step or --all, just show blocked steps
      if (!options.step && !options.all) {
        console.log(`Blocked steps in ${plan.fileName}:\n`);
        for (const step of blockedSteps) {
          const description = step.description ? ` - ${step.description}` : "";
          console.log(`  ${colorize("blocked", "red")} ${step.id}${description}`);
          if (step.blocked_reason) {
            console.log(`    Reason: ${step.blocked_reason}`);
          }
        }
        console.log("\nTo unblock:");
        console.log(`  orrery unblock ${plan.fileName} --step <id>  # Unblock specific step`);
        console.log(`  orrery unblock ${plan.fileName} --all        # Unblock all`);
        return;
      }

      // Determine which steps to unblock
      let stepsToUnblock = [];

      if (options.all) {
        stepsToUnblock = blockedSteps;
      } else if (options.step) {
        const step = blockedSteps.find((s) => s.id === options.step);
        if (!step) {
          console.error(`Step "${options.step}" is not blocked or does not exist.`);
          console.log("\nBlocked steps:");
          for (const s of blockedSteps) {
            console.log(`  - ${s.id}`);
          }
          process.exitCode = 1;
          return;
        }
        stepsToUnblock = [step];
      }

      // Dry-run mode
      if (options.dryRun) {
        console.log("Dry run - would unblock the following steps:\n");
        for (const step of stepsToUnblock) {
          console.log(`  ${step.id}`);
          if (step.blocked_reason) {
            console.log(`    (was blocked: ${step.blocked_reason})`);
          }
        }
        return;
      }

      // Perform the unblock
      const updates = stepsToUnblock.map((step) => ({
        stepId: step.id,
        status: "pending",
        extras: { blocked_reason: null }, // Clear the blocked_reason
      }));

      updateStepsStatus(planPath, updates);

      console.log(`Unblocked ${stepsToUnblock.length} step(s) in ${plan.fileName}:\n`);
      for (const step of stepsToUnblock) {
        console.log(`  ${colorize("pending", "yellow")} ${step.id}`);
      }
      console.log("\nRun 'orrery exec --resume' to continue execution.");
    });
};
