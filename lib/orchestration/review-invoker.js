const { invokeAgentWithFailover } = require("./agent-invoker");

function buildReviewPrompt(template, planFile, stepIds) {
  const basePrompt = String(template || "");
  const stepIdsStr = Array.isArray(stepIds)
    ? stepIds.join(", ")
    : String(stepIds);
  return basePrompt
    .replace("{planFile}", planFile || "")
    .replace("{stepIds}", stepIdsStr);
}

function buildReviewConfig(config, prompt) {
  const agents = {};

  for (const [name, agentConfig] of Object.entries(config.agents || {})) {
    const args = Array.isArray(agentConfig.args)
      ? agentConfig.args.slice()
      : [];
    if (args.length > 0) {
      args[args.length - 1] = prompt;
    }
    agents[name] = {
      ...agentConfig,
      args
    };
  }

  return {
    ...config,
    agents
  };
}

function extractBalancedJson(str, start, openChar = "{", closeChar = "}") {
  if (str[start] !== openChar) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\" && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return str.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

function extractJsonPayload(stdout) {
  if (!stdout) {
    return null;
  }

  const codeBlockPattern = /```(?:json)?\s*([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockPattern.exec(stdout)) !== null) {
    const content = match[1].trim();
    try {
      return JSON.parse(content);
    } catch {
      continue;
    }
  }

  for (let i = 0; i < stdout.length; i++) {
    if (stdout[i] === "{") {
      const jsonObj = extractBalancedJson(stdout, i, "{", "}");
      if (jsonObj) {
        try {
          return JSON.parse(jsonObj);
        } catch {
          // continue scanning
        }
        i += jsonObj.length - 1;
      }
    } else if (stdout[i] === "[") {
      const jsonArr = extractBalancedJson(stdout, i, "[", "]");
      if (jsonArr) {
        try {
          return JSON.parse(jsonArr);
        } catch {
          // continue scanning
        }
        i += jsonArr.length - 1;
      }
    }
  }

  return null;
}

function normalizeStatus(status) {
  if (!status || typeof status !== "string") {
    return null;
  }

  const normalized = status.trim().toLowerCase();
  if (normalized === "approved") {
    return "approved";
  }
  if (normalized === "needs_changes" || normalized === "changes_requested") {
    return "needs_changes";
  }

  return null;
}

function normalizeFeedbackEntry(entry) {
  if (!entry) {
    return null;
  }

  if (typeof entry === "string") {
    return {
      comment: entry,
      severity: "suggestion"
    };
  }

  if (typeof entry !== "object") {
    return null;
  }

  const comment =
    typeof entry.comment === "string"
      ? entry.comment
      : String(entry.comment || "");
  if (!comment) {
    return null;
  }

  const output = {
    comment,
    severity: entry.severity === "blocking" ? "blocking" : "suggestion"
  };

  if (typeof entry.file === "string" && entry.file.trim()) {
    output.file = entry.file.trim();
  }

  if (Number.isFinite(entry.line)) {
    output.line = entry.line;
  }

  return output;
}

function normalizeFeedback(feedback) {
  if (!Array.isArray(feedback)) {
    return [];
  }

  return feedback.map(normalizeFeedbackEntry).filter(Boolean);
}

function parseReviewResults(stdout) {
  try {
    const payload = extractJsonPayload(stdout);
    if (!payload) {
      return {
        approved: true,
        feedback: [],
        error: "No JSON review output detected"
      };
    }

    const data = Array.isArray(payload) ? payload[0] : payload;
    if (!data || typeof data !== "object") {
      return {
        approved: true,
        feedback: [],
        error: "Review output was not a JSON object"
      };
    }

    const status = normalizeStatus(data.status);
    if (!status) {
      return {
        approved: true,
        feedback: [],
        error: `Unrecognized review status: ${data.status}`
      };
    }

    const feedback = normalizeFeedback(data.feedback || data.comments);
    return {
      approved: status === "approved",
      feedback
    };
  } catch (error) {
    return {
      approved: true,
      feedback: [],
      error: error.message || "Failed to parse review output"
    };
  }
}

async function invokeReviewAgent(
  config,
  planFile,
  stepIds,
  repoRoot,
  options = {}
) {
  const promptTemplate =
    (config && config.review && config.review.prompt) ||
    config.REVIEW_PROMPT ||
    "";
  const normalizedStepIds = Array.isArray(stepIds) ? stepIds : [stepIds];
  const prompt = buildReviewPrompt(promptTemplate, planFile, normalizedStepIds);
  const reviewConfig = buildReviewConfig(config, prompt);

  const handle = invokeAgentWithFailover(
    reviewConfig,
    planFile,
    normalizedStepIds,
    repoRoot,
    options
  );

  const result = await handle.completion;
  return parseReviewResults(result.stdout || "");
}

module.exports = {
  invokeReviewAgent,
  parseReviewResults
};
