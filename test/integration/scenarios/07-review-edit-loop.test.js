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
  path.join(__dirname, "..", "fixtures", "plans", "07-review-edit-loop.yaml"),
  "utf8"
);

test("Scenario 7: review and edit loop", async (t) => {
  const sandbox = createSandbox("review-edit-loop");
  t.after(() => destroySandbox(sandbox));

  writePlan(sandbox, "review-edit-loop-test.yaml", PLAN_YAML);

  const result = await runOrrery(
    sandbox,
    ["exec", "--plan", "review-edit-loop-test.yaml", "--review"],
    { ORRERY_REVIEW_ENABLED: "true" }
  );

  assert.equal(
    result.code,
    0,
    `orrery exited with code ${result.code}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
  );

  const plan = loadFinalPlan(sandbox, "review-edit-loop-test.yaml");
  assertAllStepsComplete(plan);

  // Switch to work branch to see the agent's changes
  checkoutWorkBranch(sandbox, "review-edit-loop-test.yaml");
  assertFileContains(sandbox, "src/math.js", /modulo/i);
  assertReportExists(sandbox, "review-edit-loop-test", "1");
});
