import { describe, test, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { mkdtemp, rm, mkdir, writeFile as fsWriteFile, readFile as fsReadFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  resolveAndValidate,
  listDirectory,
  readFile,
  writeFile,
  createFile,
  searchFiles,
  readRawFile,
  uploadFile,
} from "./file-service";

let rootDir: string;

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), "mdb-test-"));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("resolveAndValidate", () => {
  test("resolves a valid relative path", () => {
    const result = resolveAndValidate(rootDir, "subdir/file.md");
    expect(result).toBe(path.join(rootDir, "subdir/file.md"));
  });

  test("allows root dir itself", () => {
    const result = resolveAndValidate(rootDir, ".");
    expect(result).toBe(rootDir);
  });

  test("rejects path traversal with ../", () => {
    expect(() => resolveAndValidate(rootDir, "../etc/passwd")).toThrow(
      "Path traversal detected: access denied"
    );
  });

  test("rejects path traversal with absolute path", () => {
    expect(() => resolveAndValidate(rootDir, "/etc/passwd")).toThrow(
      "Path traversal detected: access denied"
    );
  });

  test("rejects path traversal with nested ../", () => {
    expect(() =>
      resolveAndValidate(rootDir, "subdir/../../etc/passwd")
    ).toThrow("Path traversal detected: access denied");
  });

  test("allows deeply nested valid path", () => {
    const result = resolveAndValidate(rootDir, "a/b/c/d.md");
    expect(result).toBe(path.join(rootDir, "a/b/c/d.md"));
  });
});

describe("listDirectory", () => {
  beforeEach(async () => {
    await mkdir(path.join(rootDir, "subdir"));
    await mkdir(path.join(rootDir, ".hidden-dir"));
    await fsWriteFile(path.join(rootDir, "readme.md"), "# Hello");
    await fsWriteFile(path.join(rootDir, "notes.markdown"), "Notes");
    await fsWriteFile(path.join(rootDir, "data.json"), "{}");
    await fsWriteFile(path.join(rootDir, ".hidden-file"), "secret");
  });

  test("lists directory contents excluding hidden by default", async () => {
    const listing = await listDirectory(rootDir, ".");
    expect(listing.path).toBe(".");
    const names = listing.entries.map((e) => e.name);
    expect(names).toContain("subdir");
    expect(names).toContain("readme.md");
    expect(names).toContain("notes.markdown");
    expect(names).toContain("data.json");
    expect(names).not.toContain(".hidden-dir");
    expect(names).not.toContain(".hidden-file");
  });

  test("includes hidden files when showHidden is true", async () => {
    const listing = await listDirectory(rootDir, ".", true);
    const names = listing.entries.map((e) => e.name);
    expect(names).toContain(".hidden-dir");
    expect(names).toContain(".hidden-file");
  });

  test("sorts directories before files", async () => {
    const listing = await listDirectory(rootDir, ".");
    const firstDir = listing.entries.findIndex((e) => e.isDirectory);
    const firstFile = listing.entries.findIndex((e) => !e.isDirectory);
    expect(firstDir).toBeLessThan(firstFile);
  });

  test("correctly identifies markdown files", async () => {
    const listing = await listDirectory(rootDir, ".");
    const readme = listing.entries.find((e) => e.name === "readme.md");
    const notes = listing.entries.find((e) => e.name === "notes.markdown");
    const data = listing.entries.find((e) => e.name === "data.json");
    expect(readme?.isMarkdown).toBe(true);
    expect(notes?.isMarkdown).toBe(true);
    expect(data?.isMarkdown).toBe(false);
  });

  test("includes correct metadata fields", async () => {
    const listing = await listDirectory(rootDir, ".");
    const readme = listing.entries.find((e) => e.name === "readme.md")!;
    expect(readme.path).toBe("readme.md");
    expect(readme.isDirectory).toBe(false);
    expect(readme.size).toBeGreaterThan(0);
    expect(readme.modifiedAt).toBeTruthy();
    expect(new Date(readme.modifiedAt).getTime()).not.toBeNaN();
  });

  test("lists subdirectory contents", async () => {
    await fsWriteFile(path.join(rootDir, "subdir", "child.md"), "child");
    const listing = await listDirectory(rootDir, "subdir");
    expect(listing.path).toBe("subdir");
    expect(listing.entries).toHaveLength(1);
    expect(listing.entries[0].name).toBe("child.md");
  });

  test("rejects path traversal", async () => {
    await expect(listDirectory(rootDir, "../")).rejects.toThrow(
      "Path traversal detected"
    );
  });

  test("sorts files alphabetically within same type", async () => {
    const listing = await listDirectory(rootDir, ".");
    const fileNames = listing.entries
      .filter((e) => !e.isDirectory)
      .map((e) => e.name);
    const sorted = [...fileNames].sort((a, b) => a.localeCompare(b));
    expect(fileNames).toEqual(sorted);
  });
});

