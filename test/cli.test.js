const assert = require("node:assert/strict");
const { execFile, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const binPath = path.join(repoRoot, "bin", "orrery.js");
const pkg = require(path.join(repoRoot, "package.json"));

function runCli(args, options = {}) {
  return new Promise((resolve) => {
    const execOptions = { encoding: "utf8", ...options };
    execFile(
      process.execPath,
      [binPath, ...args],
      execOptions,
      (error, stdout, stderr) => {
        const code =
          error && typeof error.code === "number" ? error.code : error ? 1 : 0;
        resolve({ code, stdout: stdout || "", stderr: stderr || "" });
      }
    );
  });
}

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function initTempGitRepo() {
  const gitDir = createTempDir("orrery-git-");
  execFileSync("git", ["init"], { cwd: gitDir, stdio: "ignore" });
  fs.writeFileSync(path.join(gitDir, "README.md"), "test\n");
  execFileSync("git", ["add", "."], { cwd: gitDir, stdio: "ignore" });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Orrery Test",
      "-c",
      "user.email=orrery@example.com",
      "commit",
      "-m",
      "init"
    ],
    { cwd: gitDir, stdio: "ignore" }
  );
  return gitDir;
}

test("orrery --help shows usage", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage: orrery/);
});

test("orrery --version shows package version", async () => {
  const result = await runCli(["--version"]);
  assert.equal(result.code, 0);
  assert.equal(result.stdout.trim(), pkg.version);
});

test("orrery install-skills --dry-run lists files", async (t) => {
  const homeDir = createTempDir("orrery-home-");
  fs.mkdirSync(path.join(homeDir, ".codex"), { recursive: true });
  t.after(() => cleanupDir(homeDir));

  const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
  const result = await runCli(
    ["install-skills", "--dry-run", "--agent", "codex"],
    {
      env
    }
  );

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Dry run enabled/);
  assert.match(result.stdout, /\[dry-run\] copy/);
});

test("orrery status shows no plans for empty project", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  t.after(() => cleanupDir(projectDir));

  const result = await runCli(["status"], { cwd: projectDir });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /No plans found/);
});

test("orrery orchestrate exits cleanly with no plans", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  const gitRepo = initTempGitRepo();
  t.after(() => {
    cleanupDir(projectDir);
    cleanupDir(gitRepo);
  });

  const env = {
    ...process.env,
    GIT_DIR: path.join(gitRepo, ".git"),
    GIT_WORK_TREE: gitRepo
  };
  const result = await runCli(["orchestrate"], { cwd: projectDir, env });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /No new plans to process/);
});

test("orrery exec alias works", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  const gitRepo = initTempGitRepo();
  t.after(() => {
    cleanupDir(projectDir);
    cleanupDir(gitRepo);
  });

  const env = {
    ...process.env,
    GIT_DIR: path.join(gitRepo, ".git"),
    GIT_WORK_TREE: gitRepo
  };
  const result = await runCli(["exec"], { cwd: projectDir, env });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /No new plans to process/);
});

test("orrery resume --help shows usage", async () => {
  const result = await runCli(["resume", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Unblock steps and resume orchestration/);
  assert.match(result.stdout, /--step/);
  assert.match(result.stdout, /--dry-run/);
});

test("orrery resume shows error when not on work branch", async (t) => {
  const gitRepo = initTempGitRepo();
  t.after(() => {
    cleanupDir(gitRepo);
  });

  const result = await runCli(["resume"], { cwd: gitRepo });
  assert.equal(result.code, 1);
  // Error goes to stderr
  assert.match(result.stderr, /Not on a work branch/);
});

test("orrery status shows blocked reason for blocked steps", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  const plansDir = path.join(projectDir, ".agent-work", "plans");
  fs.mkdirSync(plansDir, { recursive: true });

  // Create a plan with a blocked step
  const planContent = `metadata:
  name: test-plan
steps:
  - id: step-1
    description: First step
    status: complete
  - id: step-2
    description: Second step
    status: blocked
    blocked_reason: Could not connect to database
  - id: step-3
    description: Third step
    status: pending
`;
  fs.writeFileSync(path.join(plansDir, "test-plan.yaml"), planContent);
  t.after(() => cleanupDir(projectDir));

  const result = await runCli(["status", "--plan", "test-plan.yaml"], {
    cwd: projectDir
  });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /blocked step-2/);
  assert.match(result.stdout, /Reason: Could not connect to database/);
});

