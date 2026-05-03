---
description: Review the current MDB file — fetch its content and comments, then submit changes and replies.
argument-hint: <file-path>
---

# MDB Review

Reviews a Markdown file open in MDB, addresses comments, and submits changes back.

## Step 1 — Discover the MDB port

The port is printed when mdb starts. Find it:
```bash
lsof -i -P | grep bun | grep LISTEN
```
Or check the browser URL — the port is in it.

## Step 2 — Fetch file and comments

```bash
PORT=<port>
FILE="$ARGUMENTS"
curl -s "http://localhost:$PORT/api/comments/export?path=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$FILE")"
```

This returns JSON with `filePath`, `fileContent`, and `comments` array.

## Step 3 — Review and plan changes

Read the file content and each comment. For each comment, draft a reply. If the file needs changes, prepare the new content.

## Step 4 — Submit changes and replies

```bash
curl -s -X POST "http://localhost:$PORT/api/ai/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "'$FILE'",
    "fileContent": null,
    "commentReplies": [
      {"parentId": "<comment-id>", "body": "<reply text>"}
    ]
  }'
```

Set `fileContent` to the full updated markdown string if making file changes, or `null` if only replying to comments.

Changes appear immediately in the MDB browser window via WebSocket.
