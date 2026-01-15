const path = require("path");

const { getPlansDir } = require("../../utils/paths");
const { getPlanFiles, loadPlan } = require("../../../agent/scripts/lib/plan-loader");

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

function getPlanStatus(plan) {
  if (plan.isSuccessful()) return "complete";
  if (plan.steps.some((step) => step.status === "blocked")) return "blocked";
  if (plan.steps.some((step) => step.status === "in_progress")) {
    return "in_progress";
  }
  return "pending";
}

function getStatusColor(status) {
  if (status === "complete") return "green";
  if (status === "in_progress") return "yellow";
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
  }
}

module.exports = function registerStatusCommand(program) {
  program
    .command("status")
    .description("Show orchestration status for plans in this project")
    .option("--plan <file>", "Show detailed status for a specific plan")
    .action((options) => {
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
