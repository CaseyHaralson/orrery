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
      "init",
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
  const result = await runCli(["install-skills", "--dry-run", "--agent", "codex"], {
    env,
  });

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
    GIT_WORK_TREE: gitRepo,
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
    GIT_WORK_TREE: gitRepo,
  };
  const result = await runCli(["exec"], { cwd: projectDir, env });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /No new plans to process/);
});

test("orrery unblock --help shows usage", async () => {
  const result = await runCli(["unblock", "--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Reset blocked steps to pending/);
  assert.match(result.stdout, /--step/);
  assert.match(result.stdout, /--all/);
  assert.match(result.stdout, /--dry-run/);
});

test("orrery unblock without plan shows error when not on work branch", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  const gitRepo = initTempGitRepo();
  t.after(() => {
    cleanupDir(projectDir);
    cleanupDir(gitRepo);
  });

  const result = await runCli(["unblock"], { cwd: gitRepo });
  assert.equal(result.code, 1);
  // Error goes to stderr, usage hint to stdout
  assert.match(result.stderr, /No plan specified/);
});

test("orrery unblock with non-existent plan shows error", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  t.after(() => cleanupDir(projectDir));

  const result = await runCli(["unblock", "non-existent.yaml"], { cwd: projectDir });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Plan not found/);
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

  const result = await runCli(["status", "--plan", "test-plan.yaml"], { cwd: projectDir });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /blocked step-2/);
  assert.match(result.stdout, /Reason: Could not connect to database/);
});

test("orrery unblock shows blocked steps without --all or --step", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  const plansDir = path.join(projectDir, ".agent-work", "plans");
  fs.mkdirSync(plansDir, { recursive: true });

  const planContent = `metadata:
  name: test-plan
steps:
  - id: step-1
    description: First step
    status: complete
  - id: step-2
    description: Second step
    status: blocked
    blocked_reason: API unavailable
`;
  fs.writeFileSync(path.join(plansDir, "test-plan.yaml"), planContent);
  t.after(() => cleanupDir(projectDir));

  const result = await runCli(["unblock", "test-plan.yaml"], { cwd: projectDir });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Blocked steps in test-plan.yaml/);
  assert.match(result.stdout, /step-2/);
  assert.match(result.stdout, /Reason: API unavailable/);
});

test("orrery unblock --all resets blocked steps to pending", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  const plansDir = path.join(projectDir, ".agent-work", "plans");
  fs.mkdirSync(plansDir, { recursive: true });

  const planPath = path.join(plansDir, "test-plan.yaml");
  const planContent = `metadata:
  name: test-plan
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
  fs.writeFileSync(planPath, planContent);
  t.after(() => cleanupDir(projectDir));

  const result = await runCli(["unblock", "test-plan.yaml", "--all"], { cwd: projectDir });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Unblocked 2 step\(s\)/);

  // Verify the plan file was updated
  const updatedContent = fs.readFileSync(planPath, "utf8");
  assert.match(updatedContent, /status: pending/);
  assert.ok(!updatedContent.includes("blocked_reason"));
});

test("orrery unblock --step resets specific step", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  const plansDir = path.join(projectDir, ".agent-work", "plans");
  fs.mkdirSync(plansDir, { recursive: true });

  const planPath = path.join(plansDir, "test-plan.yaml");
  const planContent = `metadata:
  name: test-plan
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
  fs.writeFileSync(planPath, planContent);
  t.after(() => cleanupDir(projectDir));

  const result = await runCli(["unblock", "test-plan.yaml", "--step", "step-1"], { cwd: projectDir });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Unblocked 1 step\(s\)/);
  assert.match(result.stdout, /step-1/);

  // Verify the plan file was updated - step-1 pending, step-2 still blocked
  const updatedContent = fs.readFileSync(planPath, "utf8");
  assert.match(updatedContent, /id: step-2[\s\S]*?status: blocked/);
});

test("orrery unblock --dry-run shows preview without changes", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  const plansDir = path.join(projectDir, ".agent-work", "plans");
  fs.mkdirSync(plansDir, { recursive: true });

  const planPath = path.join(plansDir, "test-plan.yaml");
  const planContent = `metadata:
  name: test-plan
steps:
  - id: step-1
    description: First step
    status: blocked
    blocked_reason: Error 1
`;
  fs.writeFileSync(planPath, planContent);
  t.after(() => cleanupDir(projectDir));

  const result = await runCli(["unblock", "test-plan.yaml", "--all", "--dry-run"], { cwd: projectDir });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Dry run/);
  assert.match(result.stdout, /step-1/);

  // Verify the plan file was NOT changed
  const unchangedContent = fs.readFileSync(planPath, "utf8");
  assert.match(unchangedContent, /status: blocked/);
});

test("orrery unblock reports no blocked steps when plan has none", async (t) => {
  const projectDir = createTempDir("orrery-project-");
  const plansDir = path.join(projectDir, ".agent-work", "plans");
  fs.mkdirSync(plansDir, { recursive: true });

  const planContent = `metadata:
  name: test-plan
steps:
  - id: step-1
    description: First step
    status: complete
`;
  fs.writeFileSync(path.join(plansDir, "test-plan.yaml"), planContent);
  t.after(() => cleanupDir(projectDir));

  const result = await runCli(["unblock", "test-plan.yaml"], { cwd: projectDir });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /No blocked steps/);
});
