import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderMarkdownToHtml } from "../../server/services/markdown-renderer.js";

export async function copy(args: string[]): Promise<void> {
  const inputFile = args[0];

  if (!inputFile) {
    console.error("Error: No input file specified");
    console.error("Usage: mdb copy <file>");
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

  const html = renderMarkdownToHtml(content);
  const tempFile = path.join(tmpdir(), `mdb-copy-${Date.now()}.html`);
  writeFileSync(tempFile, html, "utf-8");

  try {
    execFileSync("bash", ["-c", `textutil -convert rtf -stdout "${tempFile}" | pbcopy`]);
    console.log(`Copied ${path.basename(filePath)} as rich text to clipboard`);
  } catch (err) {
    console.error("Error: Failed to copy to clipboard. This command requires macOS.");
    process.exit(1);
  }
}