describe("readFile", () => {
  test("reads file content", async () => {
    await fsWriteFile(path.join(rootDir, "test.md"), "# Test Content");
    const result = await readFile(rootDir, "test.md");
    expect(result.path).toBe("test.md");
    expect(result.content).toBe("# Test Content");
  });

  test("reads empty file", async () => {
    await fsWriteFile(path.join(rootDir, "empty.md"), "");
    const result = await readFile(rootDir, "empty.md");
    expect(result.content).toBe("");
  });

  test("reads file with unicode content", async () => {
    await fsWriteFile(path.join(rootDir, "unicode.md"), "Hello 🌍 世界");
    const result = await readFile(rootDir, "unicode.md");
    expect(result.content).toBe("Hello 🌍 世界");
  });

  test("throws on nonexistent file", async () => {
    await expect(readFile(rootDir, "nope.md")).rejects.toThrow();
  });

  test("rejects path traversal", async () => {
    await expect(readFile(rootDir, "../etc/passwd")).rejects.toThrow(
      "Path traversal detected"
    );
  });
});

describe("writeFile", () => {
  test("writes content to a file", async () => {
    await fsWriteFile(path.join(rootDir, "write-test.md"), "");
    await writeFile(rootDir, "write-test.md", "New content");
    const content = await fsReadFile(path.join(rootDir, "write-test.md"), "utf-8");
    expect(content).toBe("New content");
  });

  test("overwrites existing content", async () => {
    await fsWriteFile(path.join(rootDir, "overwrite.md"), "Old");
    await writeFile(rootDir, "overwrite.md", "New");
    const content = await fsReadFile(path.join(rootDir, "overwrite.md"), "utf-8");
    expect(content).toBe("New");
  });

  test("rejects path traversal", async () => {
    await expect(
      writeFile(rootDir, "../outside.md", "bad")
    ).rejects.toThrow("Path traversal detected");
  });
});

describe("createFile", () => {
  test("creates a markdown file with .md extension", async () => {
    const result = await createFile(rootDir, ".", "notes");
    expect(result).toBe("notes.md");
    const content = await fsReadFile(path.join(rootDir, "notes.md"), "utf-8");
    expect(content).toBe("");
  });

  test("preserves .md extension if already provided", async () => {
    const result = await createFile(rootDir, ".", "readme.md");
    expect(result).toBe("readme.md");
  });

  test("preserves .markdown extension", async () => {
    const result = await createFile(rootDir, ".", "readme.markdown");
    expect(result).toBe("readme.markdown");
  });

  test("creates file in subdirectory", async () => {
    await mkdir(path.join(rootDir, "docs"));
    const result = await createFile(rootDir, "docs", "guide");
    expect(result).toBe(path.join("docs", "guide.md"));
  });

  test("rejects path traversal in directory", async () => {
    await expect(createFile(rootDir, "..", "evil")).rejects.toThrow(
      "Path traversal detected"
    );
  });
});

