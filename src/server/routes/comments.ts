import { Hono } from 'hono';
import type { CommentsDB } from '../db/comments-db';
import { readFile } from '../services/file-service';
import type { CreateCommentRequest } from '../../shared/types';

export function createCommentRoutes(rootDir: string, db: CommentsDB): Hono {
  const app = new Hono();

  app.get('/comments', (c) => {
    try {
      const filePath = c.req.query('path');
      if (!filePath) return c.json({ error: 'Missing path parameter' }, 400);
      const flat = db.getByFile(filePath);
      return c.json(flat);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
    }
  });

  app.get('/comments/export', async (c) => {
    try {
      const filePath = c.req.query('path');
      if (!filePath) return c.json({ error: 'Missing path parameter' }, 400);
      const comments = db.getByFile(filePath);
      let fileContent: string | null = null;
      try {
        const f = await readFile(rootDir, filePath);
        fileContent = f.content;
      } catch {}
      return c.json({ filePath, fileContent, comments });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
    }
  });

  app.post('/comments', async (c) => {
    try {
      const body = await c.req.json<CreateCommentRequest>();
      if (!body.filePath || !body.body?.trim()) {
        return c.json({ error: 'Missing filePath or body' }, 400);
      }
      const comment = db.create(body);
      return c.json(comment, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
    }
  });

  app.put('/comments/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<{ body: string }>();
      if (!body.body?.trim()) return c.json({ error: 'Missing body' }, 400);
      const comment = db.update(id, body.body);
      if (!comment) return c.json({ error: 'Comment not found' }, 404);
      return c.json(comment);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
    }
  });

  app.delete('/comments/:id', (c) => {
    try {
      const id = c.req.param('id');
      const existing = db.getById(id);
      if (!existing) return c.json({ error: 'Comment not found' }, 404);
      db.delete(id);
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
    }
  });

  return app;
}
