const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { execFileSync } = require("node:child_process");

const {
  deriveBranchName,
  derivePlanId,
  getCurrentBranch,
  branchExists,
  hasUncommittedChanges,
  createBranch,
  checkoutBranch,
  commit,
  stash,
  stashPop,
  getGitHubRepoUrl,
  createPullRequest,
  addWorktree,
  addWorktreeExistingBranch,
  removeWorktree,
  listWorktrees,
  getMainRepoRoot,
  getCommitRange,
  cherryPick,
  cherryPickAbort,
  deleteBranch
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

  // Get original branch name before creating test branch
  const originalBranch = getCurrentBranch(gitDir);
  execFileSync("git", ["checkout", "-b", "existing-branch"], {
    cwd: gitDir,
    stdio: "ignore"
  });
  // Use explicit branch name instead of "checkout -" which depends on reflog state
  execFileSync("git", ["checkout", originalBranch], {
    cwd: gitDir,
    stdio: "ignore"
  });

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

// ============================================================================
// addWorktree tests
// ============================================================================

test("addWorktree creates worktree at specified path", (t) => {
  const gitDir = initTempGitRepo();
  const worktreePath = path.join(path.dirname(gitDir), "worktree-test");
  t.after(() => {
    cleanupDir(worktreePath);
    cleanupDir(gitDir);
  });

  addWorktree(worktreePath, "worktree-branch", "HEAD", gitDir);

  assert.ok(fs.existsSync(worktreePath));
  assert.ok(fs.existsSync(path.join(worktreePath, ".git")));
});

test("addWorktree creates branch in worktree", (t) => {
  const gitDir = initTempGitRepo();
  const worktreePath = path.join(path.dirname(gitDir), "worktree-test");
  t.after(() => {
    cleanupDir(worktreePath);
    cleanupDir(gitDir);
  });

  addWorktree(worktreePath, "worktree-branch", "HEAD", gitDir);

  const branch = getCurrentBranch(worktreePath);
  assert.equal(branch, "worktree-branch");
});

// ============================================================================
// removeWorktree tests
// ============================================================================

test("removeWorktree removes existing worktree", (t) => {
  const gitDir = initTempGitRepo();
  const worktreePath = path.join(path.dirname(gitDir), "worktree-test");
  t.after(() => cleanupDir(gitDir));

  addWorktree(worktreePath, "worktree-branch", "HEAD", gitDir);
  assert.ok(fs.existsSync(worktreePath));

  removeWorktree(worktreePath, gitDir);

  assert.ok(!fs.existsSync(worktreePath));
});

test("removeWorktree handles non-existent worktree gracefully", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const nonExistentPath = path.join(path.dirname(gitDir), "non-existent");

  // Should not throw
  removeWorktree(nonExistentPath, gitDir);
});

// ============================================================================
// listWorktrees tests
// ============================================================================

test("listWorktrees returns main worktree", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const worktrees = listWorktrees(gitDir);

  assert.ok(worktrees.length >= 1);
  assert.ok(worktrees[0].worktree);
});

test("listWorktrees includes added worktrees", (t) => {
  const gitDir = initTempGitRepo();
  const worktreePath = path.join(path.dirname(gitDir), "worktree-test");
  t.after(() => {
    cleanupDir(worktreePath);
    cleanupDir(gitDir);
  });

  addWorktree(worktreePath, "worktree-branch", "HEAD", gitDir);

  const worktrees = listWorktrees(gitDir);

  assert.equal(worktrees.length, 2);
  const worktreePaths = worktrees.map((w) => w.worktree);
  assert.ok(worktreePaths.includes(worktreePath));
});

// ============================================================================
// getCommitRange tests
// ============================================================================

test("getCommitRange returns empty array for same ref", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const commits = getCommitRange("HEAD", "HEAD", gitDir);

  assert.deepEqual(commits, []);
});

test("getCommitRange returns commits between refs", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const originalBranch = getCurrentBranch(gitDir);

  // Create a new branch with commits
  createBranch("feature-branch", gitDir);
  fs.writeFileSync(path.join(gitDir, "file1.txt"), "content1");
  commit("First commit", [], gitDir);
  fs.writeFileSync(path.join(gitDir, "file2.txt"), "content2");
  commit("Second commit", [], gitDir);

  const commits = getCommitRange(originalBranch, "feature-branch", gitDir);

  assert.equal(commits.length, 2);
  assert.ok(commits[0].length === 40); // SHA-1 hash
  assert.ok(commits[1].length === 40);
});

// ============================================================================
// cherryPick tests
// ============================================================================

test("cherryPick applies commit to current branch", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const originalBranch = getCurrentBranch(gitDir);

  // Create a commit on a feature branch
  createBranch("feature-branch", gitDir);
  fs.writeFileSync(path.join(gitDir, "new-file.txt"), "content");
  const commitHash = commit("Add new file", [], gitDir);

  // Go back to original branch and cherry-pick
  checkoutBranch(originalBranch, gitDir);
  assert.ok(!fs.existsSync(path.join(gitDir, "new-file.txt")));

  cherryPick(commitHash, gitDir);

  assert.ok(fs.existsSync(path.join(gitDir, "new-file.txt")));
});

