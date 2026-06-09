#!/usr/bin/env node
const { runBench, formatText, formatJSON, formatMarkdown, parseArgs, HELP } = require("./src/index");

const { url, opts } = parseArgs(process.argv);

if (opts.help || !url) {
  console.log(HELP);
  process.exit(url ? 0 : 1);
}

if (!/^https?:\/\//.test(url)) {
  console.error("Error: URL must start with http:// or https://");
  process.exit(1);
}

(async () => {
  try {
    const data = await runBench(url, opts, (done, total) => {
      if (process.stderr.isTTY) {
        process.stderr.write(`\rProgress: ${done}/${total}`);
      }
    });
    if (process.stderr.isTTY) process.stderr.write("\r" + " ".repeat(30) + "\r");

    switch (opts.format) {
      case "json": console.log(formatJSON(url, opts, data)); break;
      case "markdown": console.log(formatMarkdown(url, opts, data)); break;
      default: console.log(formatText(url, opts, data));
    }
    process.exit(data.stats.errorCount > 0 && data.stats.successCount === 0 ? 1 : 0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
