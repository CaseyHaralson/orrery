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
  assertStepStatus
} = require("../helpers/sandbox");

const PLAN_YAML = fs.readFileSync(
  path.join(__dirname, "..", "fixtures", "plans", "04-blocked-step.yaml"),
  "utf8"
);

test("Scenario 4: step blocks on impossible requirement", async (t) => {
  const sandbox = createSandbox("blocked-step");
  t.after(() => destroySandbox(sandbox));

  writePlan(sandbox, "blocked-step-test.yaml", PLAN_YAML);

  // Plan should complete (exit 0) even when a step blocks — blocking is a
  // valid terminal state, not an orchestrator failure.
  await runOrrery(sandbox, ["exec", "--plan", "blocked-step-test.yaml"]);

  const plan = loadFinalPlan(sandbox, "blocked-step-test.yaml");
  assertStepStatus(plan, "1", "blocked");

  const step = plan.steps.find((s) => s.id === "1");
  assert.ok(step.blocked_reason, 'Expected step "1" to have a blocked_reason');
});
