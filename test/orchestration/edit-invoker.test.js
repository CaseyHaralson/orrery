const assert = require("node:assert/strict");
const test = require("node:test");

function loadEditInvoker(t, stubbed = {}) {
  const agentInvokerPath = require.resolve(
    "../../lib/orchestration/agent-invoker"
  );
  const editInvokerPath = require.resolve(
    "../../lib/orchestration/edit-invoker"
  );

  const originalAgentInvoker = require.cache[agentInvokerPath];
  const originalEditInvoker = require.cache[editInvokerPath];

  require.cache[agentInvokerPath] = {
    id: agentInvokerPath,
    filename: agentInvokerPath,
    loaded: true,
    exports: {
      invokeAgentWithFailover: () => {
        throw new Error("invokeAgentWithFailover not stubbed");
      },
      parseAgentResults: () => [],
      ...stubbed
    }
  };

  delete require.cache[editInvokerPath];

  t.after(() => {
    if (originalAgentInvoker) {
      require.cache[agentInvokerPath] = originalAgentInvoker;
    } else {
      delete require.cache[agentInvokerPath];
    }

    if (originalEditInvoker) {
      require.cache[editInvokerPath] = originalEditInvoker;
    } else {
      delete require.cache[editInvokerPath];
    }
  });

  return require("../../lib/orchestration/edit-invoker");
}

test("invokeEditAgent builds prompt with feedback", async (t) => {
  let capturedPrompt = "";
  let capturedStdout = "";

  const { invokeEditAgent } = loadEditInvoker(t, {
    invokeAgentWithFailover: (config) => {
      const agent = config.agents.codex;
      capturedPrompt = agent.args[agent.args.length - 1];
      return {
        completion: Promise.resolve({ stdout: "agent output" })
      };
    },
    parseAgentResults: (stdout) => {
      capturedStdout = stdout;
      return [{ stepId: "step-1", status: "complete", summary: "Done" }];
    }
  });

  const config = {
    WORKER_PROMPT: "Plan {planFile} Steps {stepIds}",
    agents: {
      codex: {
        command: "node",
        args: ["-e", "PROMPT"]
      }
    }
  };

  const feedback = [
    {
      file: "src/foo.js",
      line: 12,
      severity: "blocking",
      comment: "Fix bug"
    },
    {
      file: "src/bar.js",
      comment: "Consider refactor"
    }
  ];

  const result = await invokeEditAgent(
    config,
    "/tmp/plan.yaml",
    ["5.1"],
    feedback,
    "/repo",
    { stepId: "5.1" }
  );

  assert.equal(capturedStdout, "agent output");
  assert.deepEqual(result, [
    { stepId: "step-1", status: "complete", summary: "Done" }
  ]);
  assert.ok(capturedPrompt.includes("Plan /tmp/plan.yaml Steps 5.1"));
  assert.ok(capturedPrompt.includes("## Review Feedback"));
  assert.ok(
    capturedPrompt.includes(
      "1. file: src/foo.js line: 12 severity: blocking comment: Fix bug"
    )
  );
  assert.ok(
    capturedPrompt.includes(
      "2. file: src/bar.js severity: suggestion comment: Consider refactor"
    )
  );
  assert.ok(
    capturedPrompt.includes(
      "Address all review feedback items above before reporting the step as complete."
    )
  );
});
