#!/usr/bin/env node

const { execSync } = require("child_process");

/**
 * Git helper functions for branch management and PR creation
 */

/**
 * Execute a git command and return the output
 * @param {string} command - Git command (without 'git' prefix)
 * @param {string} cwd - Working directory
 * @returns {string} - Command output (trimmed)
 */
function git(command, cwd) {
  try {
    return execSync(`git ${command}`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    // Return stderr if available, otherwise throw
    if (error.stderr) {
      throw new Error(`git ${command} failed: ${error.stderr.trim()}`);
    }
    throw error;
  }
}

/**
 * Get the current branch name
 * @param {string} cwd - Working directory
 * @returns {string} - Current branch name
 */
function getCurrentBranch(cwd) {
  return git("rev-parse --abbrev-ref HEAD", cwd);
}

/**
 * Check if a branch exists (locally or remotely)
 * @param {string} branchName - Branch name to check
 * @param {string} cwd - Working directory
 * @returns {boolean} - True if branch exists
 */
function branchExists(branchName, cwd) {
  try {
    git(`rev-parse --verify ${branchName}`, cwd);
    return true;
  } catch {
    // Also check remote
    try {
      git(`rev-parse --verify origin/${branchName}`, cwd);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new branch from current HEAD
 * @param {string} branchName - Name for the new branch
 * @param {string} cwd - Working directory
 */
function createBranch(branchName, cwd) {
  git(`checkout -b ${branchName}`, cwd);
}

/**
 * Switch to an existing branch
 * @param {string} branchName - Branch to switch to
 * @param {string} cwd - Working directory
 */
function checkoutBranch(branchName, cwd) {
  git(`checkout ${branchName}`, cwd);
}

/**
 * Stage and commit changes
 * @param {string} message - Commit message
 * @param {string[]} files - Files to stage (empty array = all changes)
 * @param {string} cwd - Working directory
 * @returns {string} - Commit hash
 */
function commit(message, files, cwd) {
  if (files && files.length > 0) {
    git(`add ${files.map((f) => `"${f}"`).join(" ")}`, cwd);
  } else {
    git("add -A", cwd);
  }

  // Check if there are changes to commit
  try {
    git("diff --cached --quiet", cwd);
    // No changes to commit
    return null;
  } catch {
    // There are changes, proceed with commit
  }

  git(`commit -m "${message.replace(/"/g, '\\"')}"`, cwd);
  return git("rev-parse HEAD", cwd);
}

/**
 * Push current branch to origin
 * @param {string} cwd - Working directory
 * @param {boolean} setUpstream - Whether to set upstream tracking
 */
function push(cwd, setUpstream = true) {
  const branch = getCurrentBranch(cwd);
  if (setUpstream) {
    git(`push -u origin ${branch}`, cwd);
  } else {
    git("push", cwd);
  }
}

/**
 * Get the GitHub repository URL from git remote
 * @param {string} cwd - Working directory
 * @returns {string|null} - GitHub HTTPS URL or null if not found
 */
function getGitHubRepoUrl(cwd) {
  try {
    const remoteUrl = git("remote get-url origin", cwd);
    if (!remoteUrl) return null;

    // Convert SSH or git URLs to HTTPS
    let url = remoteUrl.trim();

    // git@github.com:owner/repo.git -> https://github.com/owner/repo
    if (url.startsWith("git@")) {
      const match = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
      if (match) {
        url = `https://${match[1]}/${match[2]}`;
      }
    }

    // Remove .git suffix
    url = url.replace(/\.git$/, "");

    // Remove git+ prefix
    url = url.replace(/^git\+/, "");

    return url;
  } catch {
    return null;
  }
}

/**
 * Generate PR creation info (URL and details) without requiring gh CLI
 * @param {string} title - PR title
 * @param {string} body - PR body/description
 * @param {string} baseBranch - Target branch for the PR
 * @param {string} cwd - Working directory
 * @returns {{url: string, title: string, body: string, headBranch: string, baseBranch: string, pushed: boolean}} - PR info
 */
function createPullRequest(title, body, baseBranch, cwd) {
  const headBranch = getCurrentBranch(cwd);
  let pushed = false;

  // Try to push the branch
  try {
    push(cwd, true);
    pushed = true;
  } catch {
    // May fail if no remote configured - continue anyway
  }

  const repoUrl = getGitHubRepoUrl(cwd);
  let prUrl = "";

  if (repoUrl) {
    // GitHub PR creation URL format
    const encodedTitle = encodeURIComponent(title);
    const encodedBody = encodeURIComponent(body);
    prUrl = `${repoUrl}/compare/${baseBranch}...${headBranch}?expand=1&title=${encodedTitle}&body=${encodedBody}`;
  }

  return {
    url: prUrl,
    title,
    body,
    headBranch,
    baseBranch,
    pushed
  };
}

/**
 * Check if there are uncommitted changes
 * @param {string} cwd - Working directory
 * @returns {boolean} - True if there are uncommitted changes
 */
function hasUncommittedChanges(cwd) {
  try {
    git("diff --quiet", cwd);
    git("diff --cached --quiet", cwd);
    return false;
  } catch {
    return true;
  }
}

/**
 * Get the diff for uncommitted changes (staged and unstaged)
 * @param {string} cwd - Working directory
 * @param {string[]} [files] - Optional file list to filter diff
 * @returns {string} - Diff output or empty string if none
 */
function getUncommittedDiff(cwd, files) {
  try {
    if (!hasUncommittedChanges(cwd)) {
      return "";
    }

    const fileArgs =
      Array.isArray(files) && files.length > 0
        ? ` -- ${files.map((file) => `"${file}"`).join(" ")}`
        : "";

    const workingTreeDiff = git(`diff${fileArgs}`, cwd);
    const stagedDiff = git(`diff --cached${fileArgs}`, cwd);
    const combined = [workingTreeDiff, stagedDiff].filter(Boolean).join("\n");

    return combined.trim();
  } catch {
    return "";
  }
}

/**
 * Derive a branch name from a plan filename
 * @param {string} planFileName - Plan filename (e.g., "2026-01-11-add-dummy-script.yaml")
 * @returns {string} - Branch name (e.g., "plan/add-dummy-script")
 */
function deriveBranchName(planFileName) {
  // Remove .yaml/.yml extension
  let name = planFileName.replace(/\.ya?ml$/, "");

  // Remove date prefix if present (YYYY-MM-DD-)
  name = name.replace(/^\d{4}-\d{2}-\d{2}-/, "");

  // Sanitize for git branch name
  name = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `plan/${name}`;
}

/**
 * Stash any uncommitted changes
 * @param {string} cwd - Working directory
 * @returns {boolean} - True if changes were stashed
 */
function stash(cwd) {
  if (!hasUncommittedChanges(cwd)) {
    return false;
  }
  git("stash push -m 'orchestrator-auto-stash'", cwd);
  return true;
}

/**
 * Pop the most recent stash
 * @param {string} cwd - Working directory
 */
function stashPop(cwd) {
  try {
    git("stash pop", cwd);
  } catch {
    // No stash to pop or conflict - ignore
  }
}

module.exports = {
  git,
  getCurrentBranch,
  branchExists,
  createBranch,
  checkoutBranch,
  commit,
  push,
  createPullRequest,
  getGitHubRepoUrl,
  hasUncommittedChanges,
  getUncommittedDiff,
  deriveBranchName,
  stash,
  stashPop
};
