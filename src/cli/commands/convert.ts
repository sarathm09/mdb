import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderMarkdownToStandaloneHtml } from "../../server/services/markdown-renderer.js";

export async function convert(args: string[]): Promise<void> {
  let outputFile: string | null = null;
  let inputFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--output" || args[i] === "-o") && args[i + 1]) {
      outputFile = args[++i];
    } else if (!inputFile) {
      inputFile = args[i];
    }
  }

  if (!inputFile) {
    console.error("Error: No input file specified");
    console.error("Usage: mdb convert <file> [--output <file>]");
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
  const html = renderMarkdownToStandaloneHtml(content, title);

  if (outputFile) {
    writeFileSync(path.resolve(outputFile), html, "utf-8");
    console.log(`Written to ${path.resolve(outputFile)}`);
  } else {
    process.stdout.write(html);
  }
}
