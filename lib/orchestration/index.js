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
  addWorktree,
  removeWorktree,
  getCommitRange,
  cherryPick,
  cherryPickAbort,
  deleteBranch
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
const { acquireLock, releaseLock } = require("../utils/lock");

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

function resolveAgentTimeout(cliValue) {
  if (typeof cliValue === "number" && cliValue > 0) {
    return cliValue;
  }

  const envValue = parseEnvInteger(process.env.ORRERY_AGENT_TIMEOUT);
  if (envValue !== undefined) {
    return envValue;
  }

  return config.failover.timeoutMs;
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
 * Resolve parallel mode enabled from CLI or environment
 * @param {boolean|undefined} cliValue - CLI option value
 * @returns {boolean} - Whether parallel mode is enabled
 */
function resolveParallelEnabled(cliValue) {
  if (typeof cliValue === "boolean") {
    return cliValue;
  }

  const envValue = parseEnvBoolean(process.env.ORRERY_PARALLEL_ENABLED);
  if (typeof envValue === "boolean") {
    return envValue;
  }

  return false; // Default: disabled
}

/**
 * Resolve max parallel agents from environment
 * @returns {number} - Maximum parallel agents
 */
function resolveParallelMax() {
  const envValue = parseEnvInteger(process.env.ORRERY_PARALLEL_MAX);
  return envValue !== undefined ? envValue : 3; // Default: 3
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
    review: options.review,
    parallel: options.parallel
  };

  config.logging.streamOutput = normalizedOptions.verbose;
  config.review.enabled = resolveReviewEnabled(normalizedOptions.review);

  // Handle parallel mode configuration
  const parallelEnabled = resolveParallelEnabled(normalizedOptions.parallel);
  if (parallelEnabled) {
    config.concurrency.maxParallel = resolveParallelMax();
    console.log(
      `Parallel mode enabled (max ${config.concurrency.maxParallel} concurrent agents)`
    );
  }

  // Acquire execution lock (skip for dry-run)
  if (!normalizedOptions.dryRun) {
    const lockResult = acquireLock();
    if (!lockResult.acquired) {
      console.error(`Cannot start: ${lockResult.reason}`);
      process.exitCode = 1;
      return;
    }

    // Clean up lock on signals
    const cleanupLock = () => {
      releaseLock();
      process.exit();
    };
    process.on("SIGINT", cleanupLock);
    process.on("SIGTERM", cleanupLock);
  }

  try {
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
      await handleResumeMode(
        plansDir,
        completedDir,
        reportsDir,
        sourceBranch,
        normalizedOptions.plan
      );
      return;
    }

    // Get list of completed plan filenames (to exclude)
    const completedNames = getCompletedPlanNames(completedDir);

    let planFiles = [];
    let allPlanFiles = [];

    if (normalizedOptions.plan) {
      const resolvedPlanFile = resolvePlanFile(
        normalizedOptions.plan,
        plansDir
      );
      if (!resolvedPlanFile) {
        console.error(`Plan file not found: ${normalizedOptions.plan}`);
        process.exit(1);
      }
      if (completedNames.has(path.basename(resolvedPlanFile))) {
        console.log(
          `Plan already completed: ${path.basename(resolvedPlanFile)}`
        );
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
        reportsDir,
        parallelEnabled
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
  } finally {
    if (!normalizedOptions.dryRun) releaseLock();
  }
}

/**
 * Handle resume mode: find and continue plan for current branch
 */
async function handleResumeMode(
  plansDir,
  completedDir,
  reportsDir,
  currentBranch,
  planFileArg
) {
  console.log("=== Resume Mode ===\n");

  let matchingPlanFile = null;
  let matchingPlan = null;

  if (planFileArg) {
    // Resolve the plan file from argument
    const resolved = resolvePlanFile(planFileArg, plansDir);
    if (!resolved) {
      console.error(`Plan file not found: ${planFileArg}`);
      process.exit(1);
    }

    matchingPlan = loadPlan(resolved);
    matchingPlanFile = resolved;

    // Validate work_branch
    if (!matchingPlan.metadata.work_branch) {
      console.error("Plan has no work_branch — it hasn't been dispatched yet.");
      console.log(
        "\nUse 'orrery exec --plan <file>' to dispatch the plan first."
      );
      process.exit(1);
    }

    if (matchingPlan.metadata.work_branch !== currentBranch) {
      console.error(
        `Plan expects branch '${matchingPlan.metadata.work_branch}' but you are on '${currentBranch}'.`
      );
      console.log(`\nRun: git checkout ${matchingPlan.metadata.work_branch}`);
      process.exit(1);
    }

    console.log(`Using specified plan: ${path.basename(resolved)}\n`);
  } else {
    console.log(`Looking for plan with work_branch: ${currentBranch}\n`);

    // Get all plan files (including dispatched ones)
    const completedNames = getCompletedPlanNames(completedDir);
    const allPlanFiles = getPlanFiles(plansDir).filter(
      (f) => !completedNames.has(path.basename(f))
    );

    // Find plan matching current branch
    for (const planFile of allPlanFiles) {
      const plan = loadPlan(planFile);
      if (plan.metadata.work_branch === currentBranch) {
        matchingPlanFile = planFile;
        matchingPlan = plan;
        break;
      }
    }

    if (!matchingPlanFile) {
      console.error(
        `No plan found with work_branch matching "${currentBranch}"`
      );
      console.log("\nTo resume a plan:");
      console.log("  1. git checkout <work-branch>");
      console.log("  2. orrery exec --resume");
      console.log("\nOr specify a plan directly:");
      console.log("  orrery exec --resume --plan <file>");
      process.exit(1);
    }
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
  // Note: Resume mode uses parallelEnabled from environment/config
  const parallelEnabled = resolveParallelEnabled(undefined);
  if (parallelEnabled) {
    config.concurrency.maxParallel = resolveParallelMax();
    console.log(
      `Parallel mode enabled (max ${config.concurrency.maxParallel} concurrent agents)`
    );
  }
  await processPlan(
    matchingPlanFile,
    completedDir,
    reportsDir,
    parallelEnabled
  );

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
 * @param {string} planFile - Path to the plan file
 * @param {string} sourceBranch - The source branch to return to
 * @param {string} completedDir - Directory for completed plans
 * @param {string} reportsDir - Directory for reports
 * @param {boolean} parallelEnabled - Whether parallel execution with worktrees is enabled
 */
async function processPlanWithBranching(
  planFile,
  sourceBranch,
  completedDir,
  reportsDir,
  parallelEnabled = false
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
  await processPlan(planFile, completedDir, reportsDir, parallelEnabled);

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
 * @param {string} planFile - Path to the plan file
 * @param {string} completedDir - Directory for completed plans
 * @param {string} reportsDir - Directory for reports
 * @param {boolean} parallelEnabled - Whether parallel execution with worktrees is enabled
 */
async function processPlan(
  planFile,
  completedDir,
  reportsDir,
  parallelEnabled = false
) {
  let plan = loadPlan(planFile);
  const activeAgents = []; // Array of {handle, stepIds, tempPlanFile, worktreeInfo?}

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
        // Wait for agent(s) to complete based on mode
        if (parallelEnabled && activeAgents.some((a) => a.worktreeInfo)) {
          // Parallel mode: wait for all parallel agents, then merge
          const results = await waitForAllParallelAgents(
            planFile,
            activeAgents,
            reportsDir,
            tracker
          );
          plan = loadPlan(planFile);
          await mergeWorktreeCommits(results, REPO_ROOT);
        } else {
          // Serial mode: wait for one
          const { stepIds, parsedResults } = await waitForAgentCompletion(
            planFile,
            activeAgents,
            reportsDir,
            tracker
          );
          plan = loadPlan(planFile);

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

    // Track if we started parallel agents in this iteration
    const parallelBatchStartIndex = activeAgents.length;

    // Start parallel steps together (batch invocation)
    if (parallel.length > 0) {
      const useWorktree = parallelEnabled && parallel.length > 1;

      // Log all parallel steps as a batch BEFORE starting them
      if (parallel.length > 1) {
        tracker.logParallelStepStart(parallel.map((s) => s.id));
      }

      for (const step of parallel) {
        await startSteps(
          planFile,
          [step.id],
          activeAgents,
          tracker,
          useWorktree,
          parallel.length > 1 // skipLogging for parallel batches
        );
      }
    }

    // Start serial steps individually (no worktrees for serial)
    for (const step of serial) {
      if (
        activeAgents.reduce((sum, a) => sum + a.stepIds.length, 0) >=
        config.concurrency.maxParallel
      ) {
        break;
      }
      await startSteps(planFile, [step.id], activeAgents, tracker, false);
    }

    // If we started any agents, wait for completion
    if (activeAgents.length > 0) {
      // Check if we have parallel agents with worktrees
      const parallelAgents = activeAgents
        .slice(parallelBatchStartIndex)
        .filter((a) => a.worktreeInfo);

      if (parallelAgents.length > 1) {
        // Wait for ALL parallel agents before merging commits
        const results = await waitForAllParallelAgents(
          planFile,
          activeAgents,
          reportsDir,
          tracker
        );
        plan = loadPlan(planFile);
        await mergeWorktreeCommits(results, REPO_ROOT);
      } else {
        // Serial execution: wait for one agent at a time
        const { stepIds, parsedResults } = await waitForAgentCompletion(
          planFile,
          activeAgents,
          reportsDir,
          tracker
        );
        plan = loadPlan(planFile);

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
 * @param {boolean} useWorktree - Whether to use a git worktree for isolation
 */
async function startSteps(
  planFile,
  stepIds,
  activeAgents,
  tracker,
  useWorktree = false,
  skipLogging = false
) {
  // Log step start with progress info (unless skipped for parallel batch)
  if (!skipLogging) {
    tracker.logStepStart(stepIds);
  }

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

  // Determine working directory (worktree or main repo)
  let workingDir = REPO_ROOT;
  let worktreeInfo = null;

  if (useWorktree) {
    const branchName = `worktree-${stepIds.join("-")}-${Date.now()}`;
    const worktreesDir = path.join(REPO_ROOT, ".worktrees");

    // Ensure .worktrees directory exists
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }

    const worktreePath = path.join(worktreesDir, branchName);

    try {
      addWorktree(worktreePath, branchName, "HEAD", REPO_ROOT);
      workingDir = worktreePath;
      worktreeInfo = { path: worktreePath, branch: branchName };
      console.log(`Created worktree for ${stepIds.join(",")}: ${worktreePath}`);
    } catch (err) {
      console.error(`Failed to create worktree: ${err.message}`);
      console.log("Falling back to main repository");
    }
  }

  // Invoke the agent with the condensed plan
  const handle = invokeAgentWithFailover(
    config,
    tempPlanFile,
    stepIds,
    workingDir, // Use worktree path instead of REPO_ROOT when applicable
    {
      timeoutMs: resolveAgentTimeout(),
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

  activeAgents.push({ handle, stepIds, tempPlanFile, worktreeInfo });
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
  const { stepIds, tempPlanFile, worktreeInfo } = activeAgents[index];

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

    let stepReviews = null;
    if (config.review.enabled && stepResult.status === "complete") {
      const maxIterations = resolveReviewMaxIterations();
      if (maxIterations > 0) {
        let approved = false;
        let currentResult = stepResult;
        const originalCommitMessage = stepResult.commitMessage;
        const reviews = [];
        stepReviews = reviews;

        for (let iteration = 1; iteration <= maxIterations; iteration++) {
          console.log(
            `Review iteration ${iteration}/${maxIterations} for step ${stepId}`
          );
          const reviewResult = await invokeReviewAgent(
            config,
            tempPlanFile,
            [stepId],
            REPO_ROOT,
            { stepId, timeoutMs: resolveAgentTimeout() }
          );

          if (reviewResult.error) {
            console.log(
              `[WARN] Review output parse issue for step ${stepId}: ${reviewResult.error}`
            );
          }

          if (reviewResult.approved) {
            console.log(`Review approved for step ${stepId}`);
            reviews.push({
              iteration,
              approved: true,
              feedback: []
            });
            approved = true;
            break;
          }

          const issueCount = reviewResult.feedback.length;
          console.log(
            `Review needs changes for step ${stepId}: ${issueCount} issue(s)`
          );

          for (const fb of reviewResult.feedback) {
            const loc = fb.file
              ? `  ${fb.file}${fb.line ? `:${fb.line}` : ""}`
              : "";
            const sev =
              fb.severity === "blocking" ? "[blocking]" : "[suggestion]";
            console.log(`  ${sev}${loc}: ${fb.comment}`);
          }

          reviews.push({
            iteration,
            approved: false,
            feedback: reviewResult.feedback.map((fb) => ({
              severity: fb.severity,
              file: fb.file || null,
              line: fb.line || null,
              comment: fb.comment
            }))
          });

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
              stepIds: [stepId],
              timeoutMs: resolveAgentTimeout()
            }
          );

          const editedResult =
            editResults.find((r) => r.stepId === stepId) ||
            createDefaultResult(stepId, null, "Edit agent returned no report");
          currentResult = editedResult;
          // Preserve original commit message from execute agent
          if (originalCommitMessage) {
            currentResult.commitMessage = originalCommitMessage;
          }

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
    const reportData = {
      step_id: stepId,
      agent: agentName,
      outcome: stepResult.status === "complete" ? "success" : "failure",
      details: stepResult.summary || "",
      timestamp: new Date().toISOString(),
      artifacts: stepResult.artifacts || [],
      blocked_reason: stepResult.blockedReason || null,
      test_results: stepResult.testResults || null
    };
    if (stepReviews) {
      reportData.reviews = stepReviews;
    }
    reports.push(reportData);
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

  return { stepIds, parsedResults, worktreeInfo };
}

/**
 * Wait for ALL parallel agents to complete
 * @param {string} planFile - Path to the plan file
 * @param {Object[]} activeAgents - Array of active agent handles
 * @param {string} reportsDir - Directory for reports
 * @param {ProgressTracker} tracker - Progress tracker instance
 * @returns {Promise<Object[]>} Array of completed agent results with worktree info
 */
async function waitForAllParallelAgents(
  planFile,
  activeAgents,
  reportsDir,
  tracker
) {
  const completedAgents = [];

  // Wait for all agents to complete
  while (activeAgents.length > 0) {
    const result = await waitForAgentCompletion(
      planFile,
      activeAgents,
      reportsDir,
      tracker
    );
    completedAgents.push(result);
  }

  return completedAgents;
}

/**
 * Merge commits from worktrees back to main repository
 * @param {Object[]} completedAgents - Array of completed agent results
 * @param {string} repoRoot - Path to main repository
 */
async function mergeWorktreeCommits(completedAgents, repoRoot) {
  const allCommits = [];
  const worktreesToClean = [];

  // Collect commits from each worktree
  for (const agent of completedAgents) {
    // Find the worktree info from the active agents state
    // It may be stored in the agent result or we need to track it separately
    if (!agent.worktreeInfo) continue;

    const { path: worktreePath, branch: branchName } = agent.worktreeInfo;
    worktreesToClean.push({ path: worktreePath, branch: branchName });

    try {
      // Get commits made in worktree branch
      const commits = getCommitRange("HEAD", branchName, repoRoot);
      if (commits.length > 0) {
        console.log(
          `Found ${commits.length} commit(s) in worktree ${branchName}`
        );
        allCommits.push(
          ...commits.map((hash) => ({
            hash,
            branch: branchName,
            stepIds: agent.stepIds
          }))
        );
      }
    } catch (err) {
      console.error(
        `Failed to get commits from worktree ${branchName}: ${err.message}`
      );
    }
  }

  // Cherry-pick all commits to main working branch
  if (allCommits.length > 0) {
    console.log(`Merging ${allCommits.length} commit(s) from parallel agents`);

    for (const commitInfo of allCommits) {
      try {
        cherryPick(commitInfo.hash, repoRoot);
        console.log(
          `Cherry-picked ${commitInfo.hash.slice(0, 7)} from ${commitInfo.branch}`
        );
      } catch (err) {
        console.error(
          `Cherry-pick conflict for commit ${commitInfo.hash.slice(0, 7)}: ${err.message}`
        );
        console.error(
          `Steps affected: ${commitInfo.stepIds.join(", ")}. Manual resolution required.`
        );
        // Abort the cherry-pick to leave working tree clean
        cherryPickAbort(repoRoot);
        // Continue with other commits - partial merge is better than none
      }
    }
  }

  // Clean up worktrees
  for (const worktree of worktreesToClean) {
    try {
      removeWorktree(worktree.path, repoRoot);
      deleteBranch(worktree.branch, repoRoot, true);
      console.log(`Cleaned up worktree: ${worktree.branch}`);
    } catch (err) {
      console.error(
        `Failed to clean up worktree ${worktree.branch}: ${err.message}`
      );
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
