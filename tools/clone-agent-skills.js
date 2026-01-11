#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = 'agent/skills';
const REPO_ROOT = path.join(__dirname, '..');
const AGENT_DIRECTORIES = ['.claude', '.codex', '.gemini'];

/**
 * Recursively copy directory contents
 */
function copyDirectory(source, destination) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  // Read all items in source directory
  const items = fs.readdirSync(source);

  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
      // Recursively copy subdirectories
      copyDirectory(sourcePath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Scanning for agent directories...\n');

  const sourcePath = path.join(REPO_ROOT, SOURCE_DIR);

  // Check if source directory exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  // Filter to only agent directories that exist
  const agentDirs = AGENT_DIRECTORIES.filter(dir => {
    const fullPath = path.join(REPO_ROOT, dir);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  });

  if (agentDirs.length === 0) {
    console.log('⚠️  No target agent directories found');
    console.log(`   Looking for: ${AGENT_DIRECTORIES.join(', ')}`);
    console.log('   Create one of these directories to clone skills to them.');
    process.exit(0);
  }

  console.log(`Found ${agentDirs.length} agent director${agentDirs.length === 1 ? 'y' : 'ies'}:`);
  agentDirs.forEach(dir => console.log(`  - ${dir}`));
  console.log();

  // Clone skills to each agent directory
  let totalCloned = 0;

  for (const agentDir of agentDirs) {
    const targetPath = path.join(REPO_ROOT, agentDir, 'skills');

    console.log(`📦 Cloning skills to ${agentDir}/skills/`);

    try {
      copyDirectory(sourcePath, targetPath);

      // Count skills cloned
      const skills = fs.readdirSync(sourcePath).filter(item => {
        return fs.statSync(path.join(sourcePath, item)).isDirectory();
      });

      console.log(`   ✓ Cloned ${skills.length} skills: ${skills.join(', ')}`);
      totalCloned += skills.length;
    } catch (error) {
      console.error(`   ✗ Error cloning to ${agentDir}: ${error.message}`);
    }

    console.log();
  }

  console.log(`✨ Done! Cloned ${totalCloned} total skill${totalCloned === 1 ? '' : 's'} across ${agentDirs.length} agent director${agentDirs.length === 1 ? 'y' : 'ies'}.`);
}

main();
