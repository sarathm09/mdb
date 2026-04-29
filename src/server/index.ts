import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createFileRoutes } from "./routes/files";

export function startServer(rootDir: string, distDir: string): Promise<number> {
  const app = new Hono();

  app.route("/api", createFileRoutes(rootDir));

  app.use("/assets/*", serveStatic({ root: distDir }));
  app.use("*", serveStatic({ root: distDir }));
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
