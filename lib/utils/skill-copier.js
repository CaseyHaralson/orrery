const fs = require("fs");
const path = require("path");

function ensureDir(dirPath, mode, dryRun) {
  if (dryRun) {
    return;
  }
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode });
  }
  if (mode) {
    fs.chmodSync(dirPath, mode);
  }
}

function copyFile(sourcePath, targetPath, mode, options) {
  const { dryRun, force } = options;

  if (fs.existsSync(targetPath) && !force) {
    console.warn(`Skipping existing file: ${targetPath}`);
    return false;
  }

  if (dryRun) {
    console.log(`[dry-run] copy ${sourcePath} -> ${targetPath}`);
    return true;
  }

  ensureDir(path.dirname(targetPath), null, dryRun);
  fs.copyFileSync(sourcePath, targetPath);
  if (mode) {
    fs.chmodSync(targetPath, mode);
  }
  return true;
}

function copyDirectory(sourceDir, targetDir, options, copiedFiles) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const sourceStat = fs.statSync(sourceDir);
  ensureDir(targetDir, sourceStat.mode, options.dryRun);

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    const entryStat = fs.statSync(sourcePath);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, options, copiedFiles);
      continue;
    }

    if (copyFile(sourcePath, targetPath, entryStat.mode, options)) {
      copiedFiles.push(targetPath);
    }
  }
}

function copySkills(sourceDir, targetDir, options = {}) {
  const normalizedOptions = {
    force: Boolean(options.force),
    dryRun: Boolean(options.dryRun)
  };

  if (!sourceDir || !targetDir) {
    throw new Error("copySkills requires sourceDir and targetDir.");
  }

  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  const copiedFiles = [];
  copyDirectory(sourceDir, targetDir, normalizedOptions, copiedFiles);
  return copiedFiles;
}

module.exports = {
  copySkills
};
