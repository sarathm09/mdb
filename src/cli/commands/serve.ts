import path from "node:path";
import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";
import open from "open";
import { startServer } from "../../server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "client");

export async function serve(args: string[]): Promise<void> {
  const dirArg = args[0] ?? process.cwd();
  const rootDir = path.resolve(dirArg);

  try {
    const info = await stat(rootDir);
    if (!info.isDirectory()) {
      console.error(`Error: ${rootDir} is not a directory`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: Directory does not exist: ${rootDir}`);
    process.exit(1);
  }

  const port = await startServer(rootDir, distDir);
  const url = `http://localhost:${port}`;

  console.log(`Markdown Browser serving: ${rootDir}`);
  console.log(`Open in browser: ${url}`);

  await open(url);
}
