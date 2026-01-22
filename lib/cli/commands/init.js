const { installSkillsAction } = require("./install-skills");

function initAction(options) {
  console.log("Initializing Orrery...\n");

  // Install skills to detected agents
  installSkillsAction(options);
}

module.exports = function registerInitCommand(program) {
  program
    .command("init")
    .description("Initialize Orrery: install skills to detected agents")
    .option(
      "--agent <agent>",
      "Target agent (claude|codex|gemini|all); defaults to auto-detect"
    )
    .option("--force", "Overwrite existing skills")
    .option("--dry-run", "Show what would be copied without writing files")
    .action(initAction);
};
