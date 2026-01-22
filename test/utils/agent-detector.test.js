const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  detectInstalledAgents,
  getAgentSkillsDir,
} = require("../../lib/utils/agent-detector");
const { createTempDir, cleanupDir } = require("../helpers/test-utils");

// ============================================================================
// detectInstalledAgents tests
// ============================================================================

test("detectInstalledAgents returns empty array when no agents installed", (t) => {
  // Create a temp home directory with no agent dirs
  const tempHome = createTempDir("agent-detector-");
  const originalHomedir = os.homedir;

  // Mock os.homedir
  os.homedir = () => tempHome;

  t.after(() => {
    os.homedir = originalHomedir;
    cleanupDir(tempHome);
  });

  const agents = detectInstalledAgents();

  assert.ok(Array.isArray(agents));
  assert.equal(agents.length, 0);
});

test("detectInstalledAgents detects claude agent", (t) => {
  const tempHome = createTempDir("agent-detector-");
  fs.mkdirSync(path.join(tempHome, ".claude"));

  const originalHomedir = os.homedir;
  os.homedir = () => tempHome;

  t.after(() => {
    os.homedir = originalHomedir;
    cleanupDir(tempHome);
  });

  const agents = detectInstalledAgents();

  assert.ok(agents.includes("claude"));
});

test("detectInstalledAgents detects codex agent", (t) => {
  const tempHome = createTempDir("agent-detector-");
  fs.mkdirSync(path.join(tempHome, ".codex"));

  const originalHomedir = os.homedir;
  os.homedir = () => tempHome;

  t.after(() => {
    os.homedir = originalHomedir;
    cleanupDir(tempHome);
  });

  const agents = detectInstalledAgents();

  assert.ok(agents.includes("codex"));
});

test("detectInstalledAgents detects gemini agent", (t) => {
  const tempHome = createTempDir("agent-detector-");
  fs.mkdirSync(path.join(tempHome, ".gemini"));

  const originalHomedir = os.homedir;
  os.homedir = () => tempHome;

  t.after(() => {
    os.homedir = originalHomedir;
    cleanupDir(tempHome);
  });

  const agents = detectInstalledAgents();

  assert.ok(agents.includes("gemini"));
});

test("detectInstalledAgents detects multiple agents", (t) => {
  const tempHome = createTempDir("agent-detector-");
  fs.mkdirSync(path.join(tempHome, ".claude"));
  fs.mkdirSync(path.join(tempHome, ".codex"));
  fs.mkdirSync(path.join(tempHome, ".gemini"));

  const originalHomedir = os.homedir;
  os.homedir = () => tempHome;

  t.after(() => {
    os.homedir = originalHomedir;
    cleanupDir(tempHome);
  });

  const agents = detectInstalledAgents();

  assert.equal(agents.length, 3);
  assert.ok(agents.includes("claude"));
  assert.ok(agents.includes("codex"));
  assert.ok(agents.includes("gemini"));
});

test("detectInstalledAgents ignores files (not directories)", (t) => {
  const tempHome = createTempDir("agent-detector-");
  // Create a file instead of directory
  fs.writeFileSync(path.join(tempHome, ".claude"), "not a directory");

  const originalHomedir = os.homedir;
  os.homedir = () => tempHome;

  t.after(() => {
    os.homedir = originalHomedir;
    cleanupDir(tempHome);
  });

  const agents = detectInstalledAgents();

  assert.ok(!agents.includes("claude"));
});

// ============================================================================
// getAgentSkillsDir tests
// ============================================================================

test("getAgentSkillsDir returns null for null agent", () => {
  const result = getAgentSkillsDir(null);
  assert.equal(result, null);
});

test("getAgentSkillsDir returns null for undefined agent", () => {
  const result = getAgentSkillsDir(undefined);
  assert.equal(result, null);
});

test("getAgentSkillsDir returns null for unknown agent", () => {
  const result = getAgentSkillsDir("unknown-agent");
  assert.equal(result, null);
});

test("getAgentSkillsDir returns skills path for claude", () => {
  const result = getAgentSkillsDir("claude");
  assert.ok(result.endsWith(path.join(".claude", "skills")));
});

test("getAgentSkillsDir returns skills path for codex", () => {
  const result = getAgentSkillsDir("codex");
  assert.ok(result.endsWith(path.join(".codex", "skills")));
});

test("getAgentSkillsDir returns skills path for gemini", () => {
  const result = getAgentSkillsDir("gemini");
  assert.ok(result.endsWith(path.join(".gemini", "skills")));
});

test("getAgentSkillsDir is case insensitive", () => {
  const lower = getAgentSkillsDir("claude");
  const upper = getAgentSkillsDir("CLAUDE");
  const mixed = getAgentSkillsDir("Claude");

  assert.equal(lower, upper);
  assert.equal(lower, mixed);
});
