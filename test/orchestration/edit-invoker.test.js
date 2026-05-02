const assert = require("node:assert/strict");
const test = require("node:test");

function loadEditInvoker(t, stubbed = {}) {
  const agentInvokerPath =
    require.resolve("../../lib/orchestration/agent-invoker");
  const editInvokerPath =
    require.resolve("../../lib/orchestration/edit-invoker");

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

// ============================================================================
// invokeEditAgent - feedback formatting
// ============================================================================

test("invokeEditAgent formats empty feedback as no-items message", async (t) => {
  let capturedPrompt = "";

  const { invokeEditAgent } = loadEditInvoker(t, {
    invokeAgentWithFailover: (config) => {
      const agent = config.agents.codex;
      capturedPrompt = agent.args[agent.args.length - 1];
      return {
        completion: Promise.resolve({ stdout: "output" })
      };
    },
    parseAgentResults: () => [
      { stepId: "1", status: "complete", summary: "Done" }
    ]
  });

  const config = {
    WORKER_PROMPT: "Plan {planFile} Steps {stepIds}",
    agents: {
      codex: { command: "node", args: ["-e", "PROMPT"] }
    }
  };

  await invokeEditAgent(config, "/tmp/plan.yaml", ["1"], [], "/repo");

  assert.ok(capturedPrompt.includes("No review feedback items provided."));
});

test("invokeEditAgent handles string-only feedback entries", async (t) => {
  let capturedPrompt = "";

  const { invokeEditAgent } = loadEditInvoker(t, {
    invokeAgentWithFailover: (config) => {
      const agent = config.agents.codex;
      capturedPrompt = agent.args[agent.args.length - 1];
      return {
        completion: Promise.resolve({ stdout: "output" })
      };
    },
    parseAgentResults: () => [
      { stepId: "1", status: "complete", summary: "Done" }
    ]
  });

  const config = {
    WORKER_PROMPT: "Plan {planFile} Steps {stepIds}",
    agents: {
      codex: { command: "node", args: ["-e", "PROMPT"] }
    }
  };

  await invokeEditAgent(
    config,
    "/tmp/plan.yaml",
    ["1"],
    ["Fix the import statement", "Add error handling"],
    "/repo"
  );

  assert.ok(
    capturedPrompt.includes(
      "1. file: (not specified) severity: suggestion comment: Fix the import statement"
    )
  );
  assert.ok(
    capturedPrompt.includes(
      "2. file: (not specified) severity: suggestion comment: Add error handling"
    )
  );
});

test("invokeEditAgent shows not-specified for feedback with no file", async (t) => {
  let capturedPrompt = "";

  const { invokeEditAgent } = loadEditInvoker(t, {
    invokeAgentWithFailover: (config) => {
      const agent = config.agents.codex;
      capturedPrompt = agent.args[agent.args.length - 1];
      return {
        completion: Promise.resolve({ stdout: "output" })
      };
    },
    parseAgentResults: () => [
      { stepId: "1", status: "complete", summary: "Done" }
    ]
  });

  const config = {
    WORKER_PROMPT: "Plan {planFile} Steps {stepIds}",
    agents: {
      codex: { command: "node", args: ["-e", "PROMPT"] }
    }
  };

  await invokeEditAgent(
    config,
    "/tmp/plan.yaml",
    ["1"],
    [{ comment: "Fix it", severity: "blocking" }],
    "/repo"
  );

  assert.ok(capturedPrompt.includes("file: (not specified)"));
  assert.ok(capturedPrompt.includes("severity: blocking"));
  assert.ok(capturedPrompt.includes("comment: Fix it"));
});

test("invokeEditAgent shows no-comment-provided for empty comment", async (t) => {
  let capturedPrompt = "";

  const { invokeEditAgent } = loadEditInvoker(t, {
    invokeAgentWithFailover: (config) => {
      const agent = config.agents.codex;
      capturedPrompt = agent.args[agent.args.length - 1];
      return {
        completion: Promise.resolve({ stdout: "output" })
      };
    },
    parseAgentResults: () => [
      { stepId: "1", status: "complete", summary: "Done" }
    ]
  });

  const config = {
    WORKER_PROMPT: "Plan {planFile} Steps {stepIds}",
    agents: {
      codex: { command: "node", args: ["-e", "PROMPT"] }
    }
  };

  await invokeEditAgent(
    config,
    "/tmp/plan.yaml",
    ["1"],
    [{ file: "src/foo.js", comment: "" }],
    "/repo"
  );

  assert.ok(capturedPrompt.includes("file: src/foo.js"));
  assert.ok(capturedPrompt.includes("comment: (no comment provided)"));
});

test("invokeEditAgent omits line when non-finite", async (t) => {
  let capturedPrompt = "";

  const { invokeEditAgent } = loadEditInvoker(t, {
    invokeAgentWithFailover: (config) => {
      const agent = config.agents.codex;
      capturedPrompt = agent.args[agent.args.length - 1];
      return {
        completion: Promise.resolve({ stdout: "output" })
      };
    },
    parseAgentResults: () => [
      { stepId: "1", status: "complete", summary: "Done" }
    ]
  });

  const config = {
    WORKER_PROMPT: "Plan {planFile} Steps {stepIds}",
    agents: {
      codex: { command: "node", args: ["-e", "PROMPT"] }
    }
  };

  await invokeEditAgent(
    config,
    "/tmp/plan.yaml",
    ["1"],
    [{ file: "a.js", line: "three", comment: "Fix" }],
    "/repo"
  );

  // line should NOT appear since "three" is not finite
  assert.ok(!capturedPrompt.includes("line: three"));
  assert.ok(capturedPrompt.includes("file: a.js"));
});

// ============================================================================
// invokeEditAgent - prompt template resolution
// ============================================================================

test("invokeEditAgent falls back to agent last-arg when WORKER_PROMPT not set", async (t) => {
  let capturedPrompt = "";

  const { invokeEditAgent } = loadEditInvoker(t, {
    invokeAgentWithFailover: (config) => {
      const agent = config.agents.codex;
      capturedPrompt = agent.args[agent.args.length - 1];
      return {
        completion: Promise.resolve({ stdout: "output" })
      };
    },
    parseAgentResults: () => [
      { stepId: "1", status: "complete", summary: "Done" }
    ]
  });

  const config = {
    agents: {
      codex: {
        command: "node",
        args: ["-e", "Base template {planFile} {stepIds}"]
      }
    }
  };

  await invokeEditAgent(config, "/tmp/plan.yaml", ["1"], [], "/repo");

  assert.ok(capturedPrompt.includes("Base template /tmp/plan.yaml 1"));
  assert.ok(capturedPrompt.includes("## Review Feedback"));
});

test("invokeEditAgent with empty args does not inject prompt into args", async (t) => {
  let capturedArgs = null;

  const { invokeEditAgent } = loadEditInvoker(t, {
    invokeAgentWithFailover: (config) => {
      capturedArgs = config.agents.codex.args;
      return {
        completion: Promise.resolve({ stdout: "output" })
      };
    },
    parseAgentResults: () => [
      { stepId: "1", status: "complete", summary: "Done" }
    ]
  });

  const config = {
    agents: {
      codex: { command: "node", args: [] }
    }
  };

  await invokeEditAgent(config, "/tmp/plan.yaml", ["1"], [], "/repo");

  // With empty args, buildEditConfig skips prompt injection
  assert.deepEqual(capturedArgs, []);
});

test("invokeEditAgent replaces prompt in all agent configs", async (t) => {
  let capturedConfig = null;

  const { invokeEditAgent } = loadEditInvoker(t, {
    invokeAgentWithFailover: (config) => {
      capturedConfig = config;
      return {
        completion: Promise.resolve({ stdout: "output" })
      };
    },
    parseAgentResults: () => [
      { stepId: "1", status: "complete", summary: "Done" }
    ]
  });

  const config = {
    WORKER_PROMPT: "Template",
    agents: {
      codex: { command: "codex", args: ["-e", "OLD_PROMPT"] },
      claude: { command: "claude", args: ["-p", "OLD_PROMPT"] }
    }
  };

  await invokeEditAgent(config, "/tmp/plan.yaml", ["1"], [], "/repo");

  // Both agents should have their last arg replaced
  assert.ok(capturedConfig.agents.codex.args[1].includes("## Review Feedback"));
  assert.ok(
    capturedConfig.agents.claude.args[1].includes("## Review Feedback")
  );
});

// ============================================================================
// invokeEditAgent - full integration
// ============================================================================

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
