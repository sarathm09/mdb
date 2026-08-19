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
  const updated = await updateComment(id, { body });
  comments.update(all => all.map(c => c.id === id ? updated : c));
}

export async function setCommentBlocking(id: string, blocking: boolean): Promise<void> {
  const updated = await updateComment(id, { blocking });
  comments.update(all => all.map(c => c.id === id ? updated : c));
}

export async function removeComment(id: string, filePath: string): Promise<void> {
  await deleteComment(id, filePath);
  comments.update(all => {
    const idsToDelete = new Set([id]);
    let foundDescendant = true;
    while (foundDescendant) {
      foundDescendant = false;
      for (const comment of all) {
        if (comment.parentId && idsToDelete.has(comment.parentId) && !idsToDelete.has(comment.id)) {
          idsToDelete.add(comment.id);
          foundDescendant = true;
        }
      }
    }
    return all.filter(comment => !idsToDelete.has(comment.id));
  });
}
