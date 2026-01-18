const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const { loadPlan, savePlan } = require("../../orchestration/plan-loader");

const REQUIRED_STEP_FIELDS = ["id", "description"];
const VALID_STATUSES = ["pending", "in_progress", "complete", "blocked"];

/**
 * Check if a file path is a plan file that should be validated
 */
function isPlanFile(filePath) {
  return (
    filePath &&
    filePath.includes("work/plans/") &&
    (filePath.endsWith(".yaml") || filePath.endsWith(".yml"))
  );
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
    if (process.stdin.isTTY) {
      resolve("");
    }
  });
}

/**
 * Validate plan structure and return errors/warnings
 */
function validatePlanStructure(filePath) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(filePath)) {
    return { errors: [`File not found: ${filePath}`], warnings, data: null };
  }

  const content = fs.readFileSync(filePath, "utf8");

  let data;
  try {
    data = YAML.parse(content);
  } catch (err) {
    let errorMsg = `YAML Parse Error in ${path.basename(filePath)}:\n`;
    errorMsg += `  ${err.reason}`;
    if (err.mark) {
      errorMsg += `\n  Line ${err.mark.line + 1}, Column ${err.mark.column + 1}`;

      const lines = content.split("\n");
      const errorLine = err.mark.line;
      const startLine = Math.max(0, errorLine - 2);
      const endLine = Math.min(lines.length - 1, errorLine + 2);

      errorMsg += "\n\n  Context:";
      for (let i = startLine; i <= endLine; i++) {
        const prefix = i === errorLine ? ">>> " : "    ";
        errorMsg += `\n  ${prefix}${i + 1}: ${lines[i]}`;
      }
    }
    errorMsg += "\n\nCommon causes:";
    errorMsg += "\n  - Unquoted strings containing colons (use double quotes)";
    errorMsg += "\n  - Inconsistent indentation (use 2 spaces)";
    errorMsg += "\n  - Special characters in values (quote the entire value)";
    errorMsg += "\n\nExample fix:";
    errorMsg += '\n  BAD:  criteria: Output shows: timestamp';
    errorMsg += '\n  GOOD: criteria: "Output shows: timestamp"';

    return { errors: [errorMsg], warnings, data: null };
  }

  if (!data) {
    errors.push("Plan file is empty");
    return { errors, warnings, data: null };
  }

  // Check for steps array
  if (!data.steps) {
    errors.push("Missing required 'steps' array");
  } else if (!Array.isArray(data.steps)) {
    errors.push("'steps' must be an array");
  } else {
    const stepIds = new Set();

    data.steps.forEach((step, index) => {
      const stepLabel = step.id ? `step '${step.id}'` : `step at index ${index}`;

      for (const field of REQUIRED_STEP_FIELDS) {
        if (!step[field]) {
          errors.push(`${stepLabel}: missing required field '${field}'`);
        }
      }

      if (step.id) {
        if (stepIds.has(step.id)) {
          errors.push(`Duplicate step ID: '${step.id}'`);
        }
        stepIds.add(step.id);
      }

      if (step.status && !VALID_STATUSES.includes(step.status)) {
        errors.push(
          `${stepLabel}: invalid status '${step.status}' (must be one of: ${VALID_STATUSES.join(", ")})`
        );
      }

      if (step.deps) {
        if (!Array.isArray(step.deps)) {
          errors.push(`${stepLabel}: 'deps' must be an array`);
        } else {
          step.deps.forEach((dep) => {
            if (typeof dep !== "string") {
              errors.push(
                `${stepLabel}: dependency must be a string, got ${typeof dep}`
              );
            }
          });
        }
      }

      if (step.files && !Array.isArray(step.files)) {
        errors.push(`${stepLabel}: 'files' must be an array`);
      }

      if (step.commands && !Array.isArray(step.commands)) {
        errors.push(`${stepLabel}: 'commands' must be an array`);
      }

      if (
        step.criteria &&
        step.criteria.includes(": ") &&
        !step.criteria.startsWith('"')
      ) {
        warnings.push(
          `${stepLabel}: 'criteria' contains ': ' - ensure this field is properly quoted in source`
        );
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

  if (!data.metadata) {
    warnings.push("Missing 'metadata' section (recommended)");
  }

  return { errors, warnings, data };
}

/**
 * Validate a plan file and optionally re-save to normalize formatting
 */
function validatePlan(filePath, options = {}) {
  const { errors, warnings, data } = validatePlanStructure(filePath);

  console.log(`\nValidating: ${path.basename(filePath)}\n`);

  if (errors.length === 0 && warnings.length === 0) {
    console.log("✓ Plan is valid\n");
    const stepCount = data.steps ? data.steps.length : 0;
    console.log(`  Steps: ${stepCount}`);
    if (data.steps) {
      data.steps.forEach((step) => {
        const status = step.status || "pending";
        const desc = step.description || "";
        console.log(
          `    - ${step.id}: ${desc.substring(0, 50)}${desc.length > 50 ? "..." : ""} [${status}]`
        );
      });
    }
    console.log();

    // Re-save to normalize formatting (uses same format as orchestrator)
    if (!options.skipResave) {
      const plan = loadPlan(filePath);
      savePlan(plan);
    }

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

    // Re-save valid plans with warnings too
    if (errors.length === 0 && !options.skipResave) {
      const plan = loadPlan(filePath);
      savePlan(plan);
    }
  }

  return errors.length === 0;
}

/**
 * Run in hook mode - read file path from stdin JSON
 */
async function runAsHook() {
  const input = await readStdin();

  if (!input.trim()) {
    process.exit(0);
  }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const filePath = hookData?.tool_input?.file_path;

  if (!isPlanFile(filePath)) {
    process.exit(0);
  }

  const isValid = validatePlan(filePath);
  process.exit(isValid ? 0 : 2);
}

module.exports = registerValidatePlanCommand;
module.exports.validatePlanStructure = validatePlanStructure;

function registerValidatePlanCommand(program) {
  program
    .command("validate-plan")
    .description("Validate a plan YAML file and normalize its formatting")
    .argument("[file]", "Path to the plan file (or reads from stdin for hook mode)")
    .option("--no-resave", "Skip re-saving the file after validation")
    .action(async (file, options) => {
      if (!file) {
        // Hook mode - read from stdin
        await runAsHook();
        return;
      }

      const filePath = path.resolve(file);

      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${file}`);
        process.exitCode = 2;
        return;
      }

      const isValid = validatePlan(filePath, { skipResave: !options.resave });
      process.exitCode = isValid ? 0 : 2;
    });
};
