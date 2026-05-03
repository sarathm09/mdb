import { Hono } from 'hono';
import type { CommentsDB } from '../db/comments-db';
import type { WSManager } from '../ws-manager';
import { startAIReview, getJobStatus, applyAIResponse } from '../services/ai-service';
import type { AIReviewResponse } from '../../shared/types';

export function createAIRoutes(
  rootDir: string,
  claudeCliPathGetter: () => Promise<string>,
  db: CommentsDB,
  wsManager: WSManager,
): Hono {
  const app = new Hono();

  app.post('/ai/review', async (c) => {
    try {
      const body = await c.req.json<{ filePath: string }>();
      if (!body.filePath) return c.json({ error: 'Missing filePath' }, 400);
      const claudeCliPath = await claudeCliPathGetter();
      const jobId = await startAIReview(body.filePath, rootDir, claudeCliPath, db, wsManager);
      return c.json({ jobId });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
    }
  });

  app.get('/ai/status/:jobId', (c) => {
    const jobId = c.req.param('jobId');
    const job = getJobStatus(jobId);
    if (!job) return c.json({ error: 'Job not found' }, 404);
    return c.json({ status: job.status, error: job.error });
  });

  app.post('/ai/apply', async (c) => {
    try {
      const body = await c.req.json<{ filePath: string } & AIReviewResponse>();
      if (!body.filePath) return c.json({ error: 'Missing filePath' }, 400);
      await applyAIResponse(rootDir, body.filePath, body, db, wsManager);
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
    }
  });

  return app;
}
