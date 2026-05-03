import { spawn } from 'node:child_process';
import type { CommentsDB } from '../db/comments-db';
import type { WSManager } from '../ws-manager';
import type { AIReviewResponse } from '../../shared/types';
import { readFile, writeFile } from './file-service';

export interface AIJob {
  jobId: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

const jobs = new Map<string, AIJob>();

function buildPrompt(filePath: string, content: string, comments: ReturnType<CommentsDB['getByFile']>): string {
  return `You are reviewing a Markdown file. Below is the file path, content, and all open comments with their line references.

File path: ${filePath}

=== FILE CONTENT ===
${content}
=== END FILE CONTENT ===

=== COMMENTS ===
${JSON.stringify(comments, null, 2)}
=== END COMMENTS ===

Your task:
1. Address each comment by providing a reply
2. If you want to make changes to the file, provide the full updated content
3. If you have no file changes, set fileContent to null

Respond ONLY with a single JSON block delimited by triple backticks and the "json" tag.
Do not include any text outside the JSON block.

The JSON must conform exactly to this schema:
\`\`\`json
{
  "fileContent": "full updated markdown content or null",
  "commentReplies": [
    {
      "parentId": "the comment id you are replying to",
      "body": "your reply in markdown"
    }
  ]
}
\`\`\``;
}

function parseAIResponse(raw: string): AIReviewResponse {
  const match = raw.match(/```json\s*([\s\S]*?)```/);
  if (!match) throw new Error('No JSON block found in AI response');
  const parsed = JSON.parse(match[1].trim());
  if (typeof parsed.fileContent !== 'string' && parsed.fileContent !== null) {
    throw new Error('Invalid fileContent in AI response');
  }
  if (!Array.isArray(parsed.commentReplies)) {
    throw new Error('Invalid commentReplies in AI response');
  }
  return parsed as AIReviewResponse;
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `Process exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

export async function applyAIResponse(
  rootDir: string,
  filePath: string,
  response: AIReviewResponse,
  db: CommentsDB,
  wsManager: WSManager,
): Promise<void> {
  if (response.fileContent !== null) {
    await writeFile(rootDir, filePath, response.fileContent);
    wsManager.broadcast({ type: 'file-changed', filePath });
  }
  for (const reply of response.commentReplies) {
    db.create({
      filePath,
      parentId: reply.parentId,
      author: 'ai',
      body: reply.body,
    });
  }
  if (response.commentReplies.length > 0) {
    wsManager.broadcast({ type: 'comments-changed', filePath });
  }
}

export async function startAIReview(
  filePath: string,
  rootDir: string,
  claudeCliPath: string,
  db: CommentsDB,
  wsManager: WSManager,
): Promise<string> {
  const jobId = crypto.randomUUID();
  const job: AIJob = { jobId, status: 'pending' };
  jobs.set(jobId, job);

  (async () => {
    try {
      job.status = 'running';
      wsManager.broadcastToAll({ type: 'ai-status', jobId, status: 'running' });

      const fileData = await readFile(rootDir, filePath);
      const comments = db.getByFile(filePath);
      const prompt = buildPrompt(filePath, fileData.content, comments);

      const cliPath = claudeCliPath || 'claude';
      const result = await runCommand(cliPath, ['--print', prompt]);
      const response = parseAIResponse(result);
      await applyAIResponse(rootDir, filePath, response, db, wsManager);

      job.status = 'done';
      wsManager.broadcastToAll({ type: 'ai-status', jobId, status: 'done' });
    } catch (err) {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
      wsManager.broadcastToAll({ type: 'ai-status', jobId, status: 'error', error: job.error });
    }
  })();

  return jobId;
}

export function getJobStatus(jobId: string): AIJob | null {
  return jobs.get(jobId) ?? null;
}
