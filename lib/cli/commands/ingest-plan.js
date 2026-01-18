const fs = require("fs");
const path = require("path");

const { getPlansDir } = require("../../utils/paths");
const { validatePlanStructure } = require("./validate-plan");

module.exports = function registerIngestPlanCommand(program) {
  program
    .command("ingest-plan")
    .description("Validate and import a plan file into the plans directory")
    .argument("<file>", "Path to the plan file to ingest")
    .option("--force", "Overwrite existing plan file if it exists")
    .action((file, options) => {
      const sourcePath = path.resolve(file);

      if (!fs.existsSync(sourcePath)) {
        console.error(`File not found: ${file}`);
        process.exitCode = 1;
        return;
      }

      const { errors, warnings } = validatePlanStructure(sourcePath);

      if (errors.length > 0) {
        console.error("Validation errors:\n");
        errors.forEach((err) => console.error(`  - ${err}`));
        console.error();
        process.exitCode = 2;
        return;
      }

      if (warnings.length > 0) {
        console.warn("Warnings:\n");
        warnings.forEach((warn) => console.warn(`  - ${warn}`));
        console.warn();
      }

      const plansDir = getPlansDir();
      if (!fs.existsSync(plansDir)) {
        fs.mkdirSync(plansDir, { recursive: true });
      }

      const fileName = path.basename(sourcePath);
      const destPath = path.join(plansDir, fileName);

      if (fs.existsSync(destPath) && !options.force) {
        console.error(`Plan already exists: ${destPath}`);
        console.error("Use --force to overwrite");
        process.exitCode = 1;
        return;
      }

      fs.copyFileSync(sourcePath, destPath);
      console.log(`Plan ingested: ${destPath}`);
    });
};
