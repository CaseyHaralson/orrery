const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const YAML = require("yaml");

const {
  createSandbox,
  destroySandbox,
  writePlan,
  loadFinalPlan,
  runOrrery,
  assertStepStatus,
  checkoutWorkBranch,
  assertFileContains
} = require("../helpers/sandbox");

const PLAN_YAML = fs.readFileSync(
  path.join(__dirname, "..", "fixtures", "plans", "05-resume-after-block.yaml"),
  "utf8"
);

test("Scenario 5: resume after blocked step", async (t) => {
  const sandbox = createSandbox("resume-after-block");
  t.after(() => destroySandbox(sandbox));

  writePlan(sandbox, "resume-after-block-test.yaml", PLAN_YAML);

  // Phase 1: run exec — step 1 should block, step 2 stays pending
  const execResult = await runOrrery(sandbox, [
    "exec",
    "--plan",
    "resume-after-block-test.yaml"
  ]);

  assert.equal(
    execResult.code,
    0,
    `exec exited with code ${execResult.code}:\nstdout: ${execResult.stdout}\nstderr: ${execResult.stderr}`
  );

  const planAfterExec = loadFinalPlan(sandbox, "resume-after-block-test.yaml");
  assertStepStatus(planAfterExec, "1", "blocked");
  assertStepStatus(planAfterExec, "2", "pending");

  // Phase 2: programmatically unblock step 1 by setting it to complete
  const planPath = path.join(
    sandbox.workDir,
    "plans",
    "resume-after-block-test.yaml"
  );
  const planContent = YAML.parse(fs.readFileSync(planPath, "utf8"));
  const step1 = planContent.steps.find((s) => s.id === "1");
  step1.status = "complete";
  delete step1.blocked_reason;
  fs.writeFileSync(planPath, YAML.stringify(planContent), "utf8");

  // Commit the unblock so orrery doesn't complain about uncommitted changes
  execFileSync("git", ["add", ".agent-work/"], {
    cwd: sandbox.dir,
    stdio: "ignore"
  });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Integration Test",
      "-c",
      "user.email=test@orrery.dev",
      "commit",
      "-m",
      "chore: unblock step 1"
    ],
    { cwd: sandbox.dir, stdio: "ignore" }
  );

  // Resume — step 2 should now execute
  const resumeResult = await runOrrery(sandbox, [
    "resume",
    "--plan",
    "resume-after-block-test.yaml"
  ]);

  assert.equal(
    resumeResult.code,
    0,
    `resume exited with code ${resumeResult.code}:\nstdout: ${resumeResult.stdout}\nstderr: ${resumeResult.stderr}`
  );

  const planAfterResume = loadFinalPlan(
    sandbox,
    "resume-after-block-test.yaml"
  );
  assertStepStatus(planAfterResume, "2", "complete");

  // Switch to work branch to see the agent's changes
  checkoutWorkBranch(sandbox, "resume-after-block-test.yaml");
  assertFileContains(sandbox, "src/math.js", /divide/i);
});
