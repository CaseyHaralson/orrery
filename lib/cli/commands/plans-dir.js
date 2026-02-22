const { getPlansDir } = require("../../utils/paths");

module.exports = function registerPlansDirCommand(program) {
  program
    .command("plans-dir")
    .description("Print the resolved plans directory path")
    .action(() => {
      console.log(getPlansDir());
    });
};