// Helper to create a git repo on a specific branch with a plan
function initGitRepoWithPlan(branchName, planContent) {
  const gitDir = createTempDir("orrery-git-");
  execFileSync("git", ["init"], { cwd: gitDir, stdio: "ignore" });
  fs.writeFileSync(path.join(gitDir, "README.md"), "test\n");
  execFileSync("git", ["add", "."], { cwd: gitDir, stdio: "ignore" });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Orrery Test",
      "-c",
      "user.email=orrery@example.com",
      "commit",
      "-m",
      "init"
    ],
    { cwd: gitDir, stdio: "ignore" }
  );

  // Create and checkout the work branch
  execFileSync("git", ["checkout", "-b", branchName], {
    cwd: gitDir,
    stdio: "ignore"
  });

  // Create the plan directory and file
  const plansDir = path.join(gitDir, ".agent-work", "plans");
  fs.mkdirSync(plansDir, { recursive: true });
  const planPath = path.join(plansDir, "test-plan.yaml");
  fs.writeFileSync(planPath, planContent);

  // Stage and commit the plan
  execFileSync("git", ["add", "."], { cwd: gitDir, stdio: "ignore" });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Orrery Test",
      "-c",
      "user.email=orrery@example.com",
      "commit",
      "-m",
      "add plan"
    ],
    { cwd: gitDir, stdio: "ignore" }
  );

  return { gitDir, planPath, plansDir };
}

test("orrery resume --dry-run shows blocked steps preview", async (t) => {
  const planContent = `metadata:
  name: test-plan
  work_branch: plan/test-feature
steps:
  - id: step-1
    description: First step
    status: complete
  - id: step-2
    description: Second step
    status: blocked
    blocked_reason: API unavailable
`;
  const { gitDir, planPath } = initGitRepoWithPlan(
    "plan/test-feature",
    planContent
  );
  t.after(() => cleanupDir(gitDir));

  const result = await runCli(["resume", "--dry-run"], { cwd: gitDir });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /detected plan: test-plan.yaml/);
  assert.match(result.stdout, /Dry run/);
  assert.match(result.stdout, /step-2/);
  assert.match(result.stdout, /was blocked: API unavailable/);

  // Verify the plan file was NOT changed
  const unchangedContent = fs.readFileSync(planPath, "utf8");
  assert.match(unchangedContent, /status: blocked/);
});

test("orrery resume --step unblocks specific step in dry-run", async (t) => {
  const planContent = `metadata:
  name: test-plan
  work_branch: plan/test-feature
steps:
  - id: step-1
    description: First step
    status: blocked
    blocked_reason: Error 1
  - id: step-2
    description: Second step
    status: blocked
    blocked_reason: Error 2
`;
  const { gitDir, planPath } = initGitRepoWithPlan(
    "plan/test-feature",
    planContent
  );
  t.after(() => cleanupDir(gitDir));

  const result = await runCli(["resume", "--step", "step-1", "--dry-run"], {
    cwd: gitDir
  });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Dry run/);
  assert.match(result.stdout, /step-1/);
  // Should not mention step-2
  assert.ok(!result.stdout.includes("step-2"));

  // Verify the plan file was NOT changed
  const unchangedContent = fs.readFileSync(planPath, "utf8");
  assert.match(unchangedContent, /status: blocked/);
});

test("orrery resume with invalid --step shows error", async (t) => {
  const planContent = `metadata:
  name: test-plan
  work_branch: plan/test-feature
steps:
  - id: step-1
    description: First step
    status: blocked
    blocked_reason: Error 1
`;
  const { gitDir } = initGitRepoWithPlan("plan/test-feature", planContent);
  t.after(() => cleanupDir(gitDir));

  const result = await runCli(["resume", "--step", "non-existent"], {
    cwd: gitDir
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Step "non-existent" is not blocked/);
});

test("orrery resume with no blocked steps shows message and would resume", async (t) => {
  const planContent = `metadata:
  name: test-plan
  work_branch: plan/test-feature
steps:
  - id: step-1
    description: First step
    status: complete
`;
  const { gitDir } = initGitRepoWithPlan("plan/test-feature", planContent);
  t.after(() => cleanupDir(gitDir));

  const result = await runCli(["resume", "--dry-run"], { cwd: gitDir });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /No blocked steps to unblock/);
  assert.match(result.stdout, /Dry run: would resume orchestration/);
});
