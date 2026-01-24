#!/usr/bin/env node

/**
 * Plan Orchestrator
 *
 * Scans .agent-work/plans/ for YAML plan files, dispatches agents to execute steps,
 * tracks completion, and archives finished plans to .agent-work/completed/.
 *
 * Branch Management:
 * - Plans are discovered on the source branch (e.g., main)
 * - Each plan gets a dedicated work branch (e.g., plan/add-feature)
 * - All agent work happens on the work branch
 * - When complete, a PR is created and orchestrator returns to source branch
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const {
  loadPlan,
  savePlan,
  updateStepsStatus,
  getPlanFiles,
  movePlanToCompleted,
  getCompletedPlanNames
} = require("./plan-loader");

const {
  getReadySteps,
  partitionSteps,
  getBlockedDependents
} = require("./dependency-resolver");

const {
  invokeAgentWithFailover,
  parseAgentResults,
  createDefaultResult,
  waitForAny
} = require("./agent-invoker");
const { invokeReviewAgent } = require("./review-invoker");
const { invokeEditAgent } = require("./edit-invoker");

const {
  getCurrentBranch,
  branchExists,
  createBranch,
  checkoutBranch,
  commit,
  createPullRequest,
  deriveBranchName,
  hasUncommittedChanges,
  getUncommittedDiff
} = require("../utils/git");

const config = require("./config");
const {
  getPlansDir,
  getCompletedDir,
  getReportsDir
} = require("../utils/paths");

const {
  generateCondensedPlan,
  writeCondensedPlan,
  deleteCondensedPlan
} = require("./condensed-plan");

const { ProgressTracker } = require("./progress-tracker");

const REPO_ROOT = process.cwd();

function parseArgs(argv) {
  const options = {
    plan: null,
    dryRun: false,
    verbose: false,
    resume: false,
    review: undefined
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--plan") {
      options.plan = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--plan=")) {
      options.plan = arg.split("=").slice(1).join("=");
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }
    if (arg === "--resume") {
      options.resume = true;
      continue;
    }
    if (arg === "--review") {
      options.review = true;
      continue;
    }
    if (arg.startsWith("--review=")) {
      const value = arg.split("=").slice(1).join("=");
      options.review = parseEnvBoolean(value);
      continue;
    }
  }

  return options;
}

function parseEnvBoolean(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseEnvInteger(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function resolveReviewEnabled(cliValue) {
  if (typeof cliValue === "boolean") {
    return cliValue;
  }

  const envValue = parseEnvBoolean(process.env.ORRERY_REVIEW_ENABLED);
  if (typeof envValue === "boolean") {
    return envValue;
  }

  return config.review.enabled;
}

function resolveReviewMaxIterations(cliValue) {
  if (Number.isFinite(cliValue) && cliValue > 0) {
    return cliValue;
  }

  const envValue = parseEnvInteger(process.env.ORRERY_REVIEW_MAX_ITERATIONS);
  if (envValue !== undefined) {
    return envValue;
  }

  return config.review.maxIterations;
}

function resolvePlanFile(planArg, plansDir) {
  if (!planArg) return null;

  const candidates = [];
  if (path.isAbsolute(planArg)) {
    candidates.push(planArg);
  } else {
    candidates.push(path.resolve(process.cwd(), planArg));
    candidates.push(path.join(plansDir, planArg));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function logDryRunSummary(planFiles) {
  console.log("Dry run: no changes will be made.");
  if (planFiles.length === 0) {
    console.log("No plans to process.");
    return;
  }

  console.log(`Plans to process (${planFiles.length}):`);
  for (const planFile of planFiles) {
    const plan = loadPlan(planFile);
    const totalSteps = plan.steps.length;
    const completed = plan.steps.filter((s) => s.status === "complete").length;
    const blocked = plan.steps.filter((s) => s.status === "blocked").length;
    const pending = totalSteps - completed - blocked;
    console.log(
      `  - ${path.basename(planFile)} (${pending} pending, ${completed} complete, ${blocked} blocked)`
    );
  }
  console.log();
}

/**
 * Main orchestration function
 */
