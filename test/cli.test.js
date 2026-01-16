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
