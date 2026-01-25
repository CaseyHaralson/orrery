#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");

function readFileOrExit(filePath, label) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`Error: Unable to read ${label} at ${filePath}`);
    console.error(error.message || error);
    process.exit(1);
  }
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

console.log("Release preparation results:\n");
console.log("[Unreleased] entries:\n");
console.log(unreleasedBody.trim());
console.log("\nSuggested version bump:");
console.log(`  Type: ${suggestedType}`);
console.log(`  Reason: ${reason}`);
