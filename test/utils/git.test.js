const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { execFileSync } = require("node:child_process");

const {
  deriveBranchName,
  getCurrentBranch,
  branchExists,
  hasUncommittedChanges,
  createBranch,
  checkoutBranch,
  commit,
  stash,
  stashPop,
  getGitHubRepoUrl,
  createPullRequest
} = require("../../lib/utils/git");
const { initTempGitRepo, cleanupDir } = require("../helpers/test-utils");

// ============================================================================
// deriveBranchName tests (pure function, no git repo needed)
// ============================================================================

test("deriveBranchName removes .yaml extension", () => {
  const result = deriveBranchName("my-feature.yaml");
  assert.equal(result, "plan/my-feature");
});

test("deriveBranchName removes .yml extension", () => {
  const result = deriveBranchName("my-feature.yml");
  assert.equal(result, "plan/my-feature");
});

test("deriveBranchName removes date prefix", () => {
  const result = deriveBranchName("2026-01-15-add-feature.yaml");
  assert.equal(result, "plan/add-feature");
});

test("deriveBranchName converts to lowercase", () => {
  const result = deriveBranchName("My-Feature.yaml");
  assert.equal(result, "plan/my-feature");
});

test("deriveBranchName sanitizes special characters", () => {
  const result = deriveBranchName("add_feature@v2.yaml");
  assert.equal(result, "plan/add-feature-v2");
});

test("deriveBranchName removes leading/trailing dashes", () => {
  const result = deriveBranchName("-feature-.yaml");
  assert.equal(result, "plan/feature");
});

test("deriveBranchName collapses multiple dashes", () => {
  const result = deriveBranchName("add---multiple---dashes.yaml");
  assert.equal(result, "plan/add-multiple-dashes");
});

// ============================================================================
// getCurrentBranch tests
// ============================================================================

test("getCurrentBranch returns current branch name", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  // Default branch after init is either 'master' or 'main'
  const branch = getCurrentBranch(gitDir);
  assert.ok(branch === "master" || branch === "main");
});

test("getCurrentBranch returns new branch after checkout", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  execFileSync("git", ["checkout", "-b", "test-branch"], {
    cwd: gitDir,
    stdio: "ignore"
  });

  const branch = getCurrentBranch(gitDir);
  assert.equal(branch, "test-branch");
});

// ============================================================================
// branchExists tests
// ============================================================================

test("branchExists returns true for existing local branch", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  execFileSync("git", ["checkout", "-b", "existing-branch"], {
    cwd: gitDir,
    stdio: "ignore"
  });
  execFileSync("git", ["checkout", "-"], { cwd: gitDir, stdio: "ignore" });

  const exists = branchExists("existing-branch", gitDir);
  assert.equal(exists, true);
});

test("branchExists returns false for non-existent branch", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const exists = branchExists("non-existent-branch", gitDir);
  assert.equal(exists, false);
});

// ============================================================================
// hasUncommittedChanges tests
// ============================================================================

test("hasUncommittedChanges returns false for clean repo", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const hasChanges = hasUncommittedChanges(gitDir);
  assert.equal(hasChanges, false);
});

test("hasUncommittedChanges returns true with unstaged changes", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  fs.writeFileSync(path.join(gitDir, "README.md"), "modified content");

  const hasChanges = hasUncommittedChanges(gitDir);
  assert.equal(hasChanges, true);
});

test("hasUncommittedChanges returns true with staged changes", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  fs.writeFileSync(path.join(gitDir, "new-file.txt"), "content");
  execFileSync("git", ["add", "new-file.txt"], {
    cwd: gitDir,
    stdio: "ignore"
  });

  const hasChanges = hasUncommittedChanges(gitDir);
  assert.equal(hasChanges, true);
});

// ============================================================================
// createBranch tests
// ============================================================================

test("createBranch creates and checks out new branch", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  createBranch("new-feature", gitDir);

  const currentBranch = getCurrentBranch(gitDir);
  assert.equal(currentBranch, "new-feature");
});

// ============================================================================
// checkoutBranch tests
// ============================================================================

test("checkoutBranch switches to existing branch", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const originalBranch = getCurrentBranch(gitDir);
  execFileSync("git", ["checkout", "-b", "other-branch"], {
    cwd: gitDir,
    stdio: "ignore"
  });

  checkoutBranch(originalBranch, gitDir);

  const currentBranch = getCurrentBranch(gitDir);
  assert.equal(currentBranch, originalBranch);
});

// ============================================================================
// commit tests
// ============================================================================

test("commit stages and commits all changes", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  fs.writeFileSync(path.join(gitDir, "new-file.txt"), "content");

  const hash = commit("Add new file", [], gitDir);

  assert.ok(hash);
  assert.equal(hash.length, 40); // SHA-1 hash
  assert.equal(hasUncommittedChanges(gitDir), false);
});

