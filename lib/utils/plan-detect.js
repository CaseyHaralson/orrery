const { getCurrentBranch } = require("./git");
const { getPlanFiles, loadPlan } = require("../orchestration/plan-loader");
const { getPlansDir } = require("./paths");

/**
 * Find a plan that matches the current branch's work_branch metadata.
 * Used for auto-detection when on a work branch.
 * @returns {{planFile: string, plan: Object}|null} - The matching plan or null
 */
function findPlanForCurrentBranch() {
  const currentBranch = getCurrentBranch(process.cwd());
  const plansDir = getPlansDir();
  const planFiles = getPlanFiles(plansDir);

  for (const planFile of planFiles) {
    const plan = loadPlan(planFile);
    if (plan.metadata.work_branch === currentBranch) {
      return { planFile, plan };
    }
  }
  return null;
}

module.exports = { findPlanForCurrentBranch };
