const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function getProjectRoot() {
  return path.join(__dirname, "..", "..", "..");
}

function getSourceDevcontainerDir() {
  return path.join(getProjectRoot(), ".devcontainer.example");
}

function getPackFilename() {
  const packageJsonPath = path.join(getProjectRoot(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const packageName = packageJson.name;
  const packageVersion = packageJson.version;

  if (!packageName || !packageVersion) {
    return null;
  }

  const sanitizedName = packageName.replace(/^@/, "").replace(/\//g, "-");
  return `${sanitizedName}-${packageVersion}.tgz`;
}

function copyDirectory(src, dest, options = {}) {
  const { dryRun = false } = options;
  const copiedFiles = [];

  if (!dryRun) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      const subFiles = copyDirectory(srcPath, destPath, options);
      copiedFiles.push(...subFiles);
    } else {
      if (!dryRun) {
        fs.copyFileSync(srcPath, destPath);
      }
      copiedFiles.push(destPath);
    }
  }

  return copiedFiles;
}

module.exports = function registerInstallDevcontainerCommand(program) {
  program
    .command("install-devcontainer")
    .description("Copy the orrery devcontainer to a target directory")
    .argument("[target]", "Target directory", process.cwd())
    .option("--force", "Overwrite existing devcontainer")
    .option("--dry-run", "Show what would be copied without writing files")
    .action((target, options) => {
      const sourceDir = getSourceDevcontainerDir();
      if (!fs.existsSync(sourceDir)) {
        console.error(`Source .devcontainer not found: ${sourceDir}`);
        process.exitCode = 1;
        return;
      }

      const targetDir = path.resolve(target);
      const destDevcontainer = path.join(targetDir, ".devcontainer");

      if (!fs.existsSync(targetDir)) {
        console.error(`Target directory does not exist: ${targetDir}`);
        process.exitCode = 1;
        return;
      }

      if (fs.existsSync(destDevcontainer)) {
        if (!options.force) {
          console.error(
            `Devcontainer already exists at: ${destDevcontainer}\nUse --force to overwrite.`
          );
          process.exitCode = 1;
          return;
        }
        console.log("Overwriting existing devcontainer (--force).");
      }

      if (options.dryRun) {
        console.log("Dry run enabled. No files will be written.");
      }

      console.log(`Source: ${sourceDir}`);
      console.log(`Target: ${destDevcontainer}`);

      try {
        const packedFilename = getPackFilename();
        if (!options.dryRun) {
          execSync("npm pack --silent --pack-destination .devcontainer.example", {
            cwd: getProjectRoot(),
            stdio: "pipe",
          });
        } else {
          console.log("Dry run enabled. Skipping npm pack.");
        }

        const copiedFiles = copyDirectory(sourceDir, destDevcontainer, {
          dryRun: options.dryRun,
        });

        console.log(
          `${options.dryRun ? "Would copy" : "Copied"} ${copiedFiles.length} file${
            copiedFiles.length === 1 ? "" : "s"
          }.`
        );

        if (!options.dryRun && packedFilename) {
          const packedPath = path.join(sourceDir, packedFilename);
          if (fs.existsSync(packedPath)) {
            fs.unlinkSync(packedPath);
          }
        }
      } catch (error) {
        console.error(`Failed to copy devcontainer: ${error.message}`);
        process.exitCode = 1;
      }
    });
};
