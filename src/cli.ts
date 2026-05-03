import path from "node:path";
import { fileURLToPath } from "node:url";
import { stat, mkdir, writeFile, access } from "node:fs/promises";
import open from "open";
import { startServer } from "./server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = __dirname;

const MDB_REVIEW_SKILL = `---
description: Review an MDB file — fetch its content and comments, then submit changes and replies back.
argument-hint: <file-path>
---

# MDB Review

Reviews a Markdown file open in MDB, addresses comments, and submits changes back to the running MDB server. Changes appear in the browser immediately via WebSocket.

## Step 1 — Get the MDB port

The port is printed to the terminal when \`mdb\` starts, e.g. \`Open in browser: http://localhost:54321\`. Set it:
\`\`\`bash
PORT=<port from terminal>
\`\`\`

## Step 2 — Fetch file and comments

\`\`\`bash
FILE="$ARGUMENTS"
curl -s "http://localhost:$PORT/api/comments/export?path=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$FILE")"
\`\`\`

This returns JSON: \`{ filePath, fileContent, comments[] }\`. Each comment has \`id\`, \`author\`, \`body\`, \`sourceLine\`, \`selectionText\`, and \`parentId\` (null for top-level, set for replies).

## Step 3 — Review the file and comments

Read the file content and each top-level comment (where \`parentId\` is null). For each:
- Draft a reply addressing the feedback
- If file changes are needed, prepare the full updated content

## Step 4 — Submit changes and replies

\`\`\`bash
curl -s -X POST "http://localhost:$PORT/api/ai/apply" \\
  -H "Content-Type: application/json" \\
  -d '{
    "filePath": "'$FILE'",
    "fileContent": null,
    "commentReplies": [
      {"parentId": "<comment-id>", "body": "<your reply in markdown>"}
    ]
  }'
\`\`\`

Set \`fileContent\` to the full updated markdown string if making file changes, or \`null\` to only reply to comments. The browser reflects all changes instantly.
`;

async function installSkill(): Promise<void> {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return;
  const commandsDir = path.join(home, ".claude", "commands");
  const skillPath = path.join(commandsDir, "mdb-review.md");
  try {
    await access(skillPath);
  } catch {
    try {
      await mkdir(commandsDir, { recursive: true });
      await writeFile(skillPath, MDB_REVIEW_SKILL, "utf8");
      console.log(`Installed Claude Code skill: ~/.claude/commands/mdb-review.md`);
    } catch {
      // Non-fatal — Claude Code may not be installed
    }
  }
}

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

  await installSkill();

  const port = await startServer(rootDir, distDir);
  const url = `http://localhost:${port}`;

  console.log(`Markdown Browser serving: ${rootDir}`);
  console.log(`Open in browser: ${url}`);

  await open(url);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
