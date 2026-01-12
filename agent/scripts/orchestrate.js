#!/usr/bin/env node

/**
 * Plan Orchestrator
 *
 * Scans work/plans/ for YAML plan files, dispatches agents to execute steps,
 * tracks completion, and archives finished plans to work/completed/.
 *
 * Branch Management:
 * - Plans are discovered on the source branch (e.g., main)
 * - Each plan gets a dedicated work branch (e.g., plan/add-feature)
 * - All agent work happens on the work branch
 * - When complete, a PR is created and orchestrator returns to source branch
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const {
  loadPlan,
  savePlan,
  updateStepsStatus,
  getPlanFiles,
  movePlanToCompleted,
  getCompletedPlanNames,
} = require("./lib/plan-loader");

const {
  getReadySteps,
  partitionSteps,
  getBlockedDependents,
} = require("./lib/dependency-resolver");

const {
  invokeAgent,
  parseAgentResults,
  createDefaultResult,
  waitForAny,
} = require("./lib/agent-invoker");

const {
  getCurrentBranch,
  branchExists,
  createBranch,
  checkoutBranch,
  commit,
  createPullRequest,
  deriveBranchName,
  hasUncommittedChanges,
} = require("./lib/git-helpers");

const config = require("./config/orchestrator.config");

const REPO_ROOT = path.join(__dirname, "..", "..");

/**
 * Main orchestration function
 */
async function orchestrate() {
  console.log("=== Plan Orchestrator Starting ===\n");

  const plansDir = path.join(REPO_ROOT, config.paths.plans);
  const completedDir = path.join(REPO_ROOT, config.paths.completed);
  const reportsDir = path.join(REPO_ROOT, config.paths.reports);

  // Ensure directories exist
  ensureDir(plansDir);
  ensureDir(completedDir);
  ensureDir(reportsDir);

  // Record the source branch we're starting from
  const sourceBranch = getCurrentBranch(REPO_ROOT);
  console.log(`Source branch: ${sourceBranch}\n`);

  // Check for uncommitted changes
  if (hasUncommittedChanges(REPO_ROOT)) {
    console.error("Error: Uncommitted changes detected. Please commit or stash before running orchestrator.");
    process.exit(1);
  }

  // Get list of completed plan filenames (to exclude)
  const completedNames = getCompletedPlanNames(completedDir);

  // Scan for active plans
  const allPlanFiles = getPlanFiles(plansDir).filter(
    (f) => !completedNames.has(path.basename(f))
  );

  // Filter out plans that are already dispatched (have work_branch set)
  const planFiles = [];
  const dispatchedPlans = [];

  for (const planFile of allPlanFiles) {
    const plan = loadPlan(planFile);
    if (plan.metadata.work_branch) {
      dispatchedPlans.push({
        file: path.basename(planFile),
        workBranch: plan.metadata.work_branch,
      });
    } else {
      planFiles.push(planFile);
    }
  }

  if (dispatchedPlans.length > 0) {
    console.log(`Skipping ${dispatchedPlans.length} already-dispatched plan(s):`);
    for (const dp of dispatchedPlans) {
      console.log(`  - ${dp.file} (work branch: ${dp.workBranch})`);
    }
    console.log();
  }

  if (planFiles.length === 0) {
    console.log(`No new plans to process in ${config.paths.plans}/`);
    console.log("Create a plan file without work_branch metadata to get started.");
    return;
  }

  console.log(`Found ${planFiles.length} plan(s) to process:\n`);
  for (const pf of planFiles) {
    console.log(`  - ${path.basename(pf)}`);
  }
  console.log();

  // Process each plan (one at a time, with branch switching)
  for (const planFile of planFiles) {
    await processPlanWithBranching(planFile, sourceBranch, completedDir, reportsDir);

    // Return to source branch for next plan
    const currentBranch = getCurrentBranch(REPO_ROOT);
    if (currentBranch !== sourceBranch) {
      console.log(`\nReturning to source branch: ${sourceBranch}`);
      checkoutBranch(sourceBranch, REPO_ROOT);
    }
  }

  console.log("\n=== Orchestrator Complete ===");
}

/**
 * Process a single plan with branch management
 */
