#!/usr/bin/env bun

import path from "node:path";
import { stat } from "node:fs/promises";
import open from "open";
import { startServer } from "./server/index";

const packageDir = path.resolve(import.meta.dir, "..");

async function main() {
  const dirArg = process.argv[2] ?? process.cwd();
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

  process.chdir(packageDir);

  const port = startServer(rootDir);
  const url = `http://localhost:${port}`;

  console.log(`Markdown Browser serving: ${rootDir}`);
  console.log(`Open in browser: ${url}`);

  await open(url);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