async function orchestrate(options = {}) {
  const normalizedOptions = {
    plan: options.plan || null,
    dryRun: Boolean(options.dryRun),
    verbose: Boolean(options.verbose),
    resume: Boolean(options.resume),
    review: options.review
  };

  config.logging.streamOutput = normalizedOptions.verbose;
  config.review.enabled = resolveReviewEnabled(normalizedOptions.review);

  console.log("=== Plan Orchestrator Starting ===\n");

  const plansDir = getPlansDir();
  const completedDir = getCompletedDir();
  const reportsDir = getReportsDir();

  // Record the source branch we're starting from
  const sourceBranch = getCurrentBranch(REPO_ROOT);
  console.log(`Source branch: ${sourceBranch}\n`);

  // Check for uncommitted changes
  if (hasUncommittedChanges(REPO_ROOT)) {
    console.error(
      "Error: Uncommitted changes detected. Please commit or stash before running orchestrator."
    );
    process.exit(1);
  }

  // Resume mode: find and continue the plan for the current branch
  if (normalizedOptions.resume) {
    await handleResumeMode(plansDir, completedDir, reportsDir, sourceBranch);
    return;
  }

  // Get list of completed plan filenames (to exclude)
  const completedNames = getCompletedPlanNames(completedDir);

  let planFiles = [];
  let allPlanFiles = [];

  if (normalizedOptions.plan) {
    const resolvedPlanFile = resolvePlanFile(normalizedOptions.plan, plansDir);
    if (!resolvedPlanFile) {
      console.error(`Plan file not found: ${normalizedOptions.plan}`);
      process.exit(1);
    }
    if (completedNames.has(path.basename(resolvedPlanFile))) {
      console.log(`Plan already completed: ${path.basename(resolvedPlanFile)}`);
      return;
    }
    allPlanFiles = [resolvedPlanFile];
  } else {
    // Scan for active plans
    allPlanFiles = getPlanFiles(plansDir).filter(
      (f) => !completedNames.has(path.basename(f))
    );
  }

  // Filter out plans that are already dispatched (have work_branch set)
  const dispatchedPlans = [];

  for (const planFile of allPlanFiles) {
    const plan = loadPlan(planFile);
    if (plan.metadata.work_branch) {
      dispatchedPlans.push({
        file: path.basename(planFile),
        workBranch: plan.metadata.work_branch
      });
    } else {
      planFiles.push(planFile);
    }
  }

  if (dispatchedPlans.length > 0) {
    console.log(
      `Skipping ${dispatchedPlans.length} already-dispatched plan(s):`
    );
    for (const dp of dispatchedPlans) {
      console.log(`  - ${dp.file} (work branch: ${dp.workBranch})`);
    }
    console.log();
  }

  if (planFiles.length === 0) {
    console.log(
      `No new plans to process in ${path.relative(process.cwd(), plansDir)}/`
    );
    console.log(
      "Create a plan file without work_branch metadata to get started."
    );
    return;
  }

  if (normalizedOptions.dryRun) {
    logDryRunSummary(planFiles);
    return;
  }

  console.log(`Found ${planFiles.length} plan(s) to process:\n`);
  for (const pf of planFiles) {
    console.log(`  - ${path.basename(pf)}`);
  }
  console.log();

  // Process each plan (one at a time, with branch switching)
  for (const planFile of planFiles) {
    await processPlanWithBranching(
      planFile,
      sourceBranch,
      completedDir,
      reportsDir
    );

    // Reload plan to check final state
    const plan = loadPlan(planFile);
    const isComplete = plan.isComplete();
    const isSuccessful = plan.isSuccessful();

    if (isComplete && isSuccessful) {
      // Plan completed successfully - return to source branch for next plan
      const currentBranch = getCurrentBranch(REPO_ROOT);
      if (currentBranch !== sourceBranch) {
        console.log(`\nReturning to source branch: ${sourceBranch}`);
        checkoutBranch(sourceBranch, REPO_ROOT);
      }
    } else {
      // Plan is blocked - stay on work branch and stop processing
      console.log(`\nPlan "${path.basename(planFile)}" is blocked.`);
      console.log(`Staying on work branch: ${plan.metadata.work_branch}`);
      console.log("\nTo continue:");
      console.log("  1. Fix the blocked steps (orrery status)");
      console.log("  2. Run 'orrery resume' to unblock and continue");

      // List remaining unprocessed plans
      const remaining = planFiles.slice(planFiles.indexOf(planFile) + 1);
      if (remaining.length > 0) {
        console.log(`\nSkipped ${remaining.length} remaining plan(s).`);
      }
      break; // Stop processing
    }
  }

  console.log("\n=== Orchestrator Complete ===");
}

