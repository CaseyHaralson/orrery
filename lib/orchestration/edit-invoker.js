const {
  invokeAgentWithFailover,
  parseAgentResults
} = require("./agent-invoker");

function getWorkerPromptTemplate(config) {
  if (config && typeof config.WORKER_PROMPT === "string") {
    return config.WORKER_PROMPT;
  }

  const agents = (config && config.agents) || {};
  const preferredAgent =
    (config && config.defaultAgent && agents[config.defaultAgent]) ||
    Object.values(agents)[0];

  if (preferredAgent && Array.isArray(preferredAgent.args)) {
    const lastArg = preferredAgent.args[preferredAgent.args.length - 1];
    if (typeof lastArg === "string") {
      return lastArg;
    }
  }

  return "";
}

function formatFeedbackList(feedback) {
  if (!Array.isArray(feedback) || feedback.length === 0) {
    return "No review feedback items provided.";
  }

  return feedback
    .map((entry, index) => {
      const item =
        entry && typeof entry === "object" ? entry : { comment: String(entry) };
      const file =
        typeof item.file === "string" && item.file.trim()
          ? item.file.trim()
          : "(not specified)";
      const line = Number.isFinite(item.line) ? ` line: ${item.line}` : "";
      const severity =
        typeof item.severity === "string" && item.severity.trim()
          ? item.severity.trim()
          : "suggestion";
      const comment =
        typeof item.comment === "string" && item.comment.trim()
          ? item.comment.trim()
          : "(no comment provided)";

      return `${index + 1}. file: ${file}${line} severity: ${severity} comment: ${comment}`;
    })
    .join("\n");
}

function buildEditPrompt(template, planFile, stepIds, feedback) {
  const stepIdsStr = Array.isArray(stepIds)
    ? stepIds.join(",")
    : String(stepIds);
  const basePrompt = String(template || "")
    .replace("{planFile}", planFile)
    .replace("{stepIds}", stepIdsStr);

  const feedbackSection = formatFeedbackList(feedback);

  return `${basePrompt}\n\n## Review Feedback\n${feedbackSection}\n\n## Instructions\nAddress all review feedback items above before reporting the step as complete.`;
}

function buildEditConfig(config, prompt) {
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

async function invokeEditAgent(
  config,
  planFile,
  stepIds,
  feedback,
  repoRoot,
  options = {}
) {
  const template = getWorkerPromptTemplate(config);
  const prompt = buildEditPrompt(template, planFile, stepIds, feedback);
  const editConfig = buildEditConfig(config, prompt);

  const handle = invokeAgentWithFailover(
    editConfig,
    planFile,
    stepIds,
    repoRoot,
    options
  );

  const result = await handle.completion;
  return parseAgentResults(result.stdout || "");
}

module.exports = {
  invokeEditAgent
};
