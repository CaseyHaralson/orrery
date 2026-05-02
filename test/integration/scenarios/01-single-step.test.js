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
  assertReportExists
} = require("../helpers/sandbox");

const PLAN_YAML = fs.readFileSync(
  path.join(__dirname, "..", "fixtures", "plans", "01-single-step.yaml"),
  "utf8"
);

test("Scenario 1: single step execution", async (t) => {
  const sandbox = createSandbox("single-step");
  t.after(() => destroySandbox(sandbox));

  writePlan(sandbox, "single-step-test.yaml", PLAN_YAML);

  const result = await runOrrery(sandbox, [
    "exec",
    "--plan",
    "single-step-test.yaml"
  ]);

  assert.equal(
    result.code,
    0,
    `orrery exited with code ${result.code}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
  );

  const plan = loadFinalPlan(sandbox, "single-step-test.yaml");
  assertAllStepsComplete(plan);

  // Switch to work branch to see the agent's changes
  checkoutWorkBranch(sandbox, "single-step-test.yaml");
  assertFileContains(sandbox, "src/math.js", /divide/i);
  assertReportExists(sandbox, "single-step-test", "1");
});
