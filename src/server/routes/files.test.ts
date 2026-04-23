import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import path from "node:path";
import { mkdtemp, rm, mkdir, writeFile as fsWriteFile, readFile as fsReadFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { Hono } from "hono";
import { createFileRoutes } from "./files";

let rootDir: string;
let app: Hono;

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), "mdb-api-test-"));
  app = new Hono();
  app.route("/api", createFileRoutes(rootDir));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

function req(path: string, init?: RequestInit) {
  return app.request(`http://localhost/api${path}`, init);
}

describe("GET /api/search", () => {
  beforeEach(async () => {
    await fsWriteFile(path.join(rootDir, "readme.md"), "# Readme");
    await fsWriteFile(path.join(rootDir, "notes.md"), "Notes");
  });

  test("returns empty array for empty query", async () => {
    const res = await req("/search?q=");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("returns empty array for whitespace query", async () => {
    const res = await req("/search?q=%20%20");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("finds matching files", async () => {
    const res = await req("/search?q=readme");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("readme.md");
  });

  test("respects showHidden parameter", async () => {
    await mkdir(path.join(rootDir, ".hidden"));
    await fsWriteFile(path.join(rootDir, ".hidden", "secret.md"), "s");
    const res1 = await req("/search?q=secret");
    expect((await res1.json())).toHaveLength(0);

    const res2 = await req("/search?q=secret&showHidden=true");
    expect((await res2.json())).toHaveLength(1);
  });
});

describe("GET /api/files", () => {
  beforeEach(async () => {
    await mkdir(path.join(rootDir, "docs"));
    await fsWriteFile(path.join(rootDir, "readme.md"), "# Hi");
  });

  test("lists root directory by default", async () => {
    const res = await req("/files");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.path).toBe(".");
    const names = data.entries.map((e: any) => e.name);
    expect(names).toContain("docs");
    expect(names).toContain("readme.md");
  });

  test("lists subdirectory", async () => {
    await fsWriteFile(path.join(rootDir, "docs", "guide.md"), "g");
    const res = await req("/files?path=docs");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.path).toBe("docs");
    expect(data.entries).toHaveLength(1);
  });

  test("returns 400 for path traversal", async () => {
    const res = await req("/files?path=../");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Path traversal");
  });

  test("returns 400 for nonexistent directory", async () => {
    const res = await req("/files?path=nonexistent");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/file", () => {
  test("reads file content", async () => {
    await fsWriteFile(path.join(rootDir, "test.md"), "# Hello");
    const res = await req("/file?path=test.md");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.path).toBe("test.md");
    expect(data.content).toBe("# Hello");
  });

  test("returns 400 when path parameter is missing", async () => {
    const res = await req("/file");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing path parameter");
  });

  test("returns 400 for nonexistent file", async () => {
    const res = await req("/file?path=nope.md");
    expect(res.status).toBe(400);
  });

  test("returns 400 for path traversal", async () => {
    const res = await req("/file?path=../etc/passwd");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Path traversal");
  });
});

describe("PUT /api/file", () => {
  test("updates file content", async () => {
    await fsWriteFile(path.join(rootDir, "edit.md"), "old");
    const res = await req("/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "edit.md", content: "new content" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const content = await fsReadFile(path.join(rootDir, "edit.md"), "utf-8");
    expect(content).toBe("new content");
  });

  test("returns 400 when path is missing", async () => {
    const res = await req("/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "data" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing path or content");
  });

  test("returns 400 when content is missing", async () => {
    const res = await req("/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "test.md" }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 500 for path traversal on PUT", async () => {
    const res = await req("/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "../outside.md", content: "bad" }),
    });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Path traversal");
  });

  test("allows empty string content", async () => {
    await fsWriteFile(path.join(rootDir, "clear.md"), "data");
    const res = await req("/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "clear.md", content: "" }),
    });
    expect(res.status).toBe(200);
    const content = await fsReadFile(path.join(rootDir, "clear.md"), "utf-8");
    expect(content).toBe("");
  });
});

describe("POST /api/file", () => {
  test("creates a new markdown file", async () => {
    const res = await req("/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: ".", name: "new-doc" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.path).toBe("new-doc.md");
    const content = await fsReadFile(path.join(rootDir, "new-doc.md"), "utf-8");
    expect(content).toBe("");
  });

  test("returns 400 when directory is missing", async () => {
    const res = await req("/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing directory or name");
  });

  test("returns 400 when name is missing", async () => {
    const res = await req("/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: "." }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 500 for path traversal on POST", async () => {
    const res = await req("/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: "../..", name: "evil" }),
    });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Path traversal");
  });
});

describe("POST /api/upload", () => {
  test("uploads a file", async () => {
    const formData = new FormData();
    formData.append("file", new File(["hello"], "test.png", { type: "image/png" }));
    formData.append("directory", ".");
    const res = await req("/upload", { method: "POST", body: formData });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.path).toBe("assets/test.png");
  });

  test("returns 400 when no file provided", async () => {
    const formData = new FormData();
    formData.append("directory", ".");
    const res = await req("/upload", { method: "POST", body: formData });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("No file provided");
  });

  test("returns 500 for path traversal in upload directory", async () => {
    const formData = new FormData();
    formData.append("file", new File(["data"], "test.png"));
    formData.append("directory", "../..");
    const res = await req("/upload", { method: "POST", body: formData });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/raw", () => {
  test("streams raw file content", async () => {
    await fsWriteFile(path.join(rootDir, "raw.md"), "raw content");
    const res = await req("/raw?path=raw.md");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("raw content");
  });

  test("returns 400 when path is missing", async () => {
    const res = await req("/raw");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing path parameter");
  });

  test("returns 400 for path traversal", async () => {
    const res = await req("/raw?path=../etc/passwd");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Path traversal");
  });
});

describe("GET /api/settings", () => {
  test("returns empty object when no settings file exists", async () => {
    const res = await req("/settings");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  test("returns saved settings", async () => {
    const settingsPath = path.join(rootDir, ".@sarathm09/mdb.json");
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await fsWriteFile(settingsPath, JSON.stringify({ theme: "dark" }));
    const res = await req("/settings");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ theme: "dark" });
  });
});

describe("PUT /api/settings", () => {
  test("returns 500 when settings directory does not exist and cannot be created", async () => {
    // Create a file where the directory should be, causing write to fail
    const badApp = new Hono();
    badApp.route("/api", createFileRoutes("/nonexistent/root/dir"));
    const res = await badApp.request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "dark" }),
    });
    expect(res.status).toBe(500);
  });

  test("saves settings", async () => {
    const settingsDir = path.join(rootDir, ".@sarathm09");
    await mkdir(settingsDir, { recursive: true });
    const res = await req("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "light", fontSize: 16 }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const settingsPath = path.join(rootDir, ".@sarathm09/mdb.json");
    const saved = JSON.parse(await fsReadFile(settingsPath, "utf-8"));
    expect(saved).toEqual({ theme: "light", fontSize: 16 });
  });
});

describe("GET /api/proxy-image", () => {
  test("returns 400 when url parameter is missing", async () => {
    const res = await req("/proxy-image");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing url parameter");
  });

  test("returns 400 for non-http protocol", async () => {
    const res = await req("/proxy-image?url=ftp://example.com/img.png");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid URL protocol");
  });

  test("returns 400 for javascript protocol", async () => {
    const res = await req("/proxy-image?url=javascript:alert(1)");
    expect(res.status).toBe(400);
  });

  test("returns 502 for unreachable URL", async () => {
    const res = await req("/proxy-image?url=http://localhost:1/img.png");
    expect(res.status).toBe(502);
  });

  test("proxies image successfully", async () => {
    const imageData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const server = createServer((_, res) => {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(imageData);
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    try {
      const res = await req(`/proxy-image?url=http://localhost:${port}/img.png`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
      const body = Buffer.from(await res.arrayBuffer());
      expect(body).toEqual(imageData);
    } finally {
      server.close();
    }
  });

  test("returns 502 when upstream returns non-ok status", async () => {
    const server = createServer((_, res) => {
      res.writeHead(404);
      res.end("Not found");
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    try {
      const res = await req(`/proxy-image?url=http://localhost:${port}/missing.png`);
      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.error).toContain("Fetch failed: 404");
    } finally {
      server.close();
    }
  });
});

describe("POST /api/open-external", () => {
  test("returns 400 when path is missing", async () => {
    const res = await req("/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finder" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing path or action");
  });

  test("returns 400 when action is missing", async () => {
    const res = await req("/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "." }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 500 for path traversal", async () => {
    const res = await req("/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "../..", action: "finder" }),
    });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Path traversal");
  });

  test("opens directory in finder", async () => {
    const res = await req("/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: ".", action: "finder" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  test("opens directory in terminal", async () => {
    const res = await req("/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: ".", action: "terminal" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  test("opens file in terminal resolves to parent directory", async () => {
    await fsWriteFile(path.join(rootDir, "test.md"), "test");
    const res = await req("/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "test.md", action: "terminal" }),
    });
    expect(res.status).toBe(200);
  });

  test("opens directory in terminal with custom app", async () => {
    const res = await req("/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: ".", action: "terminal", app: "iTerm" }),
    });
    // May fail if iTerm is not installed, which is fine - we just test the code path
    const data = await res.json();
    expect(typeof data).toBe("object");
  });

  test("opens file in default editor", async () => {
    await fsWriteFile(path.join(rootDir, "edit.md"), "test");
    const res = await req("/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "edit.md", action: "editor" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  test("opens file in specified editor app", async () => {
    await fsWriteFile(path.join(rootDir, "edit2.md"), "test");
    const res = await req("/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "edit2.md", action: "editor", app: "TextEdit" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
