import path from "node:path";
import { readFile as fsReadFile, writeFile as fsWriteFile, readdir, stat, access, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import type { DirectoryListing, FileContent, FileEntry } from "../../shared/types";

export function resolveAndValidate(rootDir: string, relativePath: string): string {
  const resolved = path.resolve(rootDir, relativePath);
  if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
    throw new Error("Path traversal detected: access denied");
  }
  return resolved;
}

export async function listDirectory(
  rootDir: string,
  relativePath: string,
  showHidden: boolean = false,
): Promise<DirectoryListing> {
  const dirPath = resolveAndValidate(rootDir, relativePath);
  const allEntries = await readdir(dirPath);
  const entries = showHidden ? allEntries : allEntries.filter((name) => !name.startsWith("."));

  const items = await Promise.all(
    entries.map(async (name) => {
      const fullPath = path.join(dirPath, name);
      const relPath = path.relative(rootDir, fullPath);
      const info = await stat(fullPath);
      const ext = path.extname(name).toLowerCase();
      return {
        name,
        path: relPath,
        isDirectory: info.isDirectory(),
        isMarkdown: ext === ".md" || ext === ".markdown",
        size: info.size,
        modifiedAt: info.mtime.toISOString(),
      };
    }),
  );

  items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    path: relativePath,
    entries: items,
  };
}

export async function readFile(
  rootDir: string,
  relativePath: string,
): Promise<FileContent> {
  const filePath = resolveAndValidate(rootDir, relativePath);
  const content = await fsReadFile(filePath, "utf-8");
  return { path: relativePath, content };
}

export async function writeFile(
  rootDir: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const filePath = resolveAndValidate(rootDir, relativePath);
  await fsWriteFile(filePath, content);
}

export async function createFile(
  rootDir: string,
  directory: string,
  name: string,
): Promise<string> {
  const fileName = /\.(md|markdown)$/i.test(name) ? name : `${name}.md`;
  const relativePath = path.join(directory, fileName);
  const filePath = resolveAndValidate(rootDir, relativePath);
  await fsWriteFile(filePath, "");
  return relativePath;
}

export async function searchFiles(
  rootDir: string,
  query: string,
  maxResults: number = 20,
  maxDepth: number = 10,
  showHidden: boolean = false,
): Promise<FileEntry[]> {
  const results: FileEntry[] = [];
  const lowerQuery = query.toLowerCase();

  async function walk(dir: string, depth: number) {
    if (depth > maxDepth || results.length >= maxResults) return;
    let dirEntries;
    try {
      dirEntries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of dirEntries) {
      if (results.length >= maxResults) break;
      if ((!showHidden && name.startsWith(".")) || name === "node_modules") continue;
      const fullPath = path.join(dir, name);
      const info = await stat(fullPath).catch(() => null);
      if (!info) continue;
      if (info.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else {
        const ext = path.extname(name).toLowerCase();
        if (ext !== ".md" && ext !== ".markdown") continue;
        const relPath = path.relative(rootDir, fullPath);
        if (!relPath.toLowerCase().includes(lowerQuery)) continue;
        results.push({
          name,
          path: relPath,
          isDirectory: false,
          isMarkdown: true,
          size: info.size,
          modifiedAt: info.mtime.toISOString(),
        });
      }
    }
  }

  await walk(rootDir, 0);

  results.sort((a, b) => {
    const aExact = a.name.toLowerCase().includes(lowerQuery) ? 0 : 1;
    const bExact = b.name.toLowerCase().includes(lowerQuery) ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.path.length - b.path.length;
  });

  return results;
}

export function readRawFile(rootDir: string, relativePath: string): string {
  const filePath = resolveAndValidate(rootDir, relativePath);
  return filePath;
}

export async function uploadFile(rootDir: string, directory: string, file: File): Promise<string> {
  const assetsDir = directory === '.' ? 'assets' : `${directory}/assets`;
  const resolvedAssetsDir = resolveAndValidate(rootDir, assetsDir);
  await mkdir(resolvedAssetsDir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const relativePath = `${assetsDir}/${safeName}`;
  const filePath = resolveAndValidate(rootDir, relativePath);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fsWriteFile(filePath, buffer);
  return relativePath;
}
