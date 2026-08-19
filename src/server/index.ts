import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { createFileRoutes } from './routes/files';
import { createCommentRoutes } from './routes/comments';
import { createAIRoutes } from './routes/ai';
import { CommentsStore } from './services/comments-store';
import { WSManager } from './ws-manager';
import { FileWatcher } from './services/watcher';
import { openExternalPath } from './services/external-opener';
import type { AIReviewConfig } from './services/ai-service';

export function startServer(
  rootDir: string,
  distDir: string,
  options: { openServer?: (server: ReturnType<typeof serve>) => void } = {},
): Promise<number> {
  const db = new CommentsStore(rootDir);
  const wsManager = new WSManager();
  const _fileWatcher = new FileWatcher();

  const settingsPath = path.join(rootDir, '.mdb', 'settings.json');
  async function getAIConfig(): Promise<AIReviewConfig> {
    try {
      const data = await readFile(settingsPath, 'utf-8');
      const s = JSON.parse(data);
      return {
        harness: ['claude', 'codex', 'opencode'].includes(s.aiHarness) ? s.aiHarness : 'claude',
        model: typeof s.aiModel === 'string' ? s.aiModel : undefined,
        agent: typeof s.aiAgent === 'string' ? s.aiAgent : undefined,
        executablePath: typeof s.aiExecutablePath === 'string' ? s.aiExecutablePath : s.claudeCliPath,
      };
    } catch {
      return { harness: 'claude' };
    }
  }

  const app = new Hono();

  app.route('/api', createFileRoutes(rootDir, {
    externalOpener: openExternalPath,
    onFileChanged: (relativePath) => {
      wsManager.broadcast({ type: 'file-changed', filePath: relativePath });
    },
  }));
  app.route('/api', createCommentRoutes(rootDir, db, (filePath) => {
    wsManager.broadcast({ type: 'comments-changed', filePath });
  }));
  app.route('/api', createAIRoutes(rootDir, getAIConfig, db, wsManager));

  app.use('/styles/*', serveStatic({ root: distDir }));
  app.use('/main.js', serveStatic({ root: distDir, path: '/main.js' }));
  app.use('/main.js.map', serveStatic({ root: distDir, path: '/main.js.map' }));
  app.use('/main.css', serveStatic({ root: distDir, path: '/main.css' }));
  app.get('*', serveStatic({ root: distDir, path: '/index.html' }));

  return new Promise((resolve) => {
    const httpServer = serve({ fetch: app.fetch, port: 0 }, (info) => {
      resolve(info.port);
    });
    options.openServer?.(httpServer);

    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (pathname === '/ws') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wsManager.add(ws);
        });
      } else {
        socket.destroy();
      }
    });
  });
}
