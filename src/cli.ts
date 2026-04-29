import { serve } from "./cli/commands/serve.js";
import { convert } from "./cli/commands/convert.js";
import { copy } from "./cli/commands/copy.js";
import { present } from "./cli/commands/present.js";
import { help } from "./cli/commands/help.js";
import { version } from "./cli/commands/version.js";

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  serve,
  open: serve,
  convert,
  copy,
  present,
  help,
  version,
};

async function main() {
  const arg = process.argv[2];
  const rest = process.argv.slice(3);

  if (!arg) {
    await serve([]);
    return;
  }

  if (arg === "--help" || arg === "-h") {
    await help();
    return;
  }

  if (arg === "--version" || arg === "-v") {
    await version();
    return;
  }

  const command = COMMANDS[arg];
  if (command) {
    await command(rest);
    return;
  }

  await serve([arg]);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
