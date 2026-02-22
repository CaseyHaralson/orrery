const fs = require("fs");
const path = require("path");

const { findPlanForCurrentBranch } = require("../../utils/plan-detect");
const {
  loadPlan,
  updateStepsStatus
} = require("../../orchestration/plan-loader");
const { commit, getCurrentBranch } = require("../../utils/git");
const { getPlansDir } = require("../../utils/paths");
const { orchestrate } = require("../../orchestration");

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

module.exports = function registerResumeCommand(program) {
  program
    .command("resume")
    .description("Unblock steps and resume orchestration")
    .option("--plan <file>", "Resume a specific plan file")
    .option("--step <id>", "Unblock a specific step before resuming")
    .option("--all", "Unblock all blocked steps (default behavior)")
    .option(
      "--dry-run",
      "Preview what would be unblocked without making changes"
    )
    .action(async (options) => {
      let planFile;
      let plan;

      if (options.plan) {
        // Resolve plan path (same pattern as status.js)
        const planArg = options.plan;
        let resolvedPath;
        if (path.isAbsolute(planArg)) {
          resolvedPath = planArg;
        } else if (planArg.includes(path.sep)) {
          resolvedPath = path.resolve(process.cwd(), planArg);
        } else {
          resolvedPath = path.join(getPlansDir(), planArg);
        }

        if (!resolvedPath || !fs.existsSync(resolvedPath)) {
          console.error(`Plan not found: ${planArg}`);
          process.exitCode = 1;
          return;
        }

        plan = loadPlan(resolvedPath);
        planFile = resolvedPath;

        // Validate work_branch
        if (!plan.metadata.work_branch) {
          console.error(
            "Plan has no work_branch — it hasn't been dispatched yet."
          );
          console.log(
            "\nUse 'orrery exec --plan <file>' to dispatch the plan first."
          );
          process.exitCode = 1;
          return;
        }

        // Verify current branch matches plan's work_branch
        let currentBranch;
        try {
          currentBranch = getCurrentBranch(process.cwd());
        } catch {
          console.error("Error detecting current branch.");
          process.exitCode = 1;
          return;
        }

        if (currentBranch !== plan.metadata.work_branch) {
          console.error(
            `Plan expects branch '${plan.metadata.work_branch}' but you are on '${currentBranch}'.`
          );
          console.log(`\nRun: git checkout ${plan.metadata.work_branch}`);
          process.exitCode = 1;
          return;
        }
      } else {
        // 1. Find plan for current branch (existing behavior)
        let match;
        try {
          match = findPlanForCurrentBranch();
        } catch {
          console.error("Error detecting plan from current branch.");
          console.log(
            "Make sure you're on a work branch (e.g., plan/feature-name)."
          );
          process.exitCode = 1;
          return;
        }

        if (!match) {
          console.error(
            "Not on a work branch. No plan found for current branch."
          );
          console.log("\nTo resume a plan:");
          console.log("  1. git checkout <work-branch>");
          console.log("  2. orrery resume");
          console.log("\nOr specify a plan directly:");
          console.log("  orrery resume --plan <file>");
          process.exitCode = 1;
          return;
        }

        planFile = match.planFile;
        plan = match.plan;
      }
      const planFileName = path.basename(planFile);
      console.log(`(detected plan: ${planFileName})\n`);

      // 2. Check for blocked steps
      const blockedSteps = plan.steps.filter((s) => s.status === "blocked");

      // 3. If no blocked steps, skip to resume
      if (blockedSteps.length === 0) {
        console.log("No blocked steps to unblock.\n");

        if (options.dryRun) {
          console.log("Dry run: would resume orchestration.");
          return;
        }

        console.log("Resuming orchestration...\n");
        await orchestrate({ resume: true, plan: options.plan });
        return;
      }

      // 4. Determine which steps to unblock
      let stepsToUnblock = [];

      if (options.step) {
        // Unblock specific step
        const step = blockedSteps.find((s) => s.id === options.step);
        if (!step) {
          console.error(
            `Step "${options.step}" is not blocked or does not exist.`
          );
          console.log("\nBlocked steps:");
          for (const s of blockedSteps) {
            console.log(`  - ${s.id}`);
          }
          process.exitCode = 1;
          return;
        }
        stepsToUnblock = [step];
      } else {
        // Default: unblock all (--all is implicit)
        stepsToUnblock = blockedSteps;
      }

      // 5. Dry-run mode: show preview
      if (options.dryRun) {
        console.log("Dry run - would unblock the following steps:\n");
        for (const step of stepsToUnblock) {
          console.log(`  ${step.id}`);
          if (step.blocked_reason) {
            console.log(`    (was blocked: ${step.blocked_reason})`);
          }
        }
        console.log("\nThen would commit and resume orchestration.");
        return;
      }

      // 6. Perform the unblock
      const updates = stepsToUnblock.map((step) => ({
        stepId: step.id,
        status: "pending",
        extras: { blocked_reason: null } // Clear the blocked_reason
      }));

      updateStepsStatus(planFile, updates);

      console.log(`Unblocked ${stepsToUnblock.length} step(s):\n`);
      for (const step of stepsToUnblock) {
        console.log(`  ${colorize("pending", "yellow")} ${step.id}`);
      }

      // 7. Commit the plan file changes
      const planName = planFileName.replace(/\.ya?ml$/, "");
      const commitMessage = `chore: unblock steps in ${planName}`;
      const commitHash = commit(commitMessage, [planFile], process.cwd());

      if (commitHash) {
        console.log(
          `\nCommitted: ${commitMessage} (${commitHash.slice(0, 7)})`
        );
      } else {
        console.log("\n(no changes to commit)");
      }

      // 8. Resume orchestration
      console.log("\nResuming orchestration...\n");
      await orchestrate({ resume: true, plan: options.plan });
    });
};