test("cherryPick throws on conflict", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const originalBranch = getCurrentBranch(gitDir);

  // Create conflicting changes on two branches
  fs.writeFileSync(path.join(gitDir, "conflict.txt"), "original");
  commit("Original file", [], gitDir);

  createBranch("feature-branch", gitDir);
  fs.writeFileSync(path.join(gitDir, "conflict.txt"), "feature change");
  const featureCommit = commit("Feature change", [], gitDir);

  checkoutBranch(originalBranch, gitDir);
  fs.writeFileSync(path.join(gitDir, "conflict.txt"), "main change");
  commit("Main change", [], gitDir);

  assert.throws(() => cherryPick(featureCommit, gitDir));
});

// ============================================================================
// cherryPickAbort tests
// ============================================================================

test("cherryPickAbort handles no cherry-pick in progress gracefully", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  // Should not throw
  cherryPickAbort(gitDir);
});

// ============================================================================
// deleteBranch tests
// ============================================================================

test("deleteBranch removes local branch", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const originalBranch = getCurrentBranch(gitDir);
  createBranch("to-delete", gitDir);
  checkoutBranch(originalBranch, gitDir);

  assert.ok(branchExists("to-delete", gitDir));

  deleteBranch("to-delete", gitDir);

  assert.ok(!branchExists("to-delete", gitDir));
});

test("deleteBranch with force removes unmerged branch", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const originalBranch = getCurrentBranch(gitDir);
  createBranch("unmerged-branch", gitDir);
  fs.writeFileSync(path.join(gitDir, "unmerged.txt"), "content");
  commit("Unmerged commit", [], gitDir);
  checkoutBranch(originalBranch, gitDir);

  deleteBranch("unmerged-branch", gitDir, true);

  assert.ok(!branchExists("unmerged-branch", gitDir));
});

// ============================================================================
// derivePlanId tests (pure function, no git repo needed)
// ============================================================================

test("derivePlanId strips date prefix and extension", () => {
  const result = derivePlanId("2026-01-15-add-feature.yaml");
  assert.equal(result, "add-feature");
});

test("derivePlanId strips extension only", () => {
  const result = derivePlanId("my-feature.yaml");
  assert.equal(result, "my-feature");
});

test("derivePlanId handles .yml extension", () => {
  const result = derivePlanId("my-feature.yml");
  assert.equal(result, "my-feature");
});

test("derivePlanId sanitizes special characters", () => {
  const result = derivePlanId("add_feature@v2.yaml");
  assert.equal(result, "add-feature-v2");
});

test("derivePlanId converts to lowercase", () => {
  const result = derivePlanId("My-Feature.yaml");
  assert.equal(result, "my-feature");
});

test("derivePlanId collapses multiple dashes", () => {
  const result = derivePlanId("add---multiple---dashes.yaml");
  assert.equal(result, "add-multiple-dashes");
});

// ============================================================================
// getMainRepoRoot tests
// ============================================================================

test("getMainRepoRoot returns main worktree path", (t) => {
  const gitDir = initTempGitRepo();
  t.after(() => cleanupDir(gitDir));

  const root = getMainRepoRoot(gitDir);
  assert.equal(root, gitDir);
});

test("getMainRepoRoot returns main repo from linked worktree", (t) => {
  const gitDir = initTempGitRepo();
  const worktreePath = path.join(path.dirname(gitDir), "wt-main-root");
  t.after(() => {
    cleanupDir(worktreePath);
    cleanupDir(gitDir);
  });

  addWorktree(worktreePath, "wt-branch", "HEAD", gitDir);

  const root = getMainRepoRoot(worktreePath);
  assert.equal(root, gitDir);
});

// ============================================================================
// addWorktreeExistingBranch tests
// ============================================================================

test("addWorktreeExistingBranch checks out existing branch", (t) => {
  const gitDir = initTempGitRepo();
  const worktreePath = path.join(path.dirname(gitDir), "wt-existing");
  t.after(() => {
    cleanupDir(worktreePath);
    cleanupDir(gitDir);
  });

  // Create a branch first
  const originalBranch = getCurrentBranch(gitDir);
  createBranch("existing-branch", gitDir);
  checkoutBranch(originalBranch, gitDir);

  addWorktreeExistingBranch(worktreePath, "existing-branch", gitDir);

  assert.ok(fs.existsSync(worktreePath));
  const branch = getCurrentBranch(worktreePath);
  assert.equal(branch, "existing-branch");
});

test("addWorktreeExistingBranch throws for non-existent branch", (t) => {
  const gitDir = initTempGitRepo();
  const worktreePath = path.join(path.dirname(gitDir), "wt-noexist");
  t.after(() => cleanupDir(gitDir));

  assert.throws(() => {
    addWorktreeExistingBranch(worktreePath, "no-such-branch", gitDir);
  });
});