/**
 * Handle resume mode: find and continue plan for current branch
 */
async function handleResumeMode(
  plansDir,
  completedDir,
  reportsDir,
  currentBranch
) {
  console.log("=== Resume Mode ===\n");
  console.log(`Looking for plan with work_branch: ${currentBranch}\n`);

  // Get all plan files (including dispatched ones)
  const completedNames = getCompletedPlanNames(completedDir);
  const allPlanFiles = getPlanFiles(plansDir).filter(
    (f) => !completedNames.has(path.basename(f))
  );

  // Find plan matching current branch
  let matchingPlanFile = null;
  let matchingPlan = null;

  for (const planFile of allPlanFiles) {
    const plan = loadPlan(planFile);
    if (plan.metadata.work_branch === currentBranch) {
      matchingPlanFile = planFile;
      matchingPlan = plan;
      break;
    }
  }

  if (!matchingPlanFile) {
    console.error(`No plan found with work_branch matching "${currentBranch}"`);
    console.log("\nTo resume a plan:");
    console.log("  1. git checkout <work-branch>");
    console.log("  2. orrery exec --resume");
    process.exit(1);
  }

  const planFileName = path.basename(matchingPlanFile);
  console.log(`Found plan: ${planFileName}`);

  // Check if plan has pending steps
  if (matchingPlan.isComplete()) {
    console.log("\nPlan is already complete (no pending steps).");
    console.log("Use normal mode to create a PR or archive the plan.");
    return;
  }

  const pendingSteps = matchingPlan.steps.filter((s) => s.status === "pending");
  const inProgressSteps = matchingPlan.steps.filter(
    (s) => s.status === "in_progress"
  );
  console.log(`Pending steps: ${pendingSteps.length}`);
  if (inProgressSteps.length > 0) {
    console.log(
      `In-progress steps (will be retried): ${inProgressSteps.length}`
    );
    // Reset in_progress steps to pending so they get retried
    for (const step of inProgressSteps) {
      step.status = "pending";
    }
    savePlan(matchingPlan);
  }

  console.log("\nResuming plan execution...\n");

  // Process the plan (reuse existing processPlan logic)
  await processPlan(matchingPlanFile, completedDir, reportsDir);

  // Reload and check final state
  matchingPlan = loadPlan(matchingPlanFile);
  const isComplete = matchingPlan.isComplete();

  if (isComplete) {
    // Archive and create PR
    archivePlan(matchingPlanFile, matchingPlan, completedDir);

    const workCommit = commit(
      `chore: complete plan ${planFileName}`,
      [],
      REPO_ROOT
    );
    if (workCommit) {
      console.log(`Committed plan completion (${workCommit.slice(0, 7)})`);
    }

    const sourceBranch = matchingPlan.metadata.source_branch || "main";
    const prTitle = `Plan: ${planFileName.replace(/\.ya?ml$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")}`;
    const prBody = generatePRBody(matchingPlan);
    const prInfo = createPullRequest(prTitle, prBody, sourceBranch, REPO_ROOT);
    logPullRequestInfo(prInfo);
  } else {
    const progressCommit = commit(
      `wip: progress on plan ${planFileName}`,
      [],
      REPO_ROOT
    );
    if (progressCommit) {
      console.log(`Committed work-in-progress (${progressCommit.slice(0, 7)})`);
    }
    console.log(
      "\nPlan still has pending steps. Run --resume again to continue."
    );
  }

  console.log("\n=== Resume Complete ===");
}

/**
 * Process a single plan with branch management
 */
