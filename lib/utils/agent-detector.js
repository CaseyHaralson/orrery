const fs = require("fs");
const os = require("os");
const path = require("path");

const AGENT_DIRS = {
  claude: ".claude",
  codex: ".codex",
  gemini: ".gemini",
};

function isDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch (error) {
    return false;
  }
}

function detectInstalledAgents() {
  const homeDir = os.homedir();
  if (!homeDir) {
    return [];
  }

  return Object.entries(AGENT_DIRS)
    .filter(([, dirName]) => isDirectory(path.join(homeDir, dirName)))
    .map(([agentName]) => agentName);
}

function getAgentSkillsDir(agent) {
  if (!agent) {
    return null;
  }

  const agentKey = agent.toLowerCase();
  const dirName = AGENT_DIRS[agentKey];
  if (!dirName) {
    return null;
  }

  return path.join(os.homedir(), dirName, "skills");
}

module.exports = {
  detectInstalledAgents,
  getAgentSkillsDir,
};
