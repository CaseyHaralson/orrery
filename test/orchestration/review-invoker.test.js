const assert = require("node:assert/strict");
const test = require("node:test");

function loadReviewInvoker(t, stubbed = {}) {
  const agentInvokerPath =
    require.resolve("../../lib/orchestration/agent-invoker");
  const reviewInvokerPath =
    require.resolve("../../lib/orchestration/review-invoker");

  const originalAgentInvoker = require.cache[agentInvokerPath];
  const originalReviewInvoker = require.cache[reviewInvokerPath];

  require.cache[agentInvokerPath] = {
    id: agentInvokerPath,
    filename: agentInvokerPath,
    loaded: true,
    exports: {
      invokeAgentWithFailover: () => {
        throw new Error("invokeAgentWithFailover not stubbed");
      },
      ...stubbed
    }
  };

  delete require.cache[reviewInvokerPath];

  t.after(() => {
    if (originalAgentInvoker) {
      require.cache[agentInvokerPath] = originalAgentInvoker;
    } else {
      delete require.cache[agentInvokerPath];
    }

    if (originalReviewInvoker) {
      require.cache[reviewInvokerPath] = originalReviewInvoker;
    } else {
      delete require.cache[reviewInvokerPath];
    }
  });

  return require("../../lib/orchestration/review-invoker");
}

test("parseReviewResults accepts approved output", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults('{"status":"approved","feedback":[]}');

  assert.equal(result.approved, true);
  assert.deepEqual(result.feedback, []);
});

test("parseReviewResults accepts needs_changes with feedback", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    '{"status":"needs_changes","feedback":[{"file":"src/foo.js","line":3,"severity":"blocking","comment":"Fix it"}]}'
  );

  assert.equal(result.approved, false);
  assert.equal(result.feedback.length, 1);
  assert.equal(result.feedback[0].file, "src/foo.js");
  assert.equal(result.feedback[0].line, 3);
  assert.equal(result.feedback[0].severity, "blocking");
});

test("parseReviewResults defaults to approved on malformed output", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults("not json");

  assert.equal(result.approved, true);
  assert.equal(result.feedback.length, 0);
  assert.ok(result.error);
});

test("invokeReviewAgent substitutes prompt placeholders", async (t) => {
  let capturedPrompt = "";
  const { invokeReviewAgent } = loadReviewInvoker(t, {
    invokeAgentWithFailover: (config) => {
      const agent = config.agents.codex;
      capturedPrompt = agent.args[agent.args.length - 1];
      return {
        completion: Promise.resolve({
          stdout: '{"status":"approved","feedback":[]}'
        })
      };
    }
  });

  const config = {
    review: {
      prompt: "Plan file: {planFile}\nStep: {stepIds}"
    },
    agents: {
      codex: {
        command: "node",
        args: ["-e", "PROMPT"]
      }
    }
  };

  const result = await invokeReviewAgent(
    config,
    "/path/to/plan.yaml",
    ["step-1", "step-2"],
    "/repo",
    { stepId: "step-1" }
  );

  assert.equal(result.approved, true);
  assert.ok(capturedPrompt.includes("Plan file: /path/to/plan.yaml"));
  assert.ok(capturedPrompt.includes("Step: step-1, step-2"));
});
