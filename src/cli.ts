import path from "node:path";
import { fileURLToPath } from "node:url";
import { stat, mkdir, writeFile, readFile } from "node:fs/promises";
import open from "open";
import { startServer } from "./server/index.js";
import { CommentsStore } from "./server/services/comments-store.js";
import {
  convertMarkdownFile,
  defaultOutputPath,
  parseConversionFormat,
} from "./server/services/conversion-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.basename(__dirname) === "dist" ? __dirname : path.resolve(__dirname, "../dist");

async function installSkill(): Promise<void> {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return;
  const sourcePath = path.join(distDir, "skills", "mdb-comments", "SKILL.md");
  let skillContent: string;
  try {
    skillContent = await readFile(sourcePath, "utf8");
  } catch {
    return;
  }

  const targets = [
    path.join(home, ".claude", "skills", "mdb-comments", "SKILL.md"),
    path.join(home, ".agents", "skills", "mdb-comments", "SKILL.md"),
    path.join(home, ".config", "opencode", "skills", "mdb-comments", "SKILL.md"),
  ];
  const installed: string[] = [];
  for (const skillPath of targets) {
    try {
      const current = await readFile(skillPath, "utf8").catch(() => null);
      if (current === skillContent) continue;
      await mkdir(path.dirname(skillPath), { recursive: true });
      await writeFile(skillPath, skillContent, "utf8");
      installed.push(path.relative(home, skillPath));
    } catch {
      // Skill installation is optional and must not prevent MDB from starting.
    }
  }
  if (installed.length > 0) console.log(`Installed MDB agent skill: ${installed.join(", ")}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "convert") {
    await runConvert(args);
    return;
  }
  if (command === "comments") {
    await runComments(args);
    return;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

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

  await installSkill();

  const port = await startServer(rootDir, distDir);
  const url = `http://localhost:${port}`;

  console.log(`Markdown Browser serving: ${rootDir}`);
  console.log(`Open in browser: ${url}`);

  await open(url);
}

async function runConvert(args: string[]): Promise<void> {
  const input = args[0];
  const formatValue = optionValue(args, "--to");
  if (!input || !formatValue) {
    throw new Error("Usage: mdb convert <file.md> --to <html|rtf|rich-text|docx|pdf> [--output <path>]");
  }
  const inputPath = path.resolve(input);
  const inputInfo = await stat(inputPath).catch(() => null);
  if (!inputInfo?.isFile()) throw new Error(`Markdown file does not exist: ${inputPath}`);

  const format = parseConversionFormat(formatValue.toLowerCase());
  const outputPath = path.resolve(optionValue(args, "--output") ?? defaultOutputPath(inputPath, format));
  if (outputPath === inputPath) throw new Error("Output path must differ from input path");
  await convertMarkdownFile(inputPath, outputPath, format);
  console.log(outputPath);
}

async function runComments(args: string[]): Promise<void> {
  const subcommand = args[0];
  const fileArg = args[1];
  if (!fileArg || !["list", "export", "reply", "block", "unblock"].includes(subcommand ?? "")) {
    throw new Error("Usage: mdb comments <list|export|reply|block|unblock> <file.md> [comment-id] [options]");
  }

  const absoluteFile = path.resolve(fileArg);
  const fileInfo = await stat(absoluteFile).catch(() => null);
  if (!fileInfo?.isFile()) throw new Error(`Markdown file does not exist: ${absoluteFile}`);
  const rootDir = path.dirname(absoluteFile);
  const filePath = path.basename(absoluteFile);
  const store = new CommentsStore(rootDir);
  try {
    if (subcommand === "reply") {
      const parentId = args[2];
      const body = optionValue(args, "--body");
      if (!parentId || !body) throw new Error("Usage: mdb comments reply <file.md> <comment-id> --body <text>");
      const reply = store.create({ filePath, parentId, body, author: "ai" });
      process.stdout.write(`${JSON.stringify(reply, null, 2)}\n`);
      return;
    }
    if (subcommand === "block" || subcommand === "unblock") {
      const commentId = args[2];
      if (!commentId) throw new Error(`Usage: mdb comments ${subcommand} <file.md> <comment-id>`);
      const comment = store.update(commentId, { filePath, blocking: subcommand === "block" });
      if (!comment) throw new Error(`Comment not found: ${commentId}`);
      process.stdout.write(`${JSON.stringify(comment, null, 2)}\n`);
      return;
    }

    const payload = { filePath, fileContent: await readFile(absoluteFile, "utf8"), comments: store.getByFile(filePath) };
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    if (subcommand === "export") {
      const output = path.resolve(optionValue(args, "--output") ?? `${absoluteFile}.review.json`);
      await writeFile(output, json, "utf8");
      console.log(output);
    } else {
      process.stdout.write(json);
    }
  } finally {
    store.close();
  }
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`Missing value for ${name}`);
  return value;
}

function printHelp(): void {
  console.log(`mdb [directory]
mdb convert <file.md> --to <html|rtf|rich-text|docx|pdf> [--output <path>]
mdb comments list <file.md>
mdb comments export <file.md> [--output <path>]
mdb comments reply <file.md> <comment-id> --body <text>
mdb comments <block|unblock> <file.md> <comment-id>`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
