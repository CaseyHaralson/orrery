#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");
const packagePath = path.join(repoRoot, "package.json");

function readFileOrExit(filePath, label) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`Error: Unable to read ${label} at ${filePath}`);
    console.error(error.message || error);
    process.exit(1);
  }
}

function normalizeRepoUrl(url) {
  if (!url) return "";
  let normalized = url.trim();
  normalized = normalized.replace(/^git\+/, "");
  normalized = normalized.replace(/\.git$/, "");
  if (normalized.startsWith("git@")) {
    const match = normalized.match(/^git@([^:]+):(.+)$/);
    if (match) {
      normalized = `https://${match[1]}/${match[2]}`;
    }
  }
  return normalized;
}

function extractUnreleased(changelog) {
  const startMarker = "## [Unreleased]";
  const startIdx = changelog.indexOf(startMarker);
  if (startIdx === -1) return null;

  const afterStart = changelog.slice(startIdx + startMarker.length);
  const nextSectionMatch = afterStart.match(/\n## \[/);
  const endIdx = nextSectionMatch ? nextSectionMatch.index : afterStart.length;

  return afterStart.slice(0, endIdx).trim();
}

function findEntryLines(unreleasedBody) {
  const lines = unreleasedBody.split(/\r?\n/);
  return lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^[-*]\s+\S+/.test(trimmed)) return true;
    if (/^\d+\.\s+\S+/.test(trimmed)) return true;
    return false;
  });
}

function detectCategories(unreleasedBody) {
  const lines = unreleasedBody.split(/\r?\n/);
  let hasAdded = false;
  let hasChanged = false;
  let hasFixed = false;
  let hasBreaking = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/breaking/i.test(trimmed)) {
      hasBreaking = true;
    }
    const headingMatch = trimmed.match(/^###\s+(Added|Changed|Fixed)\b/i);
    if (headingMatch) {
      const category = headingMatch[1].toLowerCase();
      if (category === "added") hasAdded = true;
      if (category === "changed") hasChanged = true;
      if (category === "fixed") hasFixed = true;
    }
    const entryMatch = trimmed.match(/^[-*]\s*(Added|Changed|Fixed)\b/i);
    if (entryMatch) {
      const category = entryMatch[1].toLowerCase();
      if (category === "added") hasAdded = true;
      if (category === "changed") hasChanged = true;
      if (category === "fixed") hasFixed = true;
    }
  }

  return { hasAdded, hasChanged, hasFixed, hasBreaking };
}

const changelog = readFileOrExit(changelogPath, "CHANGELOG.md");
const packageJson = readFileOrExit(packagePath, "package.json");
const pkg = JSON.parse(packageJson);

const unreleasedBody = extractUnreleased(changelog);
if (unreleasedBody === null) {
  console.error("Error: Could not find [Unreleased] section in CHANGELOG.md.");
  process.exit(1);
}

const entryLines = findEntryLines(unreleasedBody);
if (entryLines.length === 0) {
  console.error(
    "No release entries found under [Unreleased]. Add changelog entries before preparing a release."
  );
  process.exit(1);
}

const categories = detectCategories(unreleasedBody);
let suggestedType = "patch";
let reason = "Defaulting to patch (no Added/Changed entries detected).";

if (categories.hasBreaking) {
  suggestedType = "major";
  reason = "Detected BREAKING change markers in [Unreleased].";
} else if (categories.hasAdded || categories.hasChanged) {
  suggestedType = "minor";
  reason = "Detected Added/Changed entries in [Unreleased].";
} else if (categories.hasFixed) {
  suggestedType = "patch";
  reason = "Detected Fixed entries only in [Unreleased].";
}

const repoUrl = normalizeRepoUrl(
  typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url
);
const releaseLink = repoUrl
  ? `${repoUrl}/releases/new?tag=vX.Y.Z`
  : "<repo-url>/releases/new?tag=vX.Y.Z";

console.log("Release preparation results:\n");
console.log("Raw [Unreleased] entries:\n");
console.log(unreleasedBody.trim());
console.log("\nSuggested version bump:");
console.log(`- Type: ${suggestedType}`);
console.log(`- Reason: ${reason}`);
console.log("\nNext steps for the release agent:");
console.log("1) Confirm or adjust the suggested version type.");
console.log("2) Create a release branch: git checkout -b release/X.Y.Z");
console.log(
  "3) Update CHANGELOG.md: add empty [Unreleased] section, change old [Unreleased] to [X.Y.Z] - YYYY-MM-DD, update comparison links."
);
console.log(
  "4) Update package.json version field manually (do NOT use npm version)."
);
console.log("5) Commit: git commit -am 'X.Y.Z'");
console.log("6) Push branch and merge via PR.");
console.log("7) After merge: git checkout main && git pull");
console.log("8) Create and push tag: git tag vX.Y.Z && git push --tags");
console.log(`9) Prepare GitHub release: ${releaseLink}`);
console.log("10) Output formatted release notes ready to copy-paste.");
console.log(
  "11) Remind the maintainer to create the GitHub release and run npm publish."
);
