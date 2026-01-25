/**
 * Orchestrator Configuration
 *
 * This file configures the plan orchestrator including agent commands,
 * concurrency settings, and directory paths.
 */

const { getFormatInstructions } = require("./report-format");
const { detectInstalledAgents } = require("../utils/agent-detector");

// Helper function to get agent priority from environment or default
function getAgentPriority() {
  const envPriority = process.env.ORRERY_AGENT_PRIORITY;
  if (envPriority && envPriority.trim()) {
    return envPriority
      .trim()
      .split(",")
      .map((s) => s.trim());
  }
  return ["codex", "gemini", "claude"];
}

// Filter agent priority to only include agents that are installed (have config directories)
function getInstalledAgentPriority() {
  const requestedAgents = getAgentPriority();
  const installedAgents = detectInstalledAgents();

  const filteredAgents = requestedAgents.filter((agent) =>
    installedAgents.includes(agent)
  );

  // Warn about agents in priority that aren't installed
  const skippedAgents = requestedAgents.filter(
    (agent) => !installedAgents.includes(agent)
  );
  if (skippedAgents.length > 0) {
    const missingDirs = skippedAgents.map((a) => `~/.${a}`).join(", ");
    console.warn(
      `[config] Skipping unconfigured agents: ${skippedAgents.join(", ")} (missing: ${missingDirs})`
    );
  }

  if (filteredAgents.length === 0) {
    console.warn(
      `[config] No configured agents found. Install an agent CLI and create its config directory (e.g., ~/.claude, ~/.codex, ~/.gemini)`
    );
  }

  return filteredAgents;
}

// Shared prompt for all worker agents
const WORKER_PROMPT = `You are a Worker Agent executing plan steps.

Plan file: {planFile}
Steps to execute: {stepIds}

## Plan Format Note

The plan file may be a condensed version containing only your assigned steps
and their completed dependencies (indicated by \`condensed: true\` in metadata).
All necessary context is included - do not reference the source plan.

## Workflow

For each step:

1. Read the plan file to understand the step's requirements, criteria, and files
2. Execute: Implement the changes following project conventions. Do NOT commit - the orchestrator handles commits.
3. Verify: Run tests and confirm acceptance criteria are met. Fix issues before proceeding.
4. Report: Output a JSON result for the step (see format below)

Use /orrery-execute, /orrery-verify, and /orrery-report skills for detailed guidance on each phase.

${getFormatInstructions()}

## Exit Codes

- Exit 0: All steps completed successfully
- Exit 1: One or more steps blocked

## Rules

- The plan file is READ-ONLY—never modify it
- Complete each step fully before starting the next
- Output clean JSON to stdout—no extra text or markdown wrapping`;

const REVIEW_PROMPT = `You are a Review Agent. Review the completed plan step.

Plan file: {planFile}
Step to review: {stepIds}

## Workflow

1. Read the plan file to understand the step's description, requirements, and acceptance criteria
2. Discover all changes:
   - Run \`git status --porcelain\` to list all modified, staged, and untracked files
   - Run \`git diff\` for unstaged changes to tracked files
   - Run \`git diff --cached\` for staged changes
3. Read modified/created files for full context
4. Evaluate if changes correctly implement the requirements

## Output Format (JSON)

{"status":"approved","summary":"..."}
OR
{"status":"needs_changes","feedback":[{"comment":"...","file":"...","severity":"blocking|suggestion"}]}`;

module.exports = {
  // Agent configurations (keyed by agent name)
  agents: {
    claude: {
      command: "claude",
      args: [
        "--model",
        "sonnet",
        "--dangerously-skip-permissions",
        "-p",
        WORKER_PROMPT
      ]
    },
    codex: {
      command: "codex",
      args: ["exec", "--yolo", WORKER_PROMPT],
      // Codex writes progress to stderr and final result to stdout
      stderrIsProgress: true
    },
    gemini: {
      command: "gemini",
      args: ["--yolo", "-p", WORKER_PROMPT],
      // Gemini writes progress to stderr and final result to stdout
      stderrIsProgress: true
    }
  },

  // Default agent to use when failover is disabled
  defaultAgent: "codex",

  // Agent priority list for failover (tried in order, filtered to installed agents)
  agentPriority: getInstalledAgentPriority(),

  // Failover configuration
  failover: {
    // Enable/disable failover behavior
    enabled: true,

    // Timeout in milliseconds before trying next agent (15 minutes)
    // Can be overridden via ORRERY_AGENT_TIMEOUT environment variable
    timeoutMs: 900000,

    // Patterns to detect failover-triggering errors from stderr
    errorPatterns: {
      // API/connection errors
      apiError: [
        /API error/i,
        /connection refused/i,
        /ECONNRESET/i,
        /ETIMEDOUT/i,
        /network error/i,
        /rate limit/i,
        /429/,
        /502/,
        /503/
      ],
      // Token/context limit errors
      tokenLimit: [
        /token limit/i,
        /context.*(limit|length|exceeded)/i,
        /maximum.*tokens/i,
        /too long/i
      ]
    }
  },

  // Concurrency control
  concurrency: {
    // Default: serial execution. Enable parallel with --parallel flag or ORRERY_PARALLEL_ENABLED=true
    // When parallel is enabled, maxParallel is set from ORRERY_PARALLEL_MAX (default: 3)
    maxParallel: 1,
    pollInterval: 5000
  },

  // Retry policy for failed steps
  retry: {
    // Maximum retry attempts per step
    maxAttempts: 1,
    // Delay in ms before retrying
    backoffMs: 5000
  },

  // Logging options
  logging: {
    // Show agent stdout in real-time
    streamOutput: true,
    // Prefix format for agent output ("[step-1]" or "[step-1,step-2]")
    prefixFormat: "step"
  },

  // Review/edit loop configuration
  review: {
    enabled: false,
    maxIterations: 3,
    prompt: REVIEW_PROMPT
  },

  REVIEW_PROMPT
};
