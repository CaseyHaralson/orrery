#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

/**
 * Invoke an agent subprocess to execute plan steps
 * @param {Object} agentConfig - Agent configuration (command, args)
 * @param {string} planFile - Absolute path to the plan YAML file
 * @param {string[]} stepIds - Array of step IDs to execute
 * @param {string} repoRoot - Path to repository root
 * @param {Object} [options] - Additional options
 * @param {Function} [options.onStdout] - Callback for stdout data
 * @param {Function} [options.onStderr] - Callback for stderr data
 * @returns {Object} - Process handle with promise for completion
 */
function invokeAgent(agentConfig, planFile, stepIds, repoRoot, options = {}) {
  const stepIdsStr = stepIds.join(",");

  // Replace placeholders in command args
  const args = agentConfig.args.map((arg) =>
    arg.replace("{planFile}", planFile).replace("{stepIds}", stepIdsStr)
  );

  const proc = spawn(agentConfig.command, args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    shell: false,
  });

  // Collect stdout for result parsing
  let stdoutBuffer = "";
  let stderrBuffer = "";

  proc.stdout.on("data", (data) => {
    const text = data.toString();
    stdoutBuffer += text;
    if (options.onStdout) {
      options.onStdout(text, stepIds);
    }
  });

  proc.stderr.on("data", (data) => {
    const text = data.toString();
    stderrBuffer += text;
    if (options.onStderr) {
      options.onStderr(text, stepIds);
    }
  });

  // Create a promise that resolves when process exits
  const completion = new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      resolve({
        exitCode: code,
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
        stepIds,
      });
    });

    proc.on("error", (err) => {
      reject({
        error: err,
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
        stepIds,
      });
    });
  });

  return {
    process: proc,
    completion,
    stepIds,
    kill: () => proc.kill(),
  };
}

/**
 * Parse agent result from stdout
 * Expected format is JSON with:
 * {
 *   stepId: string,
 *   status: "complete" | "blocked",
 *   summary: string,
 *   blockedReason?: string,
 *   artifacts?: string[],
 *   testResults?: { passed: number, failed: number }
 * }
 *
 * Agents may output multiple JSON objects (one per step) or a single array.
 * JSON may be wrapped in markdown code blocks (```json ... ```).
 * @param {string} stdout - Raw stdout from agent
 * @returns {Array<Object>} - Array of parsed results
 */
function parseAgentResults(stdout) {
  const results = [];

  // First, try to extract JSON from markdown code blocks
  const codeBlockPattern = /```(?:json)?\s*([\s\S]*?)```/g;
  let codeBlockMatch;
  while ((codeBlockMatch = codeBlockPattern.exec(stdout)) !== null) {
    const content = codeBlockMatch[1].trim();
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        results.push(...parsed.filter((r) => r.stepId));
      } else if (parsed.stepId) {
        results.push(parsed);
      }
    } catch (e) {
      // Not valid JSON in this code block, continue
    }
  }

  // If we found results in code blocks, return them
  if (results.length > 0) {
    return results;
  }

  // Otherwise, try to find raw JSON objects with balanced braces
  let i = 0;
  while (i < stdout.length) {
    if (stdout[i] === "{") {
      const jsonObj = extractBalancedJson(stdout, i, "{", "}");
      if (jsonObj) {
        try {
          const parsed = JSON.parse(jsonObj);
          if (parsed.stepId) {
            results.push(parsed);
          }
        } catch (e) {
          // Not valid JSON
        }
        i += jsonObj.length;
      } else {
        i++;
      }
    } else if (stdout[i] === "[") {
      const jsonArr = extractBalancedJson(stdout, i, "[", "]");
      if (jsonArr) {
        try {
          const parsed = JSON.parse(jsonArr);
          if (Array.isArray(parsed)) {
            results.push(...parsed.filter((r) => r.stepId));
          }
        } catch (e) {
          // Not valid JSON
        }
        i += jsonArr.length;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return results;
}

/**
 * Extract a balanced JSON structure from a string starting at a given position.
 * Handles nested braces and respects string boundaries.
 * @param {string} str - The string to extract from
 * @param {number} start - Starting index (must be openChar)
 * @param {string} openChar - Opening character ('{' or '[')
 * @param {string} closeChar - Closing character ('}' or ']')
 * @returns {string|null} - The extracted JSON string or null if unbalanced
 */
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

  return null; // Unbalanced
}

/**
 * Create a default result for a step when agent doesn't report properly
 * @param {string} stepId - Step ID
 * @param {number} exitCode - Process exit code
 * @param {string} stderr - Error output
 * @returns {Object} - Default result object
 */
function createDefaultResult(stepId, exitCode, stderr) {
  if (exitCode === 0) {
    return {
      stepId,
      status: "complete",
      summary: "Step completed (no detailed report from agent)",
      artifacts: [],
    };
  } else {
    return {
      stepId,
      status: "blocked",
      summary: "Step failed",
      blockedReason: stderr || `Agent exited with code ${exitCode}`,
      artifacts: [],
    };
  }
}

/**
 * Wait for multiple agent processes to complete
 * @param {Array<Object>} agentHandles - Array of handles from invokeAgent
 * @returns {Promise<Array>} - Array of completion results
 */
async function waitForAll(agentHandles) {
  return Promise.all(agentHandles.map((h) => h.completion));
}

/**
 * Wait for any one agent process to complete
 * @param {Array<Object>} agentHandles - Array of handles from invokeAgent
 * @returns {Promise<{result: Object, index: number}>} - First completed result with index
 */
async function waitForAny(agentHandles) {
  return Promise.race(
    agentHandles.map((handle, index) =>
      handle.completion.then((result) => ({ result, index }))
    )
  );
}

module.exports = {
  invokeAgent,
  parseAgentResults,
  createDefaultResult,
  waitForAll,
  waitForAny,
};
