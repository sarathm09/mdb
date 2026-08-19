import Database from "better-sqlite3";
import path from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import type {
  Comment,
  CommentSidecar,
  CreateCommentRequest,
  UpdateCommentRequest,
} from "../../shared/types";
import { COMMENT_SIDECAR_SUFFIX } from "../../shared/types";
import { resolveAndValidate } from "./file-service";

const MAX_COMMENTS_PER_FILE = 10_000;
const MAX_COMMENT_LENGTH = 100_000;
const MAX_SELECTION_LENGTH = 100_000;

export class CommentsStore {
  private legacyDb: Database.Database | null = null;

  constructor(private rootDir: string) {
    mkdirSync(path.join(rootDir, ".mdb"), { recursive: true });
    const legacyPath = path.join(rootDir, ".mdb", "comments.db");
    if (existsSync(legacyPath)) {
      try {
        this.legacyDb = new Database(legacyPath, { readonly: true, fileMustExist: true });
      } catch {
        this.legacyDb = null;
      }
    }
  }

  static sidecarPathFor(rootDir: string, filePath: string): string {
    return `${resolveAndValidate(rootDir, filePath)}${COMMENT_SIDECAR_SUFFIX}`;
  }

  getByFile(filePath: string): Comment[] {
    const sidecarPath = CommentsStore.sidecarPathFor(this.rootDir, filePath);
    if (existsSync(sidecarPath)) return this.readSidecar(sidecarPath, filePath).comments;

    const migrated = this.readLegacyComments(filePath);
    if (migrated.length > 0) this.writeSidecar(filePath, migrated);
    return migrated;
  }

  getById(id: string, filePath?: string): Comment | null {
    const location = this.findComment(id, filePath);
    return location?.comment ?? null;
  }

  create(data: CreateCommentRequest & { author?: "user" | "ai" }): Comment {
    this.validateCreate(data);
    const comments = this.getByFile(data.filePath);
    if (comments.length >= MAX_COMMENTS_PER_FILE) {
      throw new Error(`Comment limit reached (${MAX_COMMENTS_PER_FILE})`);
    }
    if (data.parentId && !comments.some((comment) => comment.id === data.parentId)) {
      throw new Error("Parent comment not found");
    }

    const now = new Date().toISOString();
    const comment: Comment = {
      id: crypto.randomUUID(),
      filePath: data.filePath,
      parentId: data.parentId ?? null,
      author: data.author ?? "user",
      body: data.body.trim(),
      sourceLine: data.sourceLine ?? null,
      sourceEndLine: data.sourceEndLine ?? data.sourceLine ?? null,
      selectionText: data.selectionText ?? null,
      blocking: data.blocking ?? false,
      createdAt: now,
      updatedAt: now,
    };
    comments.push(comment);
    this.writeSidecar(data.filePath, comments);
    return comment;
  }

  update(id: string, data: UpdateCommentRequest): Comment | null {
    if (data.body !== undefined && (!data.body.trim() || data.body.length > MAX_COMMENT_LENGTH)) {
      throw new Error("Comment body must be between 1 and 100000 characters");
    }
    const location = this.findComment(id, data.filePath);
    if (!location) return null;

    if (data.body !== undefined) location.comment.body = data.body.trim();
    if (data.blocking !== undefined) location.comment.blocking = data.blocking;
    location.comment.updatedAt = new Date().toISOString();
    this.writeSidecar(location.filePath, location.comments);
    return location.comment;
  }

  delete(id: string, filePath?: string): boolean {
    const location = this.findComment(id, filePath);
    if (!location) return false;
    const idsToDelete = new Set([id]);
    let foundDescendant = true;
    while (foundDescendant) {
      foundDescendant = false;
      for (const comment of location.comments) {
        if (comment.parentId && idsToDelete.has(comment.parentId) && !idsToDelete.has(comment.id)) {
          idsToDelete.add(comment.id);
          foundDescendant = true;
        }
      }
    }
    const remaining = location.comments.filter((comment) => !idsToDelete.has(comment.id));
    this.writeSidecar(location.filePath, remaining);
    return true;
  }

  close(): void {
    this.legacyDb?.close();
    this.legacyDb = null;
  }

  private validateCreate(data: CreateCommentRequest): void {
    resolveAndValidate(this.rootDir, data.filePath);
    if (!data.body?.trim() || data.body.length > MAX_COMMENT_LENGTH) {
      throw new Error("Comment body must be between 1 and 100000 characters");
    }
    if (data.selectionText && data.selectionText.length > MAX_SELECTION_LENGTH) {
      throw new Error("Selected text exceeds 100000 characters");
    }
    for (const line of [data.sourceLine, data.sourceEndLine]) {
      if (line !== undefined && (!Number.isInteger(line) || line < 1)) {
        throw new Error("Comment line numbers must be positive integers");
      }
    }
    if (data.sourceLine && data.sourceEndLine && data.sourceEndLine < data.sourceLine) {
      throw new Error("Comment end line cannot precede start line");
    }
  }

