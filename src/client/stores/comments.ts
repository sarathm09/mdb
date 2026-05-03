import { writable } from 'svelte/store';
import type { Comment, CreateCommentRequest } from '../../shared/types';
import { fetchComments, createComment, updateComment, deleteComment } from '../services/comments-api';

export const comments = writable<Comment[]>([]);
export const commentsLoading = writable(false);

export async function loadComments(filePath: string): Promise<void> {
  commentsLoading.set(true);
  try {
    const data = await fetchComments(filePath);
    comments.set(data);
  } catch {
    comments.set([]);
  } finally {
    commentsLoading.set(false);
  }
}

export async function addComment(data: CreateCommentRequest): Promise<Comment> {
  const comment = await createComment(data);
  comments.update(all => [...all, comment]);
  return comment;
}

export async function editComment(id: string, body: string): Promise<void> {
  const updated = await updateComment(id, body);
  comments.update(all => all.map(c => c.id === id ? updated : c));
}

export async function removeComment(id: string): Promise<void> {
  await deleteComment(id);
  comments.update(all => all.filter(c => c.id !== id && c.parentId !== id));
}
