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
  assertFileContains,
  assertGitCommits,
  assertReportExists,
  assertReportContains
} = require("../helpers/sandbox");

const PLAN_YAML = fs.readFileSync(
  path.join(__dirname, "..", "fixtures", "plans", "02-serial-chain.yaml"),
  "utf8"
);

test("Scenario 2: serial dependency chain", async (t) => {
  const sandbox = createSandbox("serial-chain");
  t.after(() => destroySandbox(sandbox));

  writePlan(sandbox, "serial-chain-test.yaml", PLAN_YAML);

  const result = await runOrrery(sandbox, [
    "exec",
    "--plan",
    "serial-chain-test.yaml"
  ]);

  assert.equal(
    result.code,
    0,
    `orrery exited with code ${result.code}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
  );

  const plan = loadFinalPlan(sandbox, "serial-chain-test.yaml");
  assertAllStepsComplete(plan);

  // Switch to work branch to see the agent's changes
  checkoutWorkBranch(sandbox, "serial-chain-test.yaml");
  assertFileContains(sandbox, "src/math.js", /divide/i);
  assertFileContains(sandbox, "test/math.test.js", /divide/i);
  assertGitCommits(sandbox, 2);
  assertReportExists(sandbox, "serial-chain-test", "1");
  assertReportExists(sandbox, "serial-chain-test", "2");
  assertReportContains(sandbox, "serial-chain-test", "1", {
    step_id: "1",
    outcome: "success"
  });
  assertReportContains(sandbox, "serial-chain-test", "2", {
    step_id: "2",
    outcome: "success"
  });
});
