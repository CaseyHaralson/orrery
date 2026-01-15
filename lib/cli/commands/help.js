module.exports = function registerHelpCommand(program) {
  program
    .command("help [command]")
    .description("Display help for a command")
    .action((command) => {
      if (!command) {
        program.outputHelp();
        return;
      }

      const subcommand = program.commands.find((cmd) => cmd.name() === command);
      if (!subcommand) {
        console.error(`Unknown command: ${command}`);
        program.outputHelp();
        process.exitCode = 1;
        return;
      }

      subcommand.outputHelp();
    });
};
