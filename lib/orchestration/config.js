/**
 * Orchestrator Configuration
 *
 * This file configures the plan orchestrator including agent commands,
 * concurrency settings, and directory paths.
 */

const { getFormatInstructions } = require("./report-format");

// Shared prompt for all worker agents
const WORKER_PROMPT = `You are a Worker Agent executing plan steps.

Plan file: {planFile}
Steps to execute: {stepIds}

## Workflow

For each step:

1. Read the plan file to understand the step's requirements, criteria, and files
2. Execute: Implement the changes following project conventions. Commit your work.
3. Verify: Run tests and confirm acceptance criteria are met. Fix issues before proceeding.
4. Report: Output a JSON result for the step (see format below)

Use /execute, /verify, and /report skills for detailed guidance on each phase.

${getFormatInstructions()}

## Exit Codes

- Exit 0: All steps completed successfully
- Exit 1: One or more steps blocked

## Rules

- The plan file is READ-ONLY—never modify it
- Complete each step fully before starting the next
- Output clean JSON to stdout—no extra text or markdown wrapping`;

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
        WORKER_PROMPT,
      ],
    },
    codex: {
      command: "codex",
      args: ["exec", "--yolo", WORKER_PROMPT],
      // Codex writes progress to stderr and final result to stdout
      stderrIsProgress: true,
    },
    gemini: {
      command: "gemini",
      args: ["--yolo", "-p", WORKER_PROMPT],
      // Gemini writes progress to stderr and final result to stdout
      stderrIsProgress: true,
    },
  },

  // Default agent to use when failover is disabled
  defaultAgent: "codex",

  // Agent priority list for failover (tried in order)
  agentPriority: ["codex", "gemini", "claude"],

  // Failover configuration
  failover: {
    // Enable/disable failover behavior
    enabled: true,

    // Timeout in milliseconds before trying next agent (10 minutes)
    timeoutMs: 600000,

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
        /503/,
      ],
      // Token/context limit errors
      tokenLimit: [
        /token limit/i,
        /context.*(limit|length|exceeded)/i,
        /maximum.*tokens/i,
        /too long/i,
      ],
    },
  },

  // Concurrency control
  concurrency: {
    // Maximum number of parallel agent processes
    maxParallel: 3,
    // Interval in ms to poll for process completion
    pollInterval: 5000,
  },

  // Retry policy for failed steps
  retry: {
    // Maximum retry attempts per step
    maxAttempts: 1,
    // Delay in ms before retrying
    backoffMs: 5000,
  },

  // Logging options
  logging: {
    // Show agent stdout in real-time
    streamOutput: true,
    // Prefix format for agent output ("[step-1]" or "[step-1,step-2]")
    prefixFormat: "step",
    // Log file for timeout events
    timeoutLogFile: "work/reports/timeouts.log",
    // Log file for failure events (captures stdout/stderr for debugging)
    failureLogFile: "work/reports/failures.log",
  },
};
