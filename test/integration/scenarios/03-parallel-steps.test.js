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
  path.join(__dirname, "..", "fixtures", "plans", "03-parallel-steps.yaml"),
  "utf8"
);

test("Scenario 3: parallel step execution", async (t) => {
  const sandbox = createSandbox("parallel-steps");
  t.after(() => destroySandbox(sandbox));

  writePlan(sandbox, "parallel-steps-test.yaml", PLAN_YAML);

  const result = await runOrrery(
    sandbox,
    ["exec", "--plan", "parallel-steps-test.yaml", "--parallel"],
    {
      ORRERY_PARALLEL_ENABLED: "true",
      ORRERY_PARALLEL_MAX: "2"
    }
  );

  assert.equal(
    result.code,
    0,
    `orrery exited with code ${result.code}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
  );

  const plan = loadFinalPlan(sandbox, "parallel-steps-test.yaml");
  assertAllStepsComplete(plan);

  // Switch to work branch to see the agent's changes
  checkoutWorkBranch(sandbox, "parallel-steps-test.yaml");
  assertFileContains(sandbox, "src/string-utils.js", /padLeft/i);
  assertFileContains(sandbox, "src/math.js", /divide/i);
  assertReportExists(sandbox, "parallel-steps-test", "1");
  assertReportExists(sandbox, "parallel-steps-test", "2");
});
