---
name: mdb-comments
description: Review Markdown files with MDB portable comment sidecars. Use when asked to address, reply to, inspect, block, or unblock MDB comments stored in <file>.mdb-comments.json.
---

# MDB Comments

Use MDB's CLI to read and update review threads. Comments live beside their Markdown file, so this workflow does not require an MDB server.

## Inspect review context

Run:

```bash
mdb comments list <file.md>
```

Output contains `fileContent` and flat `comments`. Top-level comments have `parentId: null`; replies point to their parent comment ID. Preserve comment IDs exactly.

## Address feedback

1. Read every open top-level thread and its replies.
2. Edit Markdown file directly when feedback requires content changes.
3. Keep edits scoped to requested feedback. Do not rewrite unrelated content.
4. Reply to each addressed thread:

```bash
mdb comments reply <file.md> <comment-id> --body "<concise reply>"
```

Replies should state what changed or why no change was made. Never claim a change without verifying file content.

## Blocking state

Change blocking state only when user asks or when explicitly resolving workflow state:

```bash
mdb comments block <file.md> <comment-id>
mdb comments unblock <file.md> <comment-id>
```

Do not unblock feedback merely because a reply was added. Confirm requested change is complete first.

## Export

Create a portable review snapshot only when requested:

```bash
mdb comments export <file.md> --output <review.json>
```

Do not edit `.mdb-comments.json` by hand. Use MDB commands so validation, timestamps, threading, and atomic writes remain intact.