test("commit stages specific files when provided", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  fs.writeFileSync(path.join(gitDir, "file1.txt"), "content1");
  fs.writeFileSync(path.join(gitDir, "file2.txt"), "content2");

  const hash = commit("Add file1", ["file1.txt"], gitDir);

  assert.ok(hash);
  // file2.txt should still be untracked
  const status = execFileSync("git", ["status", "--porcelain"], {
    cwd: gitDir,
    encoding: "utf8"
  });
  assert.ok(status.includes("file2.txt"));
});

test("commit returns null when no changes to commit", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const hash = commit("No changes", [], gitDir);

  assert.equal(hash, null);
});

// ============================================================================
// stash tests
// ============================================================================

test("stash returns false when no changes to stash", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const stashed = stash(gitDir);

  assert.equal(stashed, false);
});

test("stash returns true and stashes changes", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  fs.writeFileSync(path.join(gitDir, "README.md"), "modified");

  const stashed = stash(gitDir);

  assert.equal(stashed, true);
  assert.equal(hasUncommittedChanges(gitDir), false);
});

// ============================================================================
// stashPop tests
// ============================================================================

test("stashPop restores stashed changes", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  fs.writeFileSync(path.join(gitDir, "README.md"), "modified");
  stash(gitDir);
  assert.equal(hasUncommittedChanges(gitDir), false);

  stashPop(gitDir);

  assert.equal(hasUncommittedChanges(gitDir), true);
});

test("stashPop handles empty stash gracefully", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  // Should not throw
  stashPop(gitDir);
});

// ============================================================================
// getGitHubRepoUrl tests
// ============================================================================

test("getGitHubRepoUrl returns null when no remote", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const url = getGitHubRepoUrl(gitDir);
  assert.equal(url, null);
});

test("getGitHubRepoUrl converts SSH URL to HTTPS", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  execFileSync(
    "git",
    ["remote", "add", "origin", "git@github.com:user/repo.git"],
    {
      cwd: gitDir,
      stdio: "ignore"
    }
  );

  const url = getGitHubRepoUrl(gitDir);
  assert.equal(url, "https://github.com/user/repo");
});

test("getGitHubRepoUrl handles HTTPS URL", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  execFileSync(
    "git",
    ["remote", "add", "origin", "https://github.com/user/repo.git"],
    {
      cwd: gitDir,
      stdio: "ignore"
    }
  );

  const url = getGitHubRepoUrl(gitDir);
  assert.equal(url, "https://github.com/user/repo");
});

test("getGitHubRepoUrl removes git+ prefix", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  execFileSync(
    "git",
    ["remote", "add", "origin", "git+https://github.com/user/repo.git"],
    {
      cwd: gitDir,
      stdio: "ignore"
    }
  );

  const url = getGitHubRepoUrl(gitDir);
  assert.equal(url, "https://github.com/user/repo");
});

// ============================================================================
// createPullRequest tests
// ============================================================================

test("createPullRequest returns PR info object", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const prInfo = createPullRequest("Test PR", "PR body", "main", gitDir);

  assert.equal(typeof prInfo, "object");
  assert.equal(prInfo.title, "Test PR");
  assert.equal(prInfo.body, "PR body");
  assert.equal(prInfo.baseBranch, "main");
  assert.ok(prInfo.headBranch); // Current branch
  assert.equal(prInfo.pushed, false); // No remote configured
  assert.equal(prInfo.url, ""); // No remote URL
});

test("createPullRequest generates URL when remote configured", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  execFileSync(
    "git",
    ["remote", "add", "origin", "https://github.com/user/repo.git"],
    {
      cwd: gitDir,
      stdio: "ignore"
    }
  );

  const prInfo = createPullRequest("Test PR", "PR body", "main", gitDir);

  assert.ok(
    prInfo.url.startsWith("https://github.com/user/repo/compare/main...")
  );
  assert.ok(prInfo.url.includes("title=Test%20PR"));
  assert.ok(prInfo.url.includes("body=PR%20body"));
});

test("createPullRequest URL-encodes special characters in title and body", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  execFileSync(
    "git",
    ["remote", "add", "origin", "https://github.com/user/repo.git"],
    {
      cwd: gitDir,
      stdio: "ignore"
    }
  );

  const prInfo = createPullRequest(
    "Add & fix",
    "Line 1\nLine 2",
    "main",
    gitDir
  );

  assert.ok(prInfo.url.includes("title=Add%20%26%20fix"));
  assert.ok(prInfo.url.includes("body=Line%201%0ALine%202"));
});
