#!/usr/bin/env node

/**
 * Plan Orchestrator
 *
 * Scans work/plans/ for YAML plan files, dispatches agents to execute steps,
 * tracks completion, and archives finished plans to work/completed/.
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

  // Get list of completed plan filenames (to exclude)
  const completedNames = getCompletedPlanNames(completedDir);

  // Scan for active plans
  const planFiles = getPlanFiles(plansDir).filter(
    (f) => !completedNames.has(path.basename(f))
  );

  if (planFiles.length === 0) {
    console.log(`No active plans found in ${config.paths.plans}/`);
    console.log("Create a plan file to get started.");
    return;
  }

  console.log(`Found ${planFiles.length} active plan(s):\n`);
  for (const pf of planFiles) {
    console.log(`  - ${path.basename(pf)}`);
  }
  console.log();

  // Process each plan
  for (const planFile of planFiles) {
    await processPlan(planFile, completedDir, reportsDir);
  }

  console.log("\n=== Orchestrator Complete ===");
}

/**
 * Process a single plan file
 */
async function processPlan(planFile, completedDir, reportsDir) {
  const planName = path.basename(planFile);
  console.log(`\n--- Processing: ${planName} ---\n`);

  let plan = loadPlan(planFile);
  const activeAgents = []; // Array of {handle, stepIds}

  // Check initial state
  if (plan.isComplete()) {
    console.log("Plan is already complete. Archiving...");
    archivePlan(planFile, plan, completedDir, reportsDir);
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

  // Plan complete (all steps complete or blocked) - archive it
  plan = loadPlan(planFile);
  if (plan.isComplete()) {
    archivePlan(planFile, plan, completedDir, reportsDir);
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
