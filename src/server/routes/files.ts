import { Hono } from "hono";
import path from "node:path";
import { readFile as fsReadFile, writeFile as fsWriteFile, access } from "node:fs/promises";
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
import type { ExternalOpenAction, ExternalOpener } from "../services/external-opener";

export interface FileRouteOptions {
  onFileChanged?: (relativePath: string) => void;
  externalOpener: ExternalOpener;
}

export function createFileRoutes(rootDir: string, options: FileRouteOptions): Hono {
  const app = new Hono();

  app.get("/search", async (c) => {
    try {
      const query = c.req.query("q") ?? "";
      if (!query.trim()) {
        return c.json([]);
      }
      const showHidden = c.req.query("showHidden") === "true";
      const types = c.req.query("types") ?? "markdown";
      const requestedDepth = Number.parseInt(c.req.query("maxDepth") ?? "100", 10);
      const maxDepth = Number.isFinite(requestedDepth) ? Math.max(0, Math.min(requestedDepth, 100)) : 100;
      const results = await searchFiles(rootDir, query.trim(), 50, maxDepth, showHidden, types === "all");
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
      options.onFileChanged?.(body.path);
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
      const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
      return new Response(webStream, {
        headers: {
          "Content-Type": contentTypeFor(filePath),
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:",
        },
      });
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

  app.get("/applications", async (c) => {
    if (c.req.query("type") !== "terminal") return c.json({ error: "Invalid application type" }, 400);
    return c.json(await discoverTerminalApplications());
  });

  app.put("/settings", async (c) => {
    try {
      const body = await c.req.json();
      await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(settingsPath), { recursive: true }));
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
      const body = await c.req.json<{ path: string; action: ExternalOpenAction; app?: string }>();
      if (!body.path || !body.action) {
        return c.json({ error: "Missing path or action" }, 400);
      }
      if (!["terminal", "finder", "editor"].includes(body.action)) {
        return c.json({ error: "Invalid action" }, 400);
      }
      const resolvedPath = resolveAndValidate(rootDir, body.path);
      await options.externalOpener({ path: resolvedPath, action: body.action, app: body.app });
      return c.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  return app;
}

const TERMINAL_APPLICATIONS = [
  ["Terminal", "/System/Applications/Utilities/Terminal.app"],
  ["iTerm", "/Applications/iTerm.app"],
  ["Warp", "/Applications/Warp.app"],
  ["Ghostty", "/Applications/Ghostty.app"],
  ["Alacritty", "/Applications/Alacritty.app"],
  ["kitty", "/Applications/kitty.app"],
  ["WezTerm", "/Applications/WezTerm.app"],
  ["Hyper", "/Applications/Hyper.app"],
] as const;

async function discoverTerminalApplications(): Promise<string[]> {
  if (process.platform !== "darwin") return [];
  const installed = await Promise.all(
    TERMINAL_APPLICATIONS.map(async ([name, appPath]) => access(appPath).then(() => name).catch(() => null)),
  );
  return installed.filter((name): name is NonNullable<typeof name> => name !== null);
}

function contentTypeFor(filePath: string): string {
  const types: Record<string, string> = {
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".css": "text/css; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".gif": "image/gif",
    ".htm": "text/html; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".m4a": "audio/mp4",
    ".md": "text/markdown; charset=utf-8",
    ".markdown": "text/markdown; charset=utf-8",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".oga": "audio/ogg",
    ".ogg": "audio/ogg",
    ".ogv": "video/ogg",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ts": "text/typescript; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".wav": "audio/wav",
    ".webm": "video/webm",
    ".webp": "image/webp",
    ".xml": "application/xml; charset=utf-8",
    ".yaml": "text/yaml; charset=utf-8",
    ".yml": "text/yaml; charset=utf-8",
  };
  return types[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