async function processPlanWithBranching(
  planFile,
  sourceBranch,
  completedDir,
  reportsDir
) {
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
    console.log(
      `Marked plan as dispatched on ${sourceBranch} (${metadataCommit.slice(0, 7)})`
    );
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
    archivePlan(planFile, plan, completedDir);

    // Step 7: Commit all work branch changes
    const workCommit = commit(
      `chore: complete plan ${planFileName}`,
      [], // Stage all changes
      REPO_ROOT
    );
    if (workCommit) {
      console.log(`Committed plan completion (${workCommit.slice(0, 7)})`);
    }

    // Step 8: Generate PR info
    const prTitle = `Plan: ${planFileName.replace(/\.ya?ml$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")}`;
    const prBody = generatePRBody(plan);
    const prInfo = createPullRequest(prTitle, prBody, sourceBranch, REPO_ROOT);
    logPullRequestInfo(prInfo);
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
    console.log(
      "\nPlan not complete. Work branch preserved for later continuation."
    );
  }
}

/**
 * Log pull request information for user to create PR manually
 * @param {{url: string, title: string, body: string, headBranch: string, baseBranch: string, pushed: boolean}} prInfo
 */
function logPullRequestInfo(prInfo) {
  console.log("\n=== Pull Request Ready ===\n");

  if (prInfo.pushed) {
    console.log(`Branch pushed: ${prInfo.headBranch} -> origin`);
  } else {
    console.log(
      `Note: Could not push branch. Run: git push -u origin ${prInfo.headBranch}`
    );
  }

  console.log(`\nBase branch: ${prInfo.baseBranch}`);
  console.log(`Head branch: ${prInfo.headBranch}`);

  if (prInfo.url) {
    console.log(`\nCreate PR: ${prInfo.url}`);
  } else {
    console.log("\nCould not generate PR URL (no remote configured).");
    console.log("Create the PR manually on your Git hosting platform.");
  }

  console.log("\n--- PR Title ---");
  console.log(prInfo.title);
  console.log("\n--- PR Body ---");
  console.log(prInfo.body);
  console.log("----------------\n");
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
    const icon =
      step.status === "complete" ? "x" : step.status === "blocked" ? "-" : " ";
    body += `- [${icon}] **${step.id}**: ${step.description}\n`;
    if (step.status === "blocked" && step.blocked_reason) {
      body += `  - Blocked: ${step.blocked_reason}\n`;
    }
  }

  body += `\n---\n*Generated by Orrery*`;
  return body;
}

/**
 * Process a single plan file (core execution logic)
 */
async function processPlan(planFile, completedDir, reportsDir) {
  let plan = loadPlan(planFile);
  const activeAgents = []; // Array of {handle, stepIds}

  // Initialize progress tracker
  const tracker = new ProgressTracker(
    plan.steps.length,
    path.basename(planFile)
  );
  tracker.initializeFromPlan(plan);
  tracker.logStart();

  // Check initial state
  if (plan.isComplete()) {
    console.log("Plan is already complete.");
    tracker.logSummary();
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
        const { stepIds, parsedResults } = await waitForAgentCompletion(
          planFile,
          activeAgents,
          reportsDir,
          tracker
        );
        plan = loadPlan(planFile); // Reload to get status updates

        // Commit agent work using their commit message
        if (hasUncommittedChanges(REPO_ROOT)) {
          const commitMsg =
            parsedResults[0]?.commitMessage ||
            `feat: complete step(s) ${stepIds.join(", ")}`;
          const commitSha = commit(commitMsg, [], REPO_ROOT);
          if (commitSha) {
            console.log(
              `Committed: ${commitMsg.split("\n")[0]} (${commitSha.slice(0, 7)})`
            );
          }
        }
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
      await startSteps(planFile, stepIds, activeAgents, tracker);
    }

    // Start serial steps individually
    for (const step of serial) {
      if (
        activeAgents.reduce((sum, a) => sum + a.stepIds.length, 0) >=
        config.concurrency.maxParallel
      ) {
        break;
      }
      await startSteps(planFile, [step.id], activeAgents, tracker);
    }

    // If we started any agents, wait for at least one to complete
    if (activeAgents.length > 0) {
      const { stepIds, parsedResults } = await waitForAgentCompletion(
        planFile,
        activeAgents,
        reportsDir,
        tracker
      );
      plan = loadPlan(planFile); // Reload to get status updates

      // Commit agent work using their commit message
      if (hasUncommittedChanges(REPO_ROOT)) {
        const commitMsg =
          parsedResults[0]?.commitMessage ||
          `feat: complete step(s) ${stepIds.join(", ")}`;
        const commitSha = commit(commitMsg, [], REPO_ROOT);
        if (commitSha) {
          console.log(
            `Committed: ${commitMsg.split("\n")[0]} (${commitSha.slice(0, 7)})`
          );
        }
      }
    }
  }

  // Log final summary
  tracker.logSummary();
}

