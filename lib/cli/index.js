const path = require("path");
const { Command } = require("commander");

const registerInit = require("./commands/init");
const registerInstallSkills = require("./commands/install-skills");
const registerInstallDevcontainer = require("./commands/install-devcontainer");
const registerOrchestrate = require("./commands/orchestrate");
const registerStatus = require("./commands/status");
const registerResume = require("./commands/resume");
const registerValidatePlan = require("./commands/validate-plan");
const registerIngestPlan = require("./commands/ingest-plan");
const registerManual = require("./commands/manual");
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
    .description("Structured workflow orchestration for AI agents")
    .version(getPackageVersion(), "-v, --version")
    .showHelpAfterError();

  registerInit(program);
  registerInstallSkills(program);
  registerInstallDevcontainer(program);
  registerOrchestrate(program);
  registerStatus(program);
  registerResume(program);
  registerValidatePlan(program);
  registerIngestPlan(program);
  registerManual(program);
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
  run
};
