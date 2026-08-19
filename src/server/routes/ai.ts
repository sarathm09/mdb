import { Hono } from 'hono';
import type { CommentsStore } from '../services/comments-store';
import type { WSManager } from '../ws-manager';
import { startAIReview, getJobStatus, applyAIResponse } from '../services/ai-service';
import type { AIReviewConfig } from '../services/ai-service';
import type { AIHarness, AIReviewRequest, AIReviewResponse } from '../../shared/types';

export function createAIRoutes(
  rootDir: string,
  aiConfigGetter: () => Promise<AIReviewConfig>,
  db: CommentsStore,
  wsManager: WSManager,
): Hono {
  const app = new Hono();

  app.post('/ai/review', async (c) => {
    try {
      const body = await c.req.json<AIReviewRequest>();
      if (!body.filePath) return c.json({ error: 'Missing filePath' }, 400);
      const savedConfig = await aiConfigGetter();
      const harnesses: AIHarness[] = ['claude', 'codex', 'opencode'];
      if (body.harness && !harnesses.includes(body.harness)) return c.json({ error: 'Unsupported AI harness' }, 400);
      const config: AIReviewConfig = {
        harness: body.harness ?? savedConfig.harness,
        model: body.model ?? savedConfig.model,
        agent: body.agent ?? savedConfig.agent,
        executablePath: body.executablePath ?? savedConfig.executablePath,
      };
      const jobId = await startAIReview(body.filePath, rootDir, config, db, wsManager);
      return c.json({ jobId });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
    }
  });

  app.get('/ai/status/:jobId', (c) => {
    const jobId = c.req.param('jobId');
    const job = getJobStatus(jobId);
    if (!job) return c.json({ error: 'Job not found' }, 404);
    return c.json({ status: job.status, error: job.error, harness: job.harness, model: job.model, agent: job.agent });
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