async function processPlanWithBranching(planFile, sourceBranch, completedDir, reportsDir) {
  const planFileName = path.basename(planFile);
  console.log(`\n--- Processing: ${planFileName} ---\n`);

  // Step 1: Determine work branch name
  const workBranch = deriveBranchName(planFileName);
  console.log(`Work branch: ${workBranch}`);

  // Step 2: Update plan metadata on source branch to mark as dispatched
  let plan = loadPlan(planFile);
  plan.metadata.source_branch = sourceBranch;
  plan.metadata.work_branch = workBranch;
  savePlan(plan);

  // Commit the metadata update on source branch
  const metadataCommit = commit(
    `chore: dispatch plan ${planFileName} to ${workBranch}`,
    [planFile],
    REPO_ROOT
  );
  if (metadataCommit) {
    console.log(`Marked plan as dispatched on ${sourceBranch} (${metadataCommit.slice(0, 7)})`);
  }

  // Step 3: Create and switch to work branch
  if (branchExists(workBranch, REPO_ROOT)) {
    console.log(`Work branch ${workBranch} already exists, checking out...`);
    checkoutBranch(workBranch, REPO_ROOT);
  } else {
    console.log(`Creating work branch: ${workBranch}`);
    createBranch(workBranch, REPO_ROOT);
  }

  // Step 4: Process the plan (main execution logic)
  await processPlan(planFile, completedDir, reportsDir);

  // Step 5: Reload plan to check final state
  plan = loadPlan(planFile);
  const isComplete = plan.isComplete();

  if (isComplete) {
    // Step 6: Archive the plan (on work branch)
    archivePlan(planFile, plan, completedDir, reportsDir);

    // Step 7: Commit all work branch changes
    const workCommit = commit(
      `chore: complete plan ${planFileName}`,
      [], // Stage all changes
      REPO_ROOT
    );
    if (workCommit) {
      console.log(`Committed plan completion (${workCommit.slice(0, 7)})`);
    }

    // Step 8: Create PR
    try {
      const prTitle = `Plan: ${planFileName.replace(/\.ya?ml$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")}`;
      const prBody = generatePRBody(plan);
      const prUrl = createPullRequest(prTitle, prBody, sourceBranch, REPO_ROOT);
      console.log(`\nPull request created: ${prUrl}`);
    } catch (error) {
      console.error(`\nFailed to create PR: ${error.message}`);
      console.log("You can create the PR manually from the work branch.");
    }
  } else {
    // Plan not complete (still has pending steps or was interrupted)
    // Commit any progress made
    const progressCommit = commit(
      `wip: progress on plan ${planFileName}`,
      [],
      REPO_ROOT
    );
    if (progressCommit) {
      console.log(`Committed work-in-progress (${progressCommit.slice(0, 7)})`);
    }
    console.log("\nPlan not complete. Work branch preserved for later continuation.");
  }
}

/**
 * Generate PR body from completed plan
 */
function generatePRBody(plan) {
  const steps = plan.steps || [];
  const completed = steps.filter((s) => s.status === "complete").length;
  const blocked = steps.filter((s) => s.status === "blocked").length;
  const total = steps.length;

  let body = `## Plan Summary\n\n`;
  body += `- **Status:** ${plan.metadata.outcome === "success" ? "All steps complete" : "Partial (some steps blocked)"}\n`;
  body += `- **Steps:** ${completed}/${total} complete`;
  if (blocked > 0) {
    body += `, ${blocked} blocked`;
  }
  body += `\n\n`;

  body += `## Steps\n\n`;
  for (const step of steps) {
    const icon = step.status === "complete" ? "x" : step.status === "blocked" ? "-" : " ";
    body += `- [${icon}] **${step.id}**: ${step.description}\n`;
    if (step.status === "blocked" && step.blocked_reason) {
      body += `  - Blocked: ${step.blocked_reason}\n`;
    }
  }

  body += `\n---\n*Generated by Plan Orchestrator*`;
  return body;
}

/**
 * Process a single plan file (core execution logic)
 */
async function processPlan(planFile, completedDir, reportsDir) {
  let plan = loadPlan(planFile);
  const activeAgents = []; // Array of {handle, stepIds}

  // Check initial state
  if (plan.isComplete()) {
    console.log("Plan is already complete.");
    return;
  }

  // Main execution loop
  while (!plan.isComplete()) {
    // Get steps ready to execute
    const readySteps = getReadySteps(plan);

    if (readySteps.length === 0) {
      // Check if we have running agents
      if (activeAgents.length > 0) {
        // Wait for at least one to complete
        await waitForAgentCompletion(planFile, activeAgents, reportsDir);
        plan = loadPlan(planFile); // Reload to get status updates
        continue;
      } else {
        // No ready steps and no running agents = fully blocked
        console.log("Plan is blocked - no executable steps remaining.");
        break;
      }
    }

    // Determine how many we can start
    const currentlyRunning = activeAgents.reduce(
      (sum, a) => sum + a.stepIds.length,
      0
    );
    const { parallel, serial } = partitionSteps(
      readySteps,
      config.concurrency.maxParallel,
      currentlyRunning
    );

    // Start parallel steps together (batch invocation)
    if (parallel.length > 0) {
      const stepIds = parallel.map((s) => s.id);
      await startSteps(planFile, stepIds, activeAgents);
    }

    // Start serial steps individually
    for (const step of serial) {
      if (
        activeAgents.reduce((sum, a) => sum + a.stepIds.length, 0) >=
        config.concurrency.maxParallel
      ) {
        break;
      }
      await startSteps(planFile, [step.id], activeAgents);
    }

    // If we started any agents, wait for at least one to complete
    if (activeAgents.length > 0) {
      await waitForAgentCompletion(planFile, activeAgents, reportsDir);
      plan = loadPlan(planFile); // Reload to get status updates
    }
  }
}

