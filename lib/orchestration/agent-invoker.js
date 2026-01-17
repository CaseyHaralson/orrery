#!/usr/bin/env node

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { validateAgentOutput } = require("./report-format");

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

  // Helper to validate and add results
  const addResult = (obj) => {
    try {
      const valid = validateAgentOutput(obj);
      results.push(valid);
    } catch (e) {
      // Invalid result structure, ignore
      console.debug("Invalid result:", e.message);
    }
  };

  // First, try to extract JSON from markdown code blocks
  const codeBlockPattern = /```(?:json)?\s*([\s\S]*?)```/g;
  let codeBlockMatch;
  while ((codeBlockMatch = codeBlockPattern.exec(stdout)) !== null) {
    const content = codeBlockMatch[1].trim();
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        parsed.forEach(addResult);
      } else {
        addResult(parsed);
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
          addResult(parsed);
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
            parsed.forEach(addResult);
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
      commitMessage: `feat: complete step ${stepId}`,
    };
  } else {
    return {
      stepId,
      status: "blocked",
      summary: "Step failed",
      blockedReason: stderr || `Agent exited with code ${exitCode}`,
      artifacts: [],
      commitMessage: `wip: attempt step ${stepId}`,
    };
  }
}

/**
 * Check if an error condition should trigger failover to another agent
 * @param {Object} result - Process result with exitCode, stdout, stderr
 * @param {Error} spawnError - Error from spawn (if any)
 * @param {boolean} timedOut - Whether the process timed out
 * @param {Object} errorPatterns - Regex patterns for error detection
 * @returns {{shouldFailover: boolean, reason: string}}
 */
function shouldTriggerFailover(result, spawnError, timedOut, errorPatterns) {
  // 1. Spawn failures (command not found, ENOENT)
  if (spawnError) {
    if (spawnError.code === "ENOENT") {
      return { shouldFailover: true, reason: "command_not_found" };
    }
    return { shouldFailover: true, reason: "spawn_error" };
  }

  // 2. Timeout
  if (timedOut) {
    return { shouldFailover: true, reason: "timeout" };
  }

  // 3. Non-zero exit with error patterns in stderr (but NOT legitimate blocked)
  if (result && result.exitCode !== 0) {
    const stderr = result.stderr || "";

    // Check API error patterns
    for (const pattern of errorPatterns.apiError || []) {
      if (pattern.test(stderr)) {
        return { shouldFailover: true, reason: "api_error" };
      }
    }

    // Check token limit patterns
    for (const pattern of errorPatterns.tokenLimit || []) {
      if (pattern.test(stderr)) {
        return { shouldFailover: true, reason: "token_limit" };
      }
    }
  }

  return { shouldFailover: false, reason: null };
}

/**
 * Log a timeout event to the configured log file
 * @param {Object} config - Orchestrator config
 * @param {string} planFile - Path to plan file
 * @param {string[]} stepIds - Step IDs that timed out
 * @param {string} agentName - Name of the agent that timed out
 * @param {string} repoRoot - Repository root path
 */
function logTimeout(config, planFile, stepIds, agentName, repoRoot) {
  const logFile = config.logging?.timeoutLogFile;
  if (!logFile) return;

  const logPath = path.join(repoRoot, logFile);

  // Ensure directory exists
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    planFile: path.basename(planFile),
    stepIds,
    agent: agentName,
    timeoutMs: config.failover?.timeoutMs,
  };

  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(logPath, line, "utf8");
}

/**
 * Log a failure event to the configured log file
 * Captures both stdout and stderr since agents may write errors to either stream
 * @param {Object} config - Orchestrator config
 * @param {string} planFile - Path to plan file
 * @param {string[]} stepIds - Step IDs that failed
 * @param {string} agentName - Name of the agent that failed
 * @param {number} exitCode - Process exit code
 * @param {string} stdout - Agent stdout output
 * @param {string} stderr - Agent stderr output
 * @param {string} repoRoot - Repository root path
 */
function logFailure(
  config,
  planFile,
  stepIds,
  agentName,
  exitCode,
  stdout,
  stderr,
  repoRoot
) {
  const logFile = config.logging?.failureLogFile;
  if (!logFile) return;

  const logPath = path.join(repoRoot, logFile);

  // Ensure directory exists
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    planFile: path.basename(planFile),
    stepIds,
    agent: agentName,
    exitCode,
    stdout: stdout || "",
    stderr: stderr || "",
  };

  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(logPath, line, "utf8");
}

/**
 * Invoke an agent with a timeout
 * @param {Object} agentConfig - Agent configuration
 * @param {string} planFile - Path to plan file
 * @param {string[]} stepIds - Step IDs to execute
 * @param {string} repoRoot - Repository root path
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {Object} options - Options including callbacks
 * @returns {Promise<Object>} - Result with timedOut flag
 */
