import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import open from "open";
import { generatePresentation } from "../../server/services/presentation-generator.js";

export async function present(args: string[]): Promise<void> {
  let outputFile: string | null = null;
  let inputFile: string | null = null;
  let shouldOpen = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--output" || args[i] === "-o") && args[i + 1]) {
      outputFile = args[++i];
    } else if (args[i] === "--open") {
      shouldOpen = true;
    } else if (!inputFile) {
      inputFile = args[i];
    }
  }

  if (!inputFile) {
    console.error("Error: No input file specified");
    console.error("Usage: mdb present <file> [--output <file>] [--open]");
    process.exit(1);
  }

  const filePath = path.resolve(inputFile);
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file: ${filePath}`);
    process.exit(1);
  }

  const title = path.basename(filePath, path.extname(filePath));
  const html = generatePresentation(content, title);

  const outPath = outputFile
    ? path.resolve(outputFile)
    : filePath.replace(/\.(md|markdown)$/i, "") + ".presentation.html";

  writeFileSync(outPath, html, "utf-8");
  console.log(`Presentation written to ${outPath}`);

  if (shouldOpen) {
    await open(outPath);
  }
}
