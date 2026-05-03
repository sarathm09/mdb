import Database from 'better-sqlite3';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Comment, CreateCommentRequest } from '../../shared/types';

export class CommentsDB {
  private db: Database.Database;

  constructor(rootDir: string) {
    const dir = path.join(rootDir, '.mdb');
    try { mkdirSync(dir, { recursive: true }); } catch {}
    const dbPath = path.join(dir, 'comments.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
        author TEXT NOT NULL DEFAULT 'user',
        body TEXT NOT NULL,
        source_line INTEGER,
        selection_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comments_file ON comments(file_path);
      CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
    `);
  }

  private rowToComment(row: Record<string, unknown>): Comment {
    return {
      id: row.id as string,
      filePath: row.file_path as string,
      parentId: (row.parent_id as string | null) ?? null,
      author: row.author as 'user' | 'ai',
      body: row.body as string,
      sourceLine: (row.source_line as number | null) ?? null,
      selectionText: (row.selection_text as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  getByFile(filePath: string): Comment[] {
    const rows = this.db
      .prepare('SELECT * FROM comments WHERE file_path = ? ORDER BY created_at ASC')
      .all(filePath) as Record<string, unknown>[];
    return rows.map(row => this.rowToComment(row));
  }

  getById(id: string): Comment | null {
    const row = this.db
      .prepare('SELECT * FROM comments WHERE id = ?')
      .get(id) as Record<string, unknown> | null;
    return row ? this.rowToComment(row) : null;
  }

  create(data: CreateCommentRequest & { author?: 'user' | 'ai' }): Comment {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO comments (id, file_path, parent_id, author, body, source_line, selection_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      data.filePath,
      data.parentId ?? null,
      data.author ?? 'user',
      data.body,
      data.sourceLine ?? null,
      data.selectionText ?? null,
      now,
      now,
    );
    return this.getById(id)!;
  }

  update(id: string, body: string): Comment | null {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE comments SET body = ?, updated_at = ? WHERE id = ?').run(body, now, id);
    return this.getById(id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  }

  close(): void {
    this.db.close();
  }
}