describe("searchFiles", () => {
  beforeEach(async () => {
    await mkdir(path.join(rootDir, "docs"), { recursive: true });
    await mkdir(path.join(rootDir, "nested", "deep"), { recursive: true });
    await mkdir(path.join(rootDir, ".hidden"), { recursive: true });
    await mkdir(path.join(rootDir, "node_modules"), { recursive: true });
    await fsWriteFile(path.join(rootDir, "readme.md"), "# Readme");
    await fsWriteFile(path.join(rootDir, "docs", "guide.md"), "Guide");
    await fsWriteFile(path.join(rootDir, "docs", "api.md"), "API");
    await fsWriteFile(path.join(rootDir, "nested", "deep", "notes.md"), "Notes");
    await fsWriteFile(path.join(rootDir, ".hidden", "secret.md"), "Secret");
    await fsWriteFile(path.join(rootDir, "node_modules", "pkg.md"), "Pkg");
    await fsWriteFile(path.join(rootDir, "data.json"), "{}");
  });

  test("finds markdown files matching query", async () => {
    const results = await searchFiles(rootDir, "guide");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("guide.md");
  });

  test("searches case-insensitively", async () => {
    const results = await searchFiles(rootDir, "README");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("readme.md");
  });

  test("finds files in nested directories", async () => {
    const results = await searchFiles(rootDir, "notes");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("notes.md");
  });

  test("excludes hidden directories by default", async () => {
    const results = await searchFiles(rootDir, "secret");
    expect(results).toHaveLength(0);
  });

  test("includes hidden directories when showHidden is true", async () => {
    const results = await searchFiles(rootDir, "secret", 20, 10, true);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("secret.md");
  });

  test("excludes node_modules", async () => {
    const results = await searchFiles(rootDir, "pkg");
    expect(results).toHaveLength(0);
  });

  test("only returns markdown files", async () => {
    const results = await searchFiles(rootDir, "data");
    expect(results).toHaveLength(0);
  });

  test("respects maxResults limit", async () => {
    const results = await searchFiles(rootDir, "", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  test("respects maxDepth limit", async () => {
    const results = await searchFiles(rootDir, "notes", 20, 0);
    expect(results).toHaveLength(0);
  });

  test("returns results sorted by name match priority", async () => {
    const results = await searchFiles(rootDir, "md");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.isMarkdown).toBe(true);
    }
  });

  test("returns non-markdown files when allFileTypes is true", async () => {
    const results = await searchFiles(rootDir, "data", 50, 100, false, true);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("data.json");
    expect(results[0].isMarkdown).toBe(false);
  });

  test("returns both markdown and non-markdown files when allFileTypes is true", async () => {
    const results = await searchFiles(rootDir, "", 50, 100, false, true);
    const names = results.map((r) => r.name);
    expect(names).toContain("data.json");
    expect(names).toContain("readme.md");
  });

  test("works with higher maxDepth", async () => {
    await mkdir(path.join(rootDir, "a", "b", "c", "d"), { recursive: true });
    await fsWriteFile(path.join(rootDir, "a", "b", "c", "d", "buried.md"), "buried");
    const shallow = await searchFiles(rootDir, "buried", 50, 2);
    expect(shallow).toHaveLength(0);
    const deep = await searchFiles(rootDir, "buried", 50, 100);
    expect(deep).toHaveLength(1);
    expect(deep[0].name).toBe("buried.md");
  });
});

describe("readRawFile", () => {
  test("returns the resolved file path", async () => {
    await fsWriteFile(path.join(rootDir, "raw.md"), "content");
    const result = readRawFile(rootDir, "raw.md");
    expect(result).toBe(path.join(rootDir, "raw.md"));
  });

  test("rejects path traversal", () => {
    expect(() => readRawFile(rootDir, "../outside.md")).toThrow(
      "Path traversal detected"
    );
  });
});

describe("uploadFile", () => {
  test("uploads file to assets directory", async () => {
    const fileContent = new Uint8Array([72, 101, 108, 108, 111]);
    const file = new File([fileContent], "test-image.png", { type: "image/png" });
    const result = await uploadFile(rootDir, ".", file);
    expect(result).toBe("assets/test-image.png");
    const saved = await fsReadFile(path.join(rootDir, "assets", "test-image.png"));
    expect(Buffer.from(saved)).toEqual(Buffer.from(fileContent));
  });

  test("uploads to subdirectory assets", async () => {
    await mkdir(path.join(rootDir, "docs"), { recursive: true });
    const file = new File(["data"], "photo.jpg");
    const result = await uploadFile(rootDir, "docs", file);
    expect(result).toBe("docs/assets/photo.jpg");
  });

  test("sanitizes filenames", async () => {
    const file = new File(["data"], "my file (1).png");
    const result = await uploadFile(rootDir, ".", file);
    expect(result).toBe("assets/my_file__1_.png");
  });

  test("creates assets directory if it does not exist", async () => {
    const file = new File(["data"], "new.png");
    await uploadFile(rootDir, ".", file);
    const content = await fsReadFile(path.join(rootDir, "assets", "new.png"), "utf-8");
    expect(content).toBe("data");
  });
});
