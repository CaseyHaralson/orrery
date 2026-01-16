const { orchestrate } = require("../../orchestration");

module.exports = function registerOrchestrateCommand(program) {
  program
    .command("orchestrate")
    .alias("exec")
    .description("Run plan orchestration for the current project")
    .option("--plan <file>", "Process only a specific plan file")
    .option("--dry-run", "Show what would be executed without running agents")
    .option("--verbose", "Show detailed agent output")
    .option("--resume", "Resume orchestration on the current work branch")
    .action(async (options) => {
      try {
        await orchestrate({
          plan: options.plan,
          dryRun: options.dryRun,
          verbose: options.verbose,
          resume: options.resume,
        });
      } catch (error) {
        console.error(error && error.message ? error.message : error);
        process.exitCode = 1;
      }
    });
};
