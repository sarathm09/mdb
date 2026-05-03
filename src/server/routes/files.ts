import { Hono } from "hono";
import path from "node:path";
import { readFile as fsReadFile, writeFile as fsWriteFile, stat, access } from "node:fs/promises";
import { createReadStream } from "node:fs";
import {
  listDirectory,
  readFile,
  writeFile,
  createFile,
  readRawFile,
  searchFiles,
  resolveAndValidate,
  uploadFile,
} from "../services/file-service";

export function createFileRoutes(rootDir: string, onFileChanged?: (relativePath: string) => void): Hono {
  const app = new Hono();

  app.get("/search", async (c) => {
    try {
      const query = c.req.query("q") ?? "";
      if (!query.trim()) {
        return c.json([]);
      }
      const showHidden = c.req.query("showHidden") === "true";
      const results = await searchFiles(rootDir, query.trim(), 20, 10, showHidden);
      return c.json(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  });

  app.get("/files", async (c) => {
    try {
      const dirPath = c.req.query("path") ?? ".";
      const showHidden = c.req.query("showHidden") === "true";
      const listing = await listDirectory(rootDir, dirPath, showHidden);
      return c.json(listing);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  });

  app.get("/file", async (c) => {
    try {
      const filePath = c.req.query("path");
      if (!filePath) {
        return c.json({ error: "Missing path parameter" }, 400);
      }
      const content = await readFile(rootDir, filePath);
      return c.json(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  });

  app.put("/file", async (c) => {
    try {
      const body = await c.req.json<{ path: string; content: string }>();
      if (!body.path || body.content === undefined) {
        return c.json({ error: "Missing path or content in body" }, 400);
      }
      await writeFile(rootDir, body.path, body.content);
      onFileChanged?.(body.path);
      return c.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  app.post("/file", async (c) => {
    try {
      const body = await c.req.json<{ directory: string; name: string }>();
      if (!body.directory || !body.name) {
        return c.json({ error: "Missing directory or name in body" }, 400);
      }
      const newPath = await createFile(rootDir, body.directory, body.name);
      return c.json({ path: newPath });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  app.post("/upload", async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body["file"];
      const directory = (body["directory"] as string) || ".";
      if (!file || !(file instanceof File)) {
        return c.json({ error: "No file provided" }, 400);
      }
      const result = await uploadFile(rootDir, directory, file);
      return c.json({ path: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  app.get("/raw", async (c) => {
    try {
      const filePath = c.req.query("path");
      if (!filePath) {
        return c.json({ error: "Missing path parameter" }, 400);
      }
      const rawPath = readRawFile(rootDir, filePath);
      const stream = createReadStream(rawPath);
      const { Readable } = await import("node:stream");
      const webStream = Readable.toWeb(stream) as ReadableStream;
      return new Response(webStream);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  });

  const settingsPath = path.join(rootDir, ".mdb/settings.json");

  app.get("/settings", async (c) => {
    try {
      await access(settingsPath);
      const data = JSON.parse(await fsReadFile(settingsPath, "utf-8"));
      return c.json(data);
    } catch {
      return c.json({});
    }
  });

  app.put("/settings", async (c) => {
    try {
      const body = await c.req.json();
      await fsWriteFile(settingsPath, JSON.stringify(body, null, 2));
      return c.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  app.get("/proxy-image", async (c) => {
    try {
      const url = c.req.query("url");
      if (!url) {
        return c.json({ error: "Missing url parameter" }, 400);
      }
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return c.json({ error: "Invalid URL protocol" }, 400);
      }
      const resp = await fetch(url, { redirect: "follow" });
      if (!resp.ok) {
        return c.json({ error: `Fetch failed: ${resp.status}` }, 502);
      }
      const contentType = resp.headers.get("content-type") || "application/octet-stream";
      const buffer = await resp.arrayBuffer();
      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 502);
    }
  });

  app.post("/open-external", async (c) => {
    try {
      const body = await c.req.json<{ path: string; action: "terminal" | "finder" | "editor"; app?: string }>();
      if (!body.path || !body.action) {
        return c.json({ error: "Missing path or action" }, 400);
      }
      const resolvedPath = resolveAndValidate(rootDir, body.path);
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);

      switch (body.action) {
        case "terminal": {
          const fileStat = await stat(resolvedPath);
          const dir = fileStat.isDirectory() ? resolvedPath : path.dirname(resolvedPath);
          const terminalApp = body.app || "Terminal";
          await execFileAsync("open", ["-a", terminalApp, dir]);
          break;
        }
        case "finder": {
          await execFileAsync("open", ["-R", resolvedPath]);
          break;
        }
        case "editor": {
          const args = body.app ? ["-a", body.app, resolvedPath] : [resolvedPath];
          await execFileAsync("open", args);
          break;
        }
      }
      return c.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
