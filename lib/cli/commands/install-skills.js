const fs = require("fs");
const path = require("path");

const {
  detectInstalledAgents,
  getAgentSkillsDir
} = require("../../utils/agent-detector");
const { copySkills } = require("../../utils/skill-copier");

const SUPPORTED_AGENTS = ["claude", "codex", "gemini"];

function getSourceSkillsDir() {
  return path.join(__dirname, "..", "..", "..", "agent", "skills");
}

function listSkillDirectories(sourceDir) {
  if (!fs.existsSync(sourceDir)) {
    return [];
  }

  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function resolveRequestedAgents(agentOption) {
  if (!agentOption) {
    const detected = detectInstalledAgents();
    return {
      agents: detected,
      reason:
        detected.length === 0
          ? "No installed agents detected. Use --agent to override."
          : null
    };
  }

  const normalized = agentOption.toLowerCase();
  if (normalized === "all") {
    const detected = detectInstalledAgents();
    return {
      agents: detected,
      reason:
        detected.length === 0
          ? "No installed agents detected. Create an agent directory first."
          : null
    };
  }

  if (!SUPPORTED_AGENTS.includes(normalized)) {
    return {
      agents: [],
      reason: `Unknown agent: ${agentOption}. Expected one of ${SUPPORTED_AGENTS.join(
        ", "
      )} or "all".`
    };
  }

  return { agents: [normalized], reason: null };
}

function filterMissingAgents(agents) {
  const available = [];
  const missing = [];

  for (const agent of agents) {
    const skillsDir = getAgentSkillsDir(agent);
    if (!skillsDir) {
      missing.push({ agent, reason: "Unsupported agent." });
      continue;
    }

    const agentRoot = path.dirname(skillsDir);
    if (!fs.existsSync(agentRoot)) {
      missing.push({
        agent,
        reason: `Agent directory not found: ${agentRoot}`
      });
      continue;
    }

    available.push(agent);
  }

  return { available, missing };
}

function installSkillsAction(options) {
  const sourceDir = getSourceSkillsDir();
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source skills directory not found: ${sourceDir}`);
    process.exitCode = 1;
    return;
  }

  const skills = listSkillDirectories(sourceDir);
  if (skills.length === 0) {
    console.error(`No skills found in: ${sourceDir}`);
    process.exitCode = 1;
    return;
  }

  const { agents, reason } = resolveRequestedAgents(options.agent);
  if (reason && agents.length === 0) {
    console.warn(reason);
    if (options.agent && options.agent !== "all") {
      process.exitCode = 1;
    }
    return;
  }

  const { available, missing } = filterMissingAgents(agents);
  if (missing.length > 0) {
    for (const entry of missing) {
      console.warn(`Skipping ${entry.agent}: ${entry.reason}`);
    }
  }

  if (available.length === 0) {
    console.warn("No valid agent targets found.");
    return;
  }

  console.log(
    `Installing ${skills.length} skill${
      skills.length === 1 ? "" : "s"
    }: ${skills.join(", ")}`
  );
  if (options.dryRun) {
    console.log("Dry run enabled. No files will be written.");
  }

  let totalFiles = 0;

  for (const agent of available) {
    const targetDir = getAgentSkillsDir(agent);
    console.log(`\nAgent: ${agent}`);
    console.log(`Target: ${targetDir}`);

    try {
      const copiedFiles = copySkills(sourceDir, targetDir, {
        force: options.force,
        dryRun: options.dryRun
      });
      totalFiles += copiedFiles.length;
      console.log(
        `${
          options.dryRun ? "Would copy" : "Copied"
        } ${copiedFiles.length} file${copiedFiles.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      console.error(`Failed to install skills for ${agent}: ${error.message}`);
      process.exitCode = 1;
    }
  }

  console.log(
    `\nSummary: ${available.length} agent${
      available.length === 1 ? "" : "s"
    }, ${options.dryRun ? "would copy" : "copied"} ${totalFiles} file${
      totalFiles === 1 ? "" : "s"
    }.`
  );
}

function registerInstallSkillsCommand(program) {
  program
    .command("install-skills")
    .description("Install orrery skills for supported agents")
    .option(
      "--agent <agent>",
      "Target agent (claude|codex|gemini|all); defaults to auto-detect"
    )
    .option("--force", "Overwrite existing skills")
    .option("--dry-run", "Show what would be copied without writing files")
    .action(installSkillsAction);
}

module.exports = registerInstallSkillsCommand;
module.exports.installSkillsAction = installSkillsAction;
