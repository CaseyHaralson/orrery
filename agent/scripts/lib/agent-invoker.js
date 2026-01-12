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
 * @param {string} stdout - Raw stdout from agent
 * @returns {Array<Object>} - Array of parsed results
 */
function parseAgentResults(stdout) {
  const results = [];

  // Try to find JSON in the output (might have other text around it)
  // Look for JSON objects or arrays
  const jsonPattern = /\{[\s\S]*?"stepId"[\s\S]*?\}|\[[\s\S]*?"stepId"[\s\S]*?\]/g;
  const matches = stdout.match(jsonPattern);

  if (!matches) {
    return results;
  }

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch (e) {
      // Skip malformed JSON
      continue;
    }
  }

  return results;
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
