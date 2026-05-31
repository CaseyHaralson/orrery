const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const YAML = require("yaml");

const {
  createSandbox,
  destroySandbox,
  writePlan,
  loadFinalPlan,
  runOrrery,
  assertAllStepsComplete,
  assertStepStatus,
  checkoutWorkBranch,
  assertFileContains,
  assertReportExists,
  assertReportContains,
  assertPlanNotArchived
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

test("Scenario 7b: review max iterations blocks unapproved step", async (t) => {
  const sandbox = createSandbox("review-max-blocks");
  const fakeAgent = createFakeCodex(t);
  t.after(() => destroySandbox(sandbox));

  writePlan(sandbox, "review-max-blocks-test.yaml", PLAN_YAML);

  const result = await runOrrery(
    sandbox,
    ["exec", "--plan", "review-max-blocks-test.yaml", "--review"],
    {
      HOME: fakeAgent.home,
      PATH: `${fakeAgent.bin}${path.delimiter}${process.env.PATH || ""}`,
      ORRERY_AGENT_PRIORITY: "codex",
      ORRERY_REVIEW_ENABLED: "true",
      ORRERY_REVIEW_MAX_ITERATIONS: "1"
    }
  );

  assert.equal(
    result.code,
    0,
    `orrery exited with code ${result.code}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
  );
  assert.match(
    result.stdout + result.stderr,
    /Review max iterations reached for step 1\. Blocking step without approval\./
  );

  const plan = loadFinalPlan(sandbox, "review-max-blocks-test.yaml");
  assertStepStatus(plan, "1", "blocked");
  assertPlanNotArchived(sandbox, "review-max-blocks-test.yaml");

  const step = plan.steps.find((s) => s.id === "1");
  assert.equal(
    step.blocked_reason,
    "Review max iterations reached without approval."
  );

  assertReportContains(sandbox, "review-max-blocks-test", "1", {
    outcome: "failure",
    blocked_reason: "Review max iterations reached without approval."
  });

  const report = loadReport(sandbox, "review-max-blocks-test", "1");
  assert.equal(report.reviews.length, 1);
  assert.equal(report.reviews[0].approved, false);
  assert.equal(report.reviews[0].feedback[0].comment, "Still wrong");
});

function createFakeCodex(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-fake-codex-"));
  const home = path.join(root, "home");
  const bin = path.join(root, "bin");
  fs.mkdirSync(path.join(home, ".codex"), { recursive: true });
  fs.mkdirSync(bin, { recursive: true });

  const script = `#!/usr/bin/env node
const prompt = process.argv[process.argv.length - 1] || "";
if (prompt.includes("Review Agent")) {
  console.log(JSON.stringify({
    status: "needs_changes",
    feedback: [{
      comment: "Still wrong",
      file: "src/math.js",
      severity: "blocking"
    }]
  }));
} else {
  console.log(JSON.stringify({
    stepId: "1",
    status: "complete",
    summary: "Fake execution completed",
    artifacts: ["src/math.js"],
    testResults: "not run",
    commitMessage: "test: fake review max iteration"
  }));
}
`;
  const codexPath = path.join(bin, "codex");
  fs.writeFileSync(codexPath, script, "utf8");
  fs.chmodSync(codexPath, 0o755);

  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { home, bin };
}

function loadReport(sandbox, planName, stepId) {
  const reportsDir = path.join(sandbox.workDir, "reports");
  const file = fs
    .readdirSync(reportsDir)
    .find((name) => name.includes(planName) && name.includes(stepId));
  assert.ok(file, `No report found for plan "${planName}" step "${stepId}"`);
  return YAML.parse(fs.readFileSync(path.join(reportsDir, file), "utf8"));
}
