import path from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { createFileRoutes } from "./routes/files";

const packageDir = path.resolve(import.meta.dir, "../..");
const distDir = path.join(packageDir, "dist");

export function startServer(rootDir: string): number {
  const app = new Hono();

  app.route("/api", createFileRoutes(rootDir));

  app.use("/styles/*", serveStatic({ root: distDir }));
  app.use("/main.js", serveStatic({ root: distDir, path: "/main.js" }));
  app.use("/main.js.map", serveStatic({ root: distDir, path: "/main.js.map" }));
  app.use("/main.css", serveStatic({ root: distDir, path: "/main.css" }));

  app.get("*", serveStatic({ root: distDir, path: "/index.html" }));

  const server = Bun.serve({
    fetch: app.fetch,
    port: 0,
  });

  return server.port;
}
