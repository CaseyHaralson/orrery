#!/usr/bin/env node

/**
 * Plan YAML Validator
 *
 * Validates that a plan file contains valid YAML and conforms to the expected schema.
 *
 * Usage modes:
 *   1. CLI: node agent/scripts/validate-plan.js <path-to-plan.yaml>
 *   2. Hook: Receives JSON via stdin from Claude Code PostToolUse hook
 *
 * Exit codes:
 *   0 - Valid YAML, or file is not a plan (ignored)
 *   2 - Invalid YAML (blocks hook, shows error to Claude)
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const REQUIRED_STEP_FIELDS = ["id", "description", "owner"];
const VALID_STATUSES = ["pending", "in_progress", "complete", "blocked"];

function validatePlan(filePath) {
  const errors = [];
  const warnings = [];

  // Check file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Read file content
  const content = fs.readFileSync(filePath, "utf8");

  // Parse YAML
  let data;
  try {
    data = yaml.load(content);
  } catch (err) {
    console.error(`\nYAML Parse Error in ${path.basename(filePath)}:\n`);
    console.error(`  ${err.reason}`);
    if (err.mark) {
      console.error(`  Line ${err.mark.line + 1}, Column ${err.mark.column + 1}`);

      // Show context around the error
      const lines = content.split("\n");
      const errorLine = err.mark.line;
      const startLine = Math.max(0, errorLine - 2);
      const endLine = Math.min(lines.length - 1, errorLine + 2);

      console.error("\n  Context:");
      for (let i = startLine; i <= endLine; i++) {
        const prefix = i === errorLine ? ">>> " : "    ";
        console.error(`  ${prefix}${i + 1}: ${lines[i]}`);
      }
    }

    console.error("\nCommon causes:");
    console.error("  - Unquoted strings containing colons (use double quotes)");
    console.error("  - Inconsistent indentation (use 2 spaces)");
    console.error("  - Special characters in values (quote the entire value)");
    console.error("\nExample fix:");
    console.error('  BAD:  criteria: Output shows: timestamp');
    console.error('  GOOD: criteria: "Output shows: timestamp"');

    process.exit(1);
  }

  // Validate structure
  if (!data) {
    errors.push("Plan file is empty");
  } else {
    // Check for steps array
    if (!data.steps) {
      errors.push("Missing required 'steps' array");
    } else if (!Array.isArray(data.steps)) {
      errors.push("'steps' must be an array");
    } else {
      // Validate each step
      const stepIds = new Set();

      data.steps.forEach((step, index) => {
        const stepLabel = step.id ? `step '${step.id}'` : `step at index ${index}`;

        // Check required fields
        for (const field of REQUIRED_STEP_FIELDS) {
          if (!step[field]) {
            errors.push(`${stepLabel}: missing required field '${field}'`);
          }
        }

        // Check for duplicate IDs
        if (step.id) {
          if (stepIds.has(step.id)) {
            errors.push(`Duplicate step ID: '${step.id}'`);
          }
          stepIds.add(step.id);
        }

        // Validate status if present
        if (step.status && !VALID_STATUSES.includes(step.status)) {
          errors.push(`${stepLabel}: invalid status '${step.status}' (must be one of: ${VALID_STATUSES.join(", ")})`);
        }

        // Validate deps if present
        if (step.deps) {
          if (!Array.isArray(step.deps)) {
            errors.push(`${stepLabel}: 'deps' must be an array`);
          } else {
            // Check deps reference valid step IDs (will validate after all steps processed)
            step.deps.forEach((dep) => {
              if (typeof dep !== "string") {
                errors.push(`${stepLabel}: dependency must be a string, got ${typeof dep}`);
              }
            });
          }
        }

        // Validate files if present
        if (step.files && !Array.isArray(step.files)) {
          errors.push(`${stepLabel}: 'files' must be an array`);
        }

        // Validate commands if present
        if (step.commands && !Array.isArray(step.commands)) {
          errors.push(`${stepLabel}: 'commands' must be an array`);
        }

        // Warn about common issues
        if (step.criteria && step.criteria.includes(": ") && !step.criteria.startsWith('"')) {
          warnings.push(`${stepLabel}: 'criteria' contains ': ' - ensure this field is properly quoted in source`);
        }
      });

      // Validate dependency references
      data.steps.forEach((step) => {
        if (step.deps && Array.isArray(step.deps)) {
          step.deps.forEach((dep) => {
            if (!stepIds.has(dep)) {
              errors.push(`step '${step.id}': references unknown dependency '${dep}'`);
            }
          });
        }
      });
    }

    // Check metadata (optional but recommended)
    if (!data.metadata) {
      warnings.push("Missing 'metadata' section (recommended)");
    }
  }

  // Output results
  console.log(`\nValidating: ${path.basename(filePath)}\n`);

  if (errors.length === 0 && warnings.length === 0) {
    console.log("✓ Plan is valid\n");
    const stepCount = data.steps ? data.steps.length : 0;
    console.log(`  Steps: ${stepCount}`);
    if (data.steps) {
      data.steps.forEach((step) => {
        const status = step.status || "pending";
        console.log(`    - ${step.id}: ${step.description.substring(0, 50)}${step.description.length > 50 ? "..." : ""} [${status}]`);
      });
    }
    console.log();
    return true;
  }

  if (errors.length > 0) {
    console.error("✗ Validation errors:\n");
    errors.forEach((err) => console.error(`  - ${err}`));
    console.error();
  }

  if (warnings.length > 0) {
    console.warn("⚠ Warnings:\n");
    warnings.forEach((warn) => console.warn(`  - ${warn}`));
    console.warn();
  }

  return errors.length === 0;
}

/**
 * Check if a file path is a plan file that should be validated
 */
function isPlanFile(filePath) {
  return filePath &&
    filePath.includes("work/plans/") &&
    (filePath.endsWith(".yaml") || filePath.endsWith(".yml"));
}

/**
 * Read JSON from stdin (for hook mode)
 */
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("readable", () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    // Handle case where stdin is empty or not piped
    if (process.stdin.isTTY) {
      resolve("");
    }
  });
}

/**
 * Run in hook mode - read file path from stdin JSON
 */
async function runAsHook() {
  const input = await readStdin();

  if (!input.trim()) {
    // No stdin input, exit silently
    process.exit(0);
  }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch {
    // Invalid JSON, not a hook call - exit silently
    process.exit(0);
  }

  const filePath = hookData?.tool_input?.file_path;

  if (!isPlanFile(filePath)) {
    // Not a plan file, ignore silently
    process.exit(0);
  }

  const isValid = validatePlan(filePath);
  // Exit code 2 blocks the action and shows error to Claude
  process.exit(isValid ? 0 : 2);
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No CLI args - try hook mode (read from stdin)
    runAsHook();
  } else {
    // CLI mode
    const filePath = path.resolve(args[0]);
    const isValid = validatePlan(filePath);
    process.exit(isValid ? 0 : 2);
  }
}

module.exports = { validatePlan, isPlanFile };
