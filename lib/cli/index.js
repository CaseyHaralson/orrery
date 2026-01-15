const path = require("path");
const { Command } = require("commander");

const registerInstallSkills = require("./commands/install-skills");
const registerOrchestrate = require("./commands/orchestrate");
const registerStatus = require("./commands/status");
const registerHelp = require("./commands/help");

function getPackageVersion() {
  const pkgPath = path.join(__dirname, "..", "..", "package.json");
  const pkg = require(pkgPath);
  return pkg.version || "0.0.0";
}

function buildProgram() {
  const program = new Command();

  program
    .name("orrery")
    .description("Agent skill management and workflow orchestration")
    .version(getPackageVersion())
    .showHelpAfterError();

  registerInstallSkills(program);
  registerOrchestrate(program);
  registerStatus(program);
  registerHelp(program);

  program.on("command:*", (operands) => {
    const [command] = operands;
    console.error(`Unknown command: ${command}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  return program;
}

function run(argv) {
  const program = buildProgram();
  program.parse(argv);
}

module.exports = {
  buildProgram,
  run,
};
