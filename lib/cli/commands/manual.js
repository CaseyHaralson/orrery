const fs = require("fs");
const path = require("path");

module.exports = function registerManualCommand(program) {
  program
    .command("manual")
    .description("Show the full CLI reference manual")
    .action(() => {
      const helpPath = path.join(__dirname, "..", "..", "..", "HELP.md");
      let content;
      try {
        content = fs.readFileSync(helpPath, "utf8");
      } catch {
        console.error(
          "HELP.md not found. The reference manual may not be included in this installation."
        );
        process.exitCode = 1;
        return;
      }
      process.stdout.write(content);
    });
};