/**
 * Start steps by marking them in_progress and invoking an agent
 * @param {string} planFile - Path to the plan file
 * @param {string[]} stepIds - Array of step IDs to start
 * @param {Object[]} activeAgents - Array of active agent handles
 * @param {ProgressTracker} tracker - Progress tracker instance
 */
async function startSteps(planFile, stepIds, activeAgents, tracker) {
  // Log step start with progress info
  tracker.logStepStart(stepIds);

  // Mark steps as in_progress
  const updates = stepIds.map((stepId) => ({
    stepId,
    status: "in_progress"
  }));
  updateStepsStatus(planFile, updates);

  // Generate condensed plan with only assigned steps and their completed dependencies
  const plan = loadPlan(planFile);
  const condensedPlan = generateCondensedPlan(plan, stepIds);
  const tempPlanFile = writeCondensedPlan(condensedPlan, planFile, stepIds);

  // Invoke the agent with the condensed plan
  const handle = invokeAgentWithFailover(
    config,
    tempPlanFile,
    stepIds,
    REPO_ROOT,
    {
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
              // Note: stderrIsProgress is handled per-agent inside failover
              console.log(`${prefix} ${line}`);
            }
          }
        }
      }
    }
  );

  activeAgents.push({ handle, stepIds, tempPlanFile });
}

/**
 * Wait for any agent to complete and process its results
 * @param {string} planFile - Path to the plan file
 * @param {Object[]} activeAgents - Array of active agent handles
 * @param {string} reportsDir - Directory for reports
 * @param {ProgressTracker} tracker - Progress tracker instance
 * @returns {{stepIds: string[], parsedResults: Object[]}} Completed step IDs and parsed results
 */