  private readSidecar(sidecarPath: string, expectedFilePath: string): CommentSidecar {
    const parsed = JSON.parse(readFileSync(sidecarPath, "utf8")) as Partial<CommentSidecar>;
    if (parsed.version !== 1 || !Array.isArray(parsed.comments)) {
      throw new Error(`Invalid MDB comment sidecar: ${path.basename(sidecarPath)}`);
    }
    if (parsed.comments.length > MAX_COMMENTS_PER_FILE) {
      throw new Error(`Comment sidecar exceeds ${MAX_COMMENTS_PER_FILE} comments`);
    }
    return {
      version: 1,
      filePath: expectedFilePath,
      comments: parsed.comments.map((value) => this.normalizeComment(value, expectedFilePath)),
    };
  }

  private normalizeComment(value: unknown, filePath: string): Comment {
    if (!value || typeof value !== "object") throw new Error("Invalid comment entry");
    const comment = value as Partial<Comment>;
    if (
      typeof comment.id !== "string" ||
      typeof comment.body !== "string" ||
      comment.body.length > MAX_COMMENT_LENGTH ||
      (comment.author !== "user" && comment.author !== "ai")
    ) {
      throw new Error("Invalid comment entry");
    }
    return {
      id: comment.id,
      filePath,
      parentId: typeof comment.parentId === "string" ? comment.parentId : null,
      author: comment.author,
      body: comment.body,
      sourceLine: typeof comment.sourceLine === "number" ? comment.sourceLine : null,
      sourceEndLine: typeof comment.sourceEndLine === "number"
        ? comment.sourceEndLine
        : typeof comment.sourceLine === "number" ? comment.sourceLine : null,
      selectionText: typeof comment.selectionText === "string" ? comment.selectionText : null,
      blocking: comment.blocking === true,
      createdAt: typeof comment.createdAt === "string" ? comment.createdAt : new Date().toISOString(),
      updatedAt: typeof comment.updatedAt === "string" ? comment.updatedAt : new Date().toISOString(),
    };
  }

  private writeSidecar(filePath: string, comments: Comment[]): void {
    const sidecarPath = CommentsStore.sidecarPathFor(this.rootDir, filePath);
    if (comments.length === 0) {
      if (existsSync(sidecarPath)) unlinkSync(sidecarPath);
      return;
    }
    const sidecar: CommentSidecar = { version: 1, filePath, comments };
    const temporaryPath = `${sidecarPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(sidecar, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, sidecarPath);
  }

  private findComment(id: string, filePath?: string): {
    filePath: string;
    comments: Comment[];
    comment: Comment;
  } | null {
    if (filePath) {
      const comments = this.getByFile(filePath);
      const comment = comments.find((entry) => entry.id === id);
      return comment ? { filePath, comments, comment } : null;
    }

    for (const sidecarPath of this.findSidecars(this.rootDir)) {
      const relativeSidecar = path.relative(this.rootDir, sidecarPath);
      const candidateFilePath = relativeSidecar.slice(0, -COMMENT_SIDECAR_SUFFIX.length);
      const comments = this.readSidecar(sidecarPath, candidateFilePath).comments;
      const comment = comments.find((entry) => entry.id === id);
      if (comment) return { filePath: candidateFilePath, comments, comment };
    }
    return null;
  }

  private findSidecars(directory: string): string[] {
    const sidecars: string[] = [];
    for (const name of readdirSync(directory)) {
      if (name === "node_modules" || name === ".git") continue;
      const absolutePath = path.join(directory, name);
      let info;
      try {
        info = statSync(absolutePath);
      } catch {
        continue;
      }
      if (info.isDirectory()) sidecars.push(...this.findSidecars(absolutePath));
      else if (name.endsWith(COMMENT_SIDECAR_SUFFIX)) sidecars.push(absolutePath);
    }
    return sidecars;
  }

  private readLegacyComments(filePath: string): Comment[] {
    if (!this.legacyDb) return [];
    try {
      const rows = this.legacyDb
        .prepare("SELECT * FROM comments WHERE file_path = ? ORDER BY created_at ASC")
        .all(filePath) as Record<string, unknown>[];
      return rows.map((row) => ({
        id: row.id as string,
        filePath,
        parentId: (row.parent_id as string | null) ?? null,
        author: row.author === "ai" ? "ai" : "user",
        body: row.body as string,
        sourceLine: (row.source_line as number | null) ?? null,
        sourceEndLine: (row.source_line as number | null) ?? null,
        selectionText: (row.selection_text as string | null) ?? null,
        blocking: false,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }));
    } catch {
      return [];
    }
  }
}
