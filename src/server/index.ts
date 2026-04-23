import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createFileRoutes } from "./routes/files";

export function startServer(rootDir: string, distDir: string): Promise<number> {
  const app = new Hono();

  app.route("/api", createFileRoutes(rootDir));

  app.use("/styles/*", serveStatic({ root: distDir }));
  app.use("/main.js", serveStatic({ root: distDir, path: "/main.js" }));
  app.use("/main.js.map", serveStatic({ root: distDir, path: "/main.js.map" }));
  app.use("/main.css", serveStatic({ root: distDir, path: "/main.css" }))

  app.get("*", serveStatic({ root: distDir, path: "/index.html" }));

  return new Promise((resolve) => {
    const server = serve({
      fetch: app.fetch,
      port: 0,
    }, (info) => {
      resolve(info.port);
    });
  });
}
