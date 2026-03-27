const fs = require("fs");
const path = require("path");

const { getWorkDir } = require("./paths");

/**
 * Get the path to the stop signal file.
 * @param {string} [planId] - Optional plan ID for per-plan signals
 * @returns {string} - Path to the signal file
 */
function getStopSignalPath(planId) {
  const fileName = planId ? `stop-${planId}.signal` : "stop.signal";
  return path.join(getWorkDir(), fileName);
}

/**
 * Write a stop signal file to request graceful stop.
 * @param {string} [planId] - Optional plan ID for per-plan signals
 */
function requestStop(planId) {
  const signalPath = getStopSignalPath(planId);
  fs.writeFileSync(signalPath, new Date().toISOString() + "\n");
}

/**
 * Check if a stop signal has been requested.
 * @param {string} [planId] - Optional plan ID for per-plan signals
 * @returns {boolean}
 */
function isStopRequested(planId) {
  return fs.existsSync(getStopSignalPath(planId));
}

/**
 * Remove the stop signal file.
 * @param {string} [planId] - Optional plan ID for per-plan signals
 */
function clearStopSignal(planId) {
  try {
    fs.unlinkSync(getStopSignalPath(planId));
  } catch {
    // Ignore if file doesn't exist
  }
}

module.exports = {
  getStopSignalPath,
  requestStop,
  isStopRequested,
  clearStopSignal
};