async function invokeAgentWithTimeout(
  agentConfig,
  planFile,
  stepIds,
  repoRoot,
  timeoutMs,
  options
) {
  const handle = invokeAgent(agentConfig, planFile, stepIds, repoRoot, options);

  if (!timeoutMs || timeoutMs <= 0) {
    const result = await handle.completion;
    return { ...result, timedOut: false };
  }

  // Race between completion and timeout
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      handle.kill();
      resolve({
        timedOut: true,
        stepIds,
        exitCode: null,
        stdout: "",
        stderr: "Process timed out",
      });
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      handle.completion.then((r) => ({ ...r, timedOut: false })),
      timeoutPromise,
    ]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Invoke an agent with automatic failover to next agent on infrastructure failures
 * @param {Object} config - Full orchestrator config
 * @param {string} planFile - Path to plan file
 * @param {string[]} stepIds - Step IDs to execute
 * @param {string} repoRoot - Repository root path
 * @param {Object} options - Options including callbacks
 * @returns {Object} - Handle with completion promise
 */
function invokeAgentWithFailover(
  config,
  planFile,
  stepIds,
  repoRoot,
  options = {}
) {
  const failoverConfig = config.failover || { enabled: false };

  // If failover is disabled, use default agent directly
  if (!failoverConfig.enabled) {
    const agentName = config.defaultAgent || Object.keys(config.agents)[0];
    const agentConfig = config.agents[agentName];
    const handle = invokeAgent(
      agentConfig,
      planFile,
      stepIds,
      repoRoot,
      options
    );
    // Wrap completion to include agentName and log failures
    return {
      ...handle,
      completion: handle.completion.then((result) => {
        if (result.exitCode !== 0 && result.exitCode !== null) {
          logFailure(
            config,
            planFile,
            stepIds,
            agentName,
            result.exitCode,
            result.stdout,
            result.stderr,
            repoRoot
          );
        }
        return { ...result, agentName };
      }),
    };
  }

  const agentPriority = config.agentPriority || [config.defaultAgent];

  // Filter to only configured agents
  const availableAgents = agentPriority.filter((name) => config.agents[name]);

  if (availableAgents.length === 0) {
    throw new Error("No agents configured");
  }

  let cancelled = false;
  let currentHandle = null;

  const completion = (async () => {
    let lastResult = null;
    let lastError = null;

    for (let i = 0; i < availableAgents.length; i++) {
      if (cancelled) break;

      const agentName = availableAgents[i];
      const agentConfig = config.agents[agentName];

      console.log(
        `[failover] Trying agent: ${agentName} (${i + 1}/${
          availableAgents.length
        })`
      );

      try {
        // Invoke with timeout wrapper
        const result = await invokeAgentWithTimeout(
          agentConfig,
          planFile,
          stepIds,
          repoRoot,
          failoverConfig.timeoutMs,
          options
        );

        // Log failures (non-zero exit) for debugging
        if (result.exitCode !== 0 && result.exitCode !== null) {
          logFailure(
            config,
            planFile,
            stepIds,
            agentName,
            result.exitCode,
            result.stdout,
            result.stderr,
            repoRoot
          );
        }

        // Check if we should failover
        const { shouldFailover, reason } = shouldTriggerFailover(
          result,
          null,
          result.timedOut,
          failoverConfig.errorPatterns || {}
        );

        if (shouldFailover && i < availableAgents.length - 1) {
          console.log(
            `[failover] Agent ${agentName} failed (${reason}), trying next agent`
          );
          lastResult = result;

          if (reason === "timeout") {
            logTimeout(config, planFile, stepIds, agentName, repoRoot);
          }
          continue;
        }

        // Either succeeded or no more agents to try
        return { ...result, agentName };
      } catch (spawnError) {
        const { shouldFailover, reason } = shouldTriggerFailover(
          null,
          spawnError,
          false,
          failoverConfig.errorPatterns || {}
        );

        if (shouldFailover && i < availableAgents.length - 1) {
          console.log(
            `[failover] Agent ${agentName} spawn failed (${reason}), trying next agent`
          );
          lastError = spawnError;
          continue;
        }

        // No more agents, rethrow
        throw spawnError;
      }
    }

    // All agents exhausted
    if (lastResult) return lastResult;
    if (lastError) throw lastError;
  })();

  return {
    process: null, // Not directly accessible with failover
    completion,
    stepIds,
    kill: () => {
      cancelled = true;
      if (currentHandle) currentHandle.kill();
    },
  };
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
  invokeAgentWithFailover,
  parseAgentResults,
  createDefaultResult,
  waitForAll,
  waitForAny,
};
