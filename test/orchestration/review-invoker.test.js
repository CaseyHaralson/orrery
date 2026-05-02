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

// ============================================================================
// parseReviewResults - status normalization
// ============================================================================

test("parseReviewResults accepts changes_requested as alias for needs_changes", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    '{"status":"changes_requested","feedback":[{"comment":"Fix it","severity":"blocking"}]}'
  );

  assert.equal(result.approved, false);
  assert.equal(result.feedback.length, 1);
});

test("parseReviewResults returns approved with error for unrecognized status", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults('{"status":"maybe","feedback":[]}');

  assert.equal(result.approved, true);
  assert.ok(result.error);
  assert.ok(result.error.includes("Unrecognized"));
});

test("parseReviewResults returns approved with error for null payload object", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults("null");

  assert.equal(result.approved, true);
  assert.ok(result.error);
});

// ============================================================================
// parseReviewResults - feedback normalization
// ============================================================================

test("parseReviewResults uses comments field as fallback for feedback", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    '{"status":"needs_changes","comments":[{"comment":"Use const","severity":"suggestion"}]}'
  );

  assert.equal(result.approved, false);
  assert.equal(result.feedback.length, 1);
  assert.equal(result.feedback[0].comment, "Use const");
});

test("parseReviewResults normalizes string feedback entries", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    '{"status":"needs_changes","feedback":["Fix the import","Add a test"]}'
  );

  assert.equal(result.approved, false);
  assert.equal(result.feedback.length, 2);
  assert.equal(result.feedback[0].comment, "Fix the import");
  assert.equal(result.feedback[0].severity, "suggestion");
  assert.equal(result.feedback[1].comment, "Add a test");
});

test("parseReviewResults filters out feedback entries with empty comments", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    '{"status":"needs_changes","feedback":[{"comment":""},{"comment":"Real feedback"}]}'
  );

  assert.equal(result.feedback.length, 1);
  assert.equal(result.feedback[0].comment, "Real feedback");
});

test("parseReviewResults preserves file and line in feedback", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    '{"status":"needs_changes","feedback":[{"file":"src/foo.js","line":42,"comment":"Fix","severity":"blocking"}]}'
  );

  assert.equal(result.feedback[0].file, "src/foo.js");
  assert.equal(result.feedback[0].line, 42);
  assert.equal(result.feedback[0].severity, "blocking");
});

test("parseReviewResults defaults severity to suggestion for non-blocking values", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    '{"status":"needs_changes","feedback":[{"comment":"Nitpick","severity":"warning"}]}'
  );

  assert.equal(result.feedback[0].severity, "suggestion");
});

test("parseReviewResults ignores non-finite line numbers", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    '{"status":"needs_changes","feedback":[{"comment":"Fix","line":"three","file":"a.js"}]}'
  );

  assert.equal(result.feedback[0].file, "a.js");
  assert.equal(result.feedback[0].line, undefined);
});

// ============================================================================
// parseReviewResults - JSON extraction
// ============================================================================

test("parseReviewResults handles array payload using first element", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    '[{"status":"approved","feedback":[]},{"status":"needs_changes"}]'
  );

  assert.equal(result.approved, true);
  assert.deepEqual(result.feedback, []);
});

test("parseReviewResults extracts JSON from markdown code block", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    'Here is my review:\n```json\n{"status":"needs_changes","feedback":[{"comment":"Add tests"}]}\n```\nDone.'
  );

  assert.equal(result.approved, false);
  assert.equal(result.feedback.length, 1);
});

test("parseReviewResults extracts JSON from raw balanced braces with surrounding text", (t) => {
  const { parseReviewResults } = loadReviewInvoker(t);
  const result = parseReviewResults(
    'The review result is: {"status":"approved","feedback":[]} and that is all.'
  );

  assert.equal(result.approved, true);
  assert.deepEqual(result.feedback, []);
});

// ============================================================================
// invokeReviewAgent
// ============================================================================

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
