import path from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { createFileRoutes } from "./routes/files";
import { createCommentRoutes } from "./routes/comments";
import { createAIRoutes } from "./routes/ai";
import { CommentsDB } from "./db/comments-db";
import { WSManager } from "./ws-manager";
import { FileWatcher } from "./services/watcher";

export function startServer(rootDir: string, distDir: string): number {
  const db = new CommentsDB(rootDir);
  const wsManager = new WSManager();
  const _fileWatcher = new FileWatcher();

  const settingsPath = path.join(rootDir, ".mdb/settings.json");
  async function getClaudeCliPath(): Promise<string> {
    try {
      const f = Bun.file(settingsPath);
      if (await f.exists()) {
        const s = await f.json();
        return s.claudeCliPath || "claude";
      }
    } catch {}
    return "claude";
  }

  const app = new Hono();

  app.route("/api", createFileRoutes(rootDir, (relativePath) => {
    wsManager.broadcast({ type: "file-changed", filePath: relativePath });
  }));

  app.route("/api", createCommentRoutes(rootDir, db));
  app.route("/api", createAIRoutes(rootDir, getClaudeCliPath, db, wsManager));

  app.use("/styles/*", serveStatic({ root: distDir }));
  app.use("/main.js", serveStatic({ root: distDir, path: "/main.js" }));
  app.use("/main.js.map", serveStatic({ root: distDir, path: "/main.js.map" }));
  app.use("/main.css", serveStatic({ root: distDir, path: "/main.css" }));
  app.get("*", serveStatic({ root: distDir, path: "/index.html" }));

  const server = Bun.serve({
    port: 0,
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        const success = server.upgrade(req);
        return success ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
      }
      return app.fetch(req);
    },
    websocket: {
      open(ws) { wsManager.open(ws); },
      message(ws, msg) { wsManager.handleMessage(ws, typeof msg === "string" ? msg : msg.toString()); },
      close(ws) { wsManager.close(ws); },
    },
  });

  return server.port;
}
