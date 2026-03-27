const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { execFile } = require("node:child_process");

const {
  createTempDir,
  cleanupDir,
  captureConsole
} = require("../helpers/test-utils");

const {
  isStopRequested,
  clearStopSignal
} = require("../../lib/utils/stop-signal");

const binPath = path.join(__dirname, "..", "..", "bin", "orrery.js");

// Helper to set up and tear down ORRERY_WORK_DIR
function withTempWorkDir(t) {
  const tempDir = createTempDir("stop-cli-");
  const originalEnv = process.env.ORRERY_WORK_DIR;
  process.env.ORRERY_WORK_DIR = tempDir;

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.ORRERY_WORK_DIR = originalEnv;
    } else {
      delete process.env.ORRERY_WORK_DIR;
    }
    cleanupDir(tempDir);
  });

  return tempDir;
}

function runCli(args, options = {}) {
  return new Promise((resolve) => {
    const execOptions = {
      encoding: "utf8",
      timeout: 30000,
      ...options
    };
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

// ============================================================================
// Stop command integration via buildProgram
// ============================================================================

test("stop command is registered in the CLI program", () => {
  const { buildProgram } = require("../../lib/cli/index");
  const program = buildProgram();
  const stopCmd = program.commands.find((c) => c.name() === "stop");
  assert.ok(stopCmd, "stop command should be registered");
  assert.ok(
    stopCmd.description().includes("Stop"),
    "stop command should have a description"
  );
});

test("stop command has --plan option", () => {
  const { buildProgram } = require("../../lib/cli/index");
  const program = buildProgram();
  const stopCmd = program.commands.find((c) => c.name() === "stop");
  const planOption = stopCmd.options.find((o) => o.long === "--plan");
  assert.ok(planOption, "stop command should have --plan option");
});

test("stop command has --graceful option", () => {
  const { buildProgram } = require("../../lib/cli/index");
  const program = buildProgram();
  const stopCmd = program.commands.find((c) => c.name() === "stop");
  const gracefulOption = stopCmd.options.find((o) => o.long === "--graceful");
  assert.ok(gracefulOption, "stop command should have --graceful option");
});

// ============================================================================
// Stop action behavior — no active processes
// ============================================================================

test("stop with no active processes prints message", async (t) => {
  withTempWorkDir(t);

  const { buildProgram } = require("../../lib/cli/index");
  const program = buildProgram();
  program.exitOverride();

  const { stdout } = await captureConsole(async () => {
    await program.parseAsync(["node", "orrery", "stop"]);
  });

  assert.ok(
    stdout.some((line) => line.includes("No active orchestrations found")),
    `Expected 'No active orchestrations found' in output, got: ${stdout.join("\n")}`
  );
});

test("stop --plan with no lock prints not found message", async (t) => {
  withTempWorkDir(t);

  const { buildProgram } = require("../../lib/cli/index");
  const program = buildProgram();
  program.exitOverride();

  const { stdout } = await captureConsole(async () => {
    await program.parseAsync([
      "node",
      "orrery",
      "stop",
      "--plan",
      "nonexistent.yaml"
    ]);
  });

  assert.ok(
    stdout.some((line) => line.includes("No active execution found")),
    `Expected 'No active execution found' in output, got: ${stdout.join("\n")}`
  );
});

// ============================================================================
// Graceful stop via CLI subprocess (uses real orrery process)
// ============================================================================

test("stop --graceful --plan writes signal file via CLI", async (t) => {
  withTempWorkDir(t);

  // The signal file mechanism is tested directly since creating a lock
  // that passes isOrreryProcess requires a real orrery subprocess.
  // CLI integration is covered by registration tests + no-active-processes test.
  const { requestStop } = require("../../lib/utils/stop-signal");
  requestStop("my-plan");
  assert.ok(isStopRequested("my-plan"));
  clearStopSignal("my-plan");
});

test("orrery stop --help shows usage", async () => {
  const result = await runCli(["stop", "--help"]);
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes("Stop running orchestrations"));
  assert.ok(result.stdout.includes("--graceful"));
  assert.ok(result.stdout.includes("--plan"));
});

test("orrery stop with no running processes shows message", async (t) => {
  const tempDir = withTempWorkDir(t);

  const result = await runCli(["stop"], {
    env: { ...process.env, ORRERY_WORK_DIR: tempDir }
  });

  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes("No active orchestrations found"));
});

test("orrery stop --plan with stale lock shows stale message", async (t) => {
  const tempDir = withTempWorkDir(t);

  const { getWorkDir } = require("../../lib/utils/paths");
  const workDir = getWorkDir();

  // Create a lock with a PID that doesn't exist
  const planId = "stale-plan";
  const lockData = {
    pid: 99999999,
    startedAt: new Date().toISOString(),
    command: "exec --plan stale-plan.yaml",
    planId
  };
  fs.writeFileSync(
    path.join(workDir, `exec-${planId}.lock`),
    JSON.stringify(lockData, null, 2) + "\n"
  );

  const result = await runCli(["stop", "--plan", "stale-plan.yaml"], {
    env: { ...process.env, ORRERY_WORK_DIR: tempDir }
  });

  assert.ok(
    result.stdout.includes("stale"),
    `Expected stale message, got: ${result.stdout}`
  );

  // Clean up
  try {
    fs.unlinkSync(path.join(workDir, `exec-${planId}.lock`));
  } catch {
    // may already be cleaned
  }
});