/**
 * Start steps by marking them in_progress and invoking an agent
 */
async function startSteps(planFile, stepIds, activeAgents) {
  const plan = loadPlan(planFile);
  const stepIdsStr = stepIds.join(", ");
  console.log(`Starting step(s): ${stepIdsStr}`);

  // Mark steps as in_progress
  const updates = stepIds.map((stepId) => ({
    stepId,
    status: "in_progress",
  }));
  updateStepsStatus(planFile, updates);

  // Determine which agent to use
  const step = plan.steps.find((s) => s.id === stepIds[0]);
  const owner = step?.owner || "self";
  const agentName =
    owner === "self" ? config.defaultAgent : owner.toLowerCase();
  const agentConfig = config.agents[agentName] || config.agents[config.defaultAgent];

  // Invoke the agent
  const handle = invokeAgent(agentConfig, planFile, stepIds, REPO_ROOT, {
    onStdout: (text, ids) => {
      if (config.logging.streamOutput) {
        const prefix = `[${ids.join(",")}]`;
        const lines = text.trim().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            console.log(`${prefix} ${line}`);
          }
        }
      }
    },
    onStderr: (text, ids) => {
      if (config.logging.streamOutput) {
        const prefix = `[${ids.join(",")}]`;
        const lines = text.trim().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            console.error(`${prefix} ERROR: ${line}`);
          }
        }
      }
    },
  });

  activeAgents.push({ handle, stepIds });
}

/**
 * Wait for any agent to complete and process its results
 */
async function waitForAgentCompletion(planFile, activeAgents, reportsDir) {
  if (activeAgents.length === 0) return;

  // Wait for any agent to complete
  const { result, index } = await waitForAny(activeAgents.map((a) => a.handle));
  const { stepIds } = activeAgents[index];

  // Remove completed agent from active list
  activeAgents.splice(index, 1);

  console.log(
    `Agent for step(s) ${stepIds.join(", ")} exited with code ${result.exitCode}`
  );

  // Parse results from stdout
  const parsedResults = parseAgentResults(result.stdout);

  // Build updates for each step
  const updates = [];
  const reports = [];

  for (const stepId of stepIds) {
    // Find parsed result for this step, or create default
    let stepResult = parsedResults.find((r) => r.stepId === stepId);
    if (!stepResult) {
      stepResult = createDefaultResult(stepId, result.exitCode, result.stderr);
    }

    // Prepare plan update
    const update = {
      stepId,
      status: stepResult.status,
    };
    if (stepResult.status === "blocked" && stepResult.blockedReason) {
      update.extras = { blocked_reason: stepResult.blockedReason };
    }
    updates.push(update);

    // Prepare report
    reports.push({
      step_id: stepId,
      outcome: stepResult.status === "complete" ? "success" : "failure",
      details: stepResult.summary || "",
      timestamp: new Date().toISOString(),
      artifacts: stepResult.artifacts || [],
      blocked_reason: stepResult.blockedReason || null,
      test_results: stepResult.testResults || null,
    });
  }

  // Update plan file
  updateStepsStatus(planFile, updates);

  // Write reports
  for (const report of reports) {
    writeReport(reportsDir, planFile, report);
  }

  // Handle blocked step cascades
  const plan = loadPlan(planFile);
  for (const update of updates) {
    if (update.status === "blocked") {
      const dependents = getBlockedDependents(plan, update.stepId);
      if (dependents.length > 0) {
        console.log(
          `Step ${update.stepId} blocked. Dependent steps affected: ${dependents.join(", ")}`
        );
      }
    }
  }
}

/**
 * Write a step report to the reports directory
 */
function writeReport(reportsDir, planFile, report) {
  const planName = path.basename(planFile, ".yaml");
  const fileName = `${planName}-${report.step_id}-report.yaml`;
  const filePath = path.join(reportsDir, fileName);

  const content = yaml.dump(report, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
  });

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`Report written: ${fileName}`);
}

/**
 * Archive a completed plan
 */
function archivePlan(planFile, plan, completedDir, reportsDir) {
  const success = plan.isSuccessful();
  const status = success ? "SUCCESS" : "PARTIAL (some steps blocked)";

  // Add completion metadata
  plan.metadata.completed_at = new Date().toISOString();
  plan.metadata.outcome = success ? "success" : "partial";
  savePlan(plan);

  // Move to completed
  const destPath = movePlanToCompleted(planFile, completedDir);
  console.log(`\nPlan archived: ${status}`);
  console.log(`  -> ${path.relative(REPO_ROOT, destPath)}`);
}

/**
 * Ensure a directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Run if called directly
if (require.main === module) {
  orchestrate().catch((err) => {
    console.error("Orchestrator error:", err);
    process.exit(1);
  });
}

module.exports = { orchestrate };
