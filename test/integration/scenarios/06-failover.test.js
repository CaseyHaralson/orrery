const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createSandbox,
  destroySandbox,
  writePlan,
  loadFinalPlan,
  runOrrery,
  assertAllStepsComplete,
  checkoutWorkBranch,
  assertFileContains
} = require("../helpers/sandbox");

const PLAN_YAML = fs.readFileSync(
  path.join(__dirname, "..", "fixtures", "plans", "06-failover.yaml"),
  "utf8"
);

/**
 * Detect the first available real agent by checking for config directories.
 */
function detectRealAgent() {
  const homeDir = require("node:os").homedir();
  const agents = ["claude", "codex", "gemini"];
  for (const agent of agents) {
    if (fs.existsSync(path.join(homeDir, `.${agent}`))) {
      return agent;
    }
  }
  return null;
}

test("Scenario 6: agent failover from nonexistent to real agent", async (t) => {
  const realAgent = detectRealAgent();
  if (!realAgent) {
    t.skip("No agent CLI detected — skipping failover test");
    return;
  }

  const sandbox = createSandbox("failover");
  t.after(() => destroySandbox(sandbox));

  writePlan(sandbox, "failover-test.yaml", PLAN_YAML);

  // Set priority so a nonexistent agent is tried first, then the real one
  const result = await runOrrery(
    sandbox,
    ["exec", "--plan", "failover-test.yaml"],
    {
      ORRERY_AGENT_PRIORITY: `nonexistent-agent-xyz,${realAgent}`
    }
  );

  assert.equal(
    result.code,
    0,
    `orrery exited with code ${result.code}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
  );

  const plan = loadFinalPlan(sandbox, "failover-test.yaml");
  assertAllStepsComplete(plan);

  // Switch to work branch to see the agent's changes
  checkoutWorkBranch(sandbox, "failover-test.yaml");
  assertFileContains(sandbox, "src/math.js", /divide/i);

  // Verify failover occurred — check for failover-related output
  const output = result.stdout + result.stderr;
  assert.ok(
    /failover|fail.*over|trying next|ENOENT|not found/i.test(output),
    `Expected failover evidence in output but found:\n${output.slice(0, 500)}`
  );
});
