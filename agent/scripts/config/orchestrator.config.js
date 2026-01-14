/**
 * Orchestrator Configuration
 *
 * This file configures the plan orchestrator including agent commands,
 * concurrency settings, and directory paths.
 */

module.exports = {
  // Directory paths (relative to repository root)
  paths: {
    plans: "work/plans",
    completed: "work/completed",
    reports: "work/reports",
  },

  // Agent configurations (keyed by agent name)
  agents: {
    claude: {
      command: "claude",
      args: [
        "--model",
        "sonnet",
        "--dangerously-skip-permissions",
        "-p",
        "You are a Worker Agent. Execute the following steps from the plan.\n\n" +
          "Plan file: {planFile}\n" +
          "Steps to execute: {stepIds}\n\n" +
          "Instructions:\n" +
          "1. Read the plan file to understand the step requirements\n" +
          "2. Load the execute, verify, and report skills from agent/skills/\n" +
          "3. For each step:\n" +
          "   - Implement the changes following the step requirements\n" +
          "   - Verify the work meets the acceptance criteria\n" +
          "4. Output your results as JSON to stdout in this format:\n" +
          '   {"stepId": "<id>", "status": "complete", "summary": "...", "artifacts": [...]}\n' +
          "   or if blocked:\n" +
          '   {"stepId": "<id>", "status": "blocked", "blockedReason": "..."}\n\n' +
          "Do not modify the plan file. Report results via stdout JSON only.",
      ],
    },
    codex: {
      command: "codex",
      args: [
        "exec",
        "--yolo",
        "You are a Worker Agent. Execute the following steps from the plan.\n\n" +
          "Plan file: {planFile}\n" +
          "Steps to execute: {stepIds}\n\n" +
          "Instructions:\n" +
          "1. Read the plan file to understand the step requirements\n" +
          "2. Load the execute, verify, and report skills from agent/skills/\n" +
          "3. For each step:\n" +
          "   - Implement the changes following the step requirements\n" +
          "   - Verify the work meets the acceptance criteria\n" +
          "4. Output your results as JSON to stdout in this format:\n" +
          '   {"stepId": "<id>", "status": "complete", "summary": "...", "artifacts": [...]}\n' +
          "   or if blocked:\n" +
          '   {"stepId": "<id>", "status": "blocked", "blockedReason": "..."}\n\n' +
          "Do not modify the plan file. Report results via stdout JSON only.",
      ],
      // Codex writes progress to stderr and final result to stdout
      stderrIsProgress: true,
    },
    // Future agent configurations:
    // gemini: {
    //   command: "gemini",
    //   args: [...]
    // },
  },

  // Default agent to use when step.owner is "self" or unspecified
  defaultAgent: "codex",

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
  },
};
