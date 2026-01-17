/**
 * Report Format Definition (Single Source of Truth)
 *
 * IMPORTANT: Any changes to the structure or instructions below MUST be manually
 * reflected in: agent/skills/report/SKILL.md
 */

// 1. Define the Expected Shape (The Contract)
const REPORT_FIELDS = {
  stepId: "The ID of the step being executed (string)",
  status: "One of: 'complete', 'blocked'",
  summary: "A concise summary of what was done (string)",
  artifacts: "Array of file paths created or modified (string[])",
  testResults: "Optional: Test outcome summary (string, e.g., '2/2 passed')",
  blockedReason: "Required if status is 'blocked' (string)",
  commitMessage: "A meaningful commit message (string, e.g., 'feat: add login endpoint')",
};

// 2. Generate the Instruction for the Agent
function getFormatInstructions() {
  return `## Output Contract

Output one JSON object per step to stdout. You may output multiple objects if processing multiple steps.

Success Example:
{"stepId": "step-1", "status": "complete", "summary": "Implemented login", "artifacts": ["src/auth.js"], "testResults": "5/5 passed", "commitMessage": "feat: add user authentication"}

Blocked Example:
{"stepId": "step-2", "status": "blocked", "blockedReason": "API is down", "summary": "Could not verify"}

Rules:
- JSON must be valid and on a single line.
- Do not wrap in markdown blocks (just raw JSON).
- Each step result must be a separate JSON object.`;
}

// 3. Validate/Normalize the incoming data
function validateAgentOutput(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Report data must be an object");
  }

  // Required fields
  if (!data.stepId || typeof data.stepId !== "string") {
    throw new Error("Report missing required field: stepId (string)");
  }

  if (!data.status || !["complete", "blocked"].includes(data.status)) {
    throw new Error(
      `Invalid status: ${data.status}. Must be 'complete' or 'blocked'`
    );
  }

  // Conditional requirements
  if (data.status === "blocked" && !data.blockedReason) {
    throw new Error(
      "Report with status 'blocked' must include 'blockedReason'"
    );
  }

  // Normalize optional fields
  return {
    stepId: data.stepId,
    status: data.status,
    summary:
      data.summary ||
      (data.status === "blocked" ? "Step blocked" : "Step completed"),
    artifacts: Array.isArray(data.artifacts) ? data.artifacts : [],
    testResults: data.testResults || null,
    blockedReason: data.blockedReason || null,
    commitMessage: data.commitMessage || `feat: complete step ${data.stepId}`,
  };
}

module.exports = {
  REPORT_FIELDS,
  getFormatInstructions,
  validateAgentOutput,
};
