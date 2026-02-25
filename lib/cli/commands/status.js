const path = require("path");

const { getPlansDir } = require("../../utils/paths");
const { getPlanFiles, loadPlan } = require("../../orchestration/plan-loader");
const { findPlanForCurrentBranch } = require("../../utils/plan-detect");
const { getCurrentBranch } = require("../../utils/git");
const { getLockStatus, listPlanLocks } = require("../../utils/lock");

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

function getPlanStatus(plan) {
  if (plan.isSuccessful()) return "complete";
  if (plan.steps.some((step) => step.status === "blocked")) return "blocked";
  if (plan.steps.some((step) => step.status === "in_progress")) {
    return "in_progress";
  }
  if (plan.metadata && plan.metadata.work_branch) return "in_flight";
  return "pending";
}

function getStatusColor(status) {
  if (status === "complete") return "green";
  if (status === "in_progress" || status === "in_flight") return "yellow";
  if (status === "blocked") return "red";
  return null;
}

function formatStatusLabel(status) {
  const color = getStatusColor(status);
  const label = status.replace("_", " ");
  return color ? colorize(label, color) : label;
}

function resolvePlanPath(planArg) {
  if (!planArg) return null;
  if (path.isAbsolute(planArg)) return planArg;
  if (planArg.includes(path.sep)) return path.resolve(process.cwd(), planArg);
  return path.join(getPlansDir(), planArg);
}

function summarizePlans(plans) {
  let pendingSteps = 0;
  let completedSteps = 0;

  for (const plan of plans) {
    for (const step of plan.steps) {
      if (step.status === "pending") pendingSteps += 1;
      if (step.status === "complete") completedSteps += 1;
    }
  }

  return { pendingSteps, completedSteps };
}

function renderPlanList(plans) {
  for (const plan of plans) {
    const status = getPlanStatus(plan);
    const label = formatStatusLabel(status);
    console.log(`${label} ${plan.fileName}`);
  }
}

function renderPlanDetail(plan) {
  const status = getPlanStatus(plan);
  console.log(`${formatStatusLabel(status)} ${plan.fileName}`);
  for (const step of plan.steps) {
    const stepLabel = formatStatusLabel(step.status || "pending");
    const description = step.description ? ` - ${step.description}` : "";
    console.log(`  ${stepLabel} ${step.id}${description}`);
    // Display blocked reason if step is blocked
    if (step.status === "blocked" && step.blocked_reason) {
      console.log(`    Reason: ${step.blocked_reason}`);
    }
  }
}

module.exports = function registerStatusCommand(program) {
  program
    .command("status")
    .description("Show orchestration status for plans in the current project")
    .option("--plan <file>", "Show detailed status for a specific plan")
    .action((options) => {
      // Check for active global execution
      const lock = getLockStatus();
      if (lock.locked) {
        console.log(
          `Execution in progress (PID ${lock.pid}, started ${lock.startedAt})\n`
        );
      } else if (lock.stale) {
        console.log(
          `Note: Stale lock detected (PID ${lock.pid} no longer running)\n`
        );
      }

      // Check for per-plan executions
      const planLocks = listPlanLocks();
      const activePlanLocks = planLocks.filter((l) => l.active);
      const stalePlanLocks = planLocks.filter((l) => l.stale);

      if (activePlanLocks.length > 0) {
        console.log(`Active plan executions (${activePlanLocks.length}):`);
        for (const pl of activePlanLocks) {
          let line = `  - ${pl.planId} (PID ${pl.pid}, started ${pl.startedAt})`;
          if (pl.worktreePath) line += `\n    worktree: ${pl.worktreePath}`;
          console.log(line);
        }
        console.log();
      }
      if (stalePlanLocks.length > 0) {
        console.log(
          `Note: ${stalePlanLocks.length} stale per-plan lock(s) detected\n`
        );
      }

      const plansDir = getPlansDir();
      const planArg = options.plan;

      if (planArg) {
        const planPath = resolvePlanPath(planArg);
        if (!planPath || !require("fs").existsSync(planPath)) {
          console.error(`Plan not found: ${planArg}`);
          process.exitCode = 1;
          return;
        }

        const plan = loadPlan(planPath);
        renderPlanDetail(plan);
        return;
      }

      // Auto-detect plan when on a work branch
      try {
        const match = findPlanForCurrentBranch();
        if (match) {
          const currentBranch = getCurrentBranch(process.cwd());
          console.log(`(detected plan for branch: ${currentBranch})\n`);
          renderPlanDetail(match.plan);
          return;
        }
      } catch {
        // Not a git repo or other git error - fall through to list all plans
      }

      const planFiles = getPlanFiles(plansDir);
      if (planFiles.length === 0) {
        console.log("No plans found");
        return;
      }

      const plans = planFiles.map((planFile) => loadPlan(planFile));
      const { pendingSteps, completedSteps } = summarizePlans(plans);
      console.log(
        `${plans.length} plans, ${pendingSteps} pending steps, ${completedSteps} completed`
      );
      renderPlanList(plans);
    });
};
