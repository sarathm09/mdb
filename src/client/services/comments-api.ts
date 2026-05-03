import type { Comment, CreateCommentRequest, AIStatusResponse } from '../../shared/types';

export async function fetchComments(filePath: string): Promise<Comment[]> {
  const res = await fetch(`/api/comments?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
}

export async function createComment(data: CreateCommentRequest): Promise<Comment> {
  const res = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create comment');
  return res.json();
}

export async function updateComment(id: string, body: string): Promise<Comment> {
  const res = await fetch(`/api/comments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error('Failed to update comment');
  return res.json();
}

export async function deleteComment(id: string): Promise<void> {
  const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete comment');
}

export async function triggerAIReview(filePath: string): Promise<{ jobId: string }> {
  const res = await fetch('/api/ai/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
  if (!res.ok) throw new Error('Failed to trigger AI review');
  return res.json();
}

export async function pollAIStatus(jobId: string): Promise<AIStatusResponse> {
  const res = await fetch(`/api/ai/status/${jobId}`);
  if (!res.ok) throw new Error('Failed to poll AI status');
  return res.json();
}