async function waitForAgentCompletion(
  planFile,
  activeAgents,
  reportsDir,
  tracker
) {
  if (activeAgents.length === 0) return { stepIds: [], parsedResults: [] };

  // Wait for any agent to complete
  const { result, index } = await waitForAny(activeAgents.map((a) => a.handle));
  const { stepIds, tempPlanFile } = activeAgents[index];

  // Remove completed agent from active list
  activeAgents.splice(index, 1);

  const agentName = result.agentName || "unknown";
  console.log(
    `Agent ${agentName} for step(s) ${stepIds.join(", ")} exited with code ${result.exitCode}`
  );

  // Log failure details for debugging
  if (result.exitCode !== 0 && result.exitCode !== null) {
    console.log(`[${agentName}] FAILED (exit ${result.exitCode})`);
    if (result.stderr) {
      console.log(`[${agentName}] stderr:\n${result.stderr}`);
    }
    if (result.stdout) {
      console.log(`[${agentName}] stdout:\n${result.stdout}`);
    }
  }

  // Parse results from stdout
  let parsedResults = parseAgentResults(result.stdout);

  const planForReview = loadPlan(planFile);

  // Build updates for each step
  const updates = [];
  const reports = [];

  for (const stepId of stepIds) {
    // Find parsed result for this step, or create default
    let stepResult = parsedResults.find((r) => r.stepId === stepId);
    if (!stepResult) {
      console.log(`[DEBUG] No report found for step ${stepId}`);
      if (!result.stdout || result.stdout.trim().length === 0) {
        console.log(`[DEBUG] Agent stdout was empty`);
      } else {
        console.log(`[DEBUG] Agent stdout:\n${result.stdout}`);
        console.log(`[DEBUG] Parsed results:`, parsedResults);
      }
      stepResult = createDefaultResult(stepId, result.exitCode, result.stderr);
    }

    if (config.review.enabled && stepResult.status === "complete") {
      const maxIterations = resolveReviewMaxIterations();
      if (maxIterations > 0) {
        const stepData =
          (planForReview.steps || []).find((step) => step.id === stepId) ||
          null;
        const stepContext = stepData
          ? {
              id: stepData.id,
              description: stepData.description,
              context: stepData.context,
              requirements: stepData.requirements,
              criteria: stepData.criteria,
              files: stepData.files,
              risk_notes: stepData.risk_notes
            }
          : `Step ${stepId} context not found.`;

        let approved = false;
        let currentResult = stepResult;

        for (let iteration = 1; iteration <= maxIterations; iteration++) {
          const files =
            Array.isArray(currentResult.artifacts) &&
            currentResult.artifacts.length > 0
              ? currentResult.artifacts
              : stepData && Array.isArray(stepData.files)
                ? stepData.files
                : [];
          const diff = getUncommittedDiff(REPO_ROOT, files);

          console.log(
            `Review iteration ${iteration}/${maxIterations} for step ${stepId}`
          );
          const reviewResult = await invokeReviewAgent(
            config,
            stepContext,
            files,
            diff,
            REPO_ROOT,
            {
              planFile,
              stepId,
              stepIds: [stepId]
            }
          );

          if (reviewResult.error) {
            console.log(
              `[WARN] Review output parse issue for step ${stepId}: ${reviewResult.error}`
            );
          }

          if (reviewResult.approved) {
            console.log(`Review approved for step ${stepId}`);
            approved = true;
            break;
          }

          const issueCount = reviewResult.feedback.length;
          console.log(
            `Review needs changes for step ${stepId}: ${issueCount} issue(s)`
          );

          if (iteration >= maxIterations) {
            break;
          }

          const editResults = await invokeEditAgent(
            config,
            planFile,
            [stepId],
            reviewResult.feedback,
            REPO_ROOT,
            {
              stepId,
              stepIds: [stepId]
            }
          );

          const editedResult =
            editResults.find((r) => r.stepId === stepId) ||
            createDefaultResult(stepId, null, "Edit agent returned no report");
          currentResult = editedResult;

          if (currentResult.status !== "complete") {
            console.log(
              `Edit agent reported ${currentResult.status} for step ${stepId}`
            );
            break;
          }
        }

        if (!approved && currentResult.status === "complete") {
          console.log(
            `[WARN] Review max iterations reached for step ${stepId}. Proceeding without approval.`
          );
        }

        stepResult = currentResult;
      }
    }

    parsedResults = parsedResults.filter((r) => r.stepId !== stepId);
    parsedResults.push(stepResult);

    // Prepare plan update (include agent name)
    const update = {
      stepId,
      status: stepResult.status,
      extras: { agent: agentName }
    };
    if (stepResult.status === "blocked" && stepResult.blockedReason) {
      update.extras.blocked_reason = stepResult.blockedReason;
    }
    updates.push(update);

    // Prepare report
    reports.push({
      step_id: stepId,
      agent: agentName,
      outcome: stepResult.status === "complete" ? "success" : "failure",
      details: stepResult.summary || "",
      timestamp: new Date().toISOString(),
      artifacts: stepResult.artifacts || [],
      blocked_reason: stepResult.blockedReason || null,
      test_results: stepResult.testResults || null
    });
  }

  // Update plan file
  updateStepsStatus(planFile, updates);

  // Write reports
  for (const report of reports) {
    writeReport(reportsDir, planFile, report);
  }

  // Update progress tracker
  for (const update of updates) {
    if (update.status === "complete") {
      tracker.recordComplete(update.stepId);
    } else if (update.status === "blocked") {
      tracker.recordBlocked(update.stepId);
    }
  }
  tracker.logProgress();

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

  // Clean up temp plan file
  if (tempPlanFile) {
    deleteCondensedPlan(tempPlanFile);
  }

  return { stepIds, parsedResults };
}

/**
 * Write a step report to the reports directory
 */
function writeReport(reportsDir, planFile, report) {
  const planName = path.basename(planFile, ".yaml");
  const fileName = `${planName}-${report.step_id}-report.yaml`;
  const filePath = path.join(reportsDir, fileName);

  const content = YAML.stringify(report);

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`Report written: ${fileName}`);
}

/**
 * Archive a completed plan
 */
function archivePlan(planFile, plan, completedDir) {
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

// Run if called directly
if (require.main === module) {
  const cliOptions = parseArgs(process.argv.slice(2));
  orchestrate(cliOptions).catch((err) => {
    console.error("Orchestrator error:", err);
    process.exit(1);
  });
}

module.exports = { orchestrate };
