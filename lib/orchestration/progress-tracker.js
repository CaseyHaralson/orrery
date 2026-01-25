/**
 * Progress Tracker for Plan Orchestration
 *
 * Tracks step completion, elapsed time, and provides ETA estimates
 * during plan execution.
 */

class ProgressTracker {
  /**
   * @param {number} totalSteps - Total number of steps in the plan
   * @param {string} planFileName - Name of the plan file for display
   */
  constructor(totalSteps, planFileName) {
    this.totalSteps = totalSteps;
    this.planFileName = planFileName;
    this.completedCount = 0;
    this.blockedCount = 0;
    this.startTime = Date.now();
    this.stepCompletionTimes = []; // Duration of each completed step
    this.stepStartTimes = new Map(); // stepId -> startTime
    this.isFirstStep = true;
  }

  /**
   * Initialize counts from existing plan state (for resume mode)
   * @param {Object} plan - The loaded plan object
   */
  initializeFromPlan(plan) {
    for (const step of plan.steps) {
      if (step.status === "complete") {
        this.completedCount++;
      } else if (step.status === "blocked") {
        this.blockedCount++;
      }
    }
  }

  /**
   * Record when step(s) begin execution
   * @param {string[]} stepIds - Array of step IDs starting
   */
  recordStart(stepIds) {
    const now = Date.now();
    for (const stepId of stepIds) {
      this.stepStartTimes.set(stepId, now);
    }
  }

  /**
   * Record a step completing successfully
   * @param {string} stepId - The completed step ID
   */
  recordComplete(stepId) {
    this.completedCount++;
    const startTime = this.stepStartTimes.get(stepId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.stepCompletionTimes.push(duration);
      this.stepStartTimes.delete(stepId);
    }
  }

  /**
   * Record a step becoming blocked
   * @param {string} stepId - The blocked step ID
   */
  recordBlocked(stepId) {
    this.blockedCount++;
    this.stepStartTimes.delete(stepId);
  }

  /**
   * Get elapsed time since tracking started
   * @returns {number} Elapsed time in milliseconds
   */
  getElapsed() {
    return Date.now() - this.startTime;
  }

  /**
   * Get estimated time remaining based on average step duration
   * @returns {number|null} Estimated remaining time in ms, or null if not calculable
   */
  getEstimatedRemaining() {
    if (this.stepCompletionTimes.length === 0) {
      return null; // No data yet
    }

    const avgStepTime =
      this.stepCompletionTimes.reduce((a, b) => a + b, 0) /
      this.stepCompletionTimes.length;

    const remainingSteps =
      this.totalSteps - this.completedCount - this.blockedCount;

    return avgStepTime * remainingSteps;
  }

  /**
   * Format duration in human-readable format
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted string like "2m 30s" or "1h 5m"
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return "<1s";
    }

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get completion percentage
   * @returns {number} Percentage complete (0-100)
   */
  getPercentComplete() {
    const processed = this.completedCount + this.blockedCount;
    return Math.round((processed / this.totalSteps) * 100);
  }

  /**
   * Log the start of plan execution
   */
  logStart() {
    const initialComplete = this.completedCount;
    const initialBlocked = this.blockedCount;
    const pending = this.totalSteps - initialComplete - initialBlocked;

    console.log(`[Progress] Starting plan: ${this.planFileName}`);
    console.log(
      `[Progress] Total steps: ${this.totalSteps} (${pending} pending, ${initialComplete} complete, ${initialBlocked} blocked)`
    );
  }

  /**
   * Log when step(s) start
   * @param {string[]} stepIds - Array of step IDs starting
   */
  logStepStart(stepIds) {
    if (this.isFirstStep) {
      this.isFirstStep = false;
    } else {
      console.log("");
      console.log("----------------------------------------");
    }
    this.recordStart(stepIds);
    const processed = this.completedCount + this.blockedCount;
    const stepList = stepIds.join(", ");

    if (stepIds.length === 1) {
      console.log(
        `[Progress] Starting ${stepList} (${processed + 1} of ${this.totalSteps})`
      );
    } else {
      console.log(
        `[Progress] Starting ${stepIds.length} steps: ${stepList} (${processed + 1}-${processed + stepIds.length} of ${this.totalSteps})`
      );
    }
  }

  /**
   * Log current progress after step completion
   */
  logProgress() {
    const processed = this.completedCount + this.blockedCount;
    const percent = this.getPercentComplete();
    const elapsed = this.formatDuration(this.getElapsed());
    const eta = this.getEstimatedRemaining();

    let progressLine = `[Progress] ${processed}/${this.totalSteps} steps (${percent}%) | Elapsed: ${elapsed}`;

    if (eta !== null) {
      progressLine += ` | ETA: ${this.formatDuration(eta)}`;
    } else {
      progressLine += " | ETA: Calculating...";
    }

    console.log(progressLine);
  }

  /**
   * Log final summary when plan execution ends
   */
  logSummary() {
    const totalTime = this.formatDuration(this.getElapsed());
    const avgTime =
      this.stepCompletionTimes.length > 0
        ? this.formatDuration(
            this.stepCompletionTimes.reduce((a, b) => a + b, 0) /
              this.stepCompletionTimes.length
          )
        : "N/A";

    console.log(`[Progress] === Summary ===`);
    console.log(
      `[Progress] Total: ${this.totalSteps} steps (${this.completedCount} complete, ${this.blockedCount} blocked)`
    );
    console.log(`[Progress] Time: ${totalTime}`);
    console.log(`[Progress] Avg step time: ${avgTime}`);
  }
}

module.exports = { ProgressTracker };
