<script lang="ts">
  import { onDestroy } from 'svelte';
  import { comments, commentsLoading, loadComments, addComment, editComment, removeComment } from '../stores/comments';
  import { triggerAIReview } from '../services/comments-api';
  import { wsClient } from '../services/websocket';
  import type { Comment } from '../../../shared/types';

  let {
    filePath,
    pendingComment = null,
    onPendingCommentConsumed = undefined,
    onLineClick = undefined,
    activeThreadId = null,
  }: {
    filePath: string;
    pendingComment?: { sourceLine: number | null; selectionText: string } | null;
    onPendingCommentConsumed?: (() => void) | undefined;
    onLineClick?: ((commentId: string, sourceLine: number) => void) | undefined;
    activeThreadId?: string | null;
  } = $props();

  let newCommentBody = $state('');
  let replyingTo = $state<string | null>(null);
  let replyBody = $state('');
  let editingId = $state<string | null>(null);
  let editBody = $state('');
  let aiStatus = $state<'idle' | 'running' | 'done' | 'error'>('idle');
  let aiError = $state('');
  let submitting = $state(false);
  let threadsScrollEl: HTMLDivElement | undefined = $state();

  interface CommentThread extends Comment {
    replies: Comment[];
  }

  let threads = $derived((() => {
    const all = $comments;
    const topLevel = all.filter(c => !c.parentId);
    return topLevel
      .sort((a, b) => {
        if (a.sourceLine !== null && b.sourceLine !== null) return a.sourceLine - b.sourceLine;
        if (a.sourceLine !== null) return -1;
        if (b.sourceLine !== null) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
      .map(c => ({
        ...c,
        replies: all
          .filter(r => r.parentId === c.id)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      } as CommentThread));
  })());

  let pendingSourceLine = $state<number | null>(null);
  let pendingSelectionText = $state<string | null>(null);
  let newCommentTextarea: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    if (pendingComment) {
      pendingSourceLine = pendingComment.sourceLine;
      pendingSelectionText = pendingComment.selectionText;
      newCommentBody = '';
      onPendingCommentConsumed?.();
      setTimeout(() => newCommentTextarea?.focus({ preventScroll: true }), 50);
    }
  });

  let unsubComments: (() => void) | null = null;

  $effect(() => {
    if (filePath) {
      loadComments(filePath);
      unsubComments?.();
      unsubComments = wsClient.onCommentsChanged(filePath, () => loadComments(filePath));
    }
    return () => {
      unsubComments?.();
      unsubComments = null;
    };
  });

  onDestroy(() => {
    unsubComments?.();
  });

  $effect(() => {
    const tid = activeThreadId;
    if (!tid || !threadsScrollEl) return;
    const el = threadsScrollEl.querySelector(`[data-thread-id="${tid}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  async function handleAddComment() {
    if (!newCommentBody.trim() || submitting) return;
    submitting = true;
    try {
      await addComment({
        filePath,
        body: newCommentBody.trim(),
        sourceLine: pendingSourceLine ?? undefined,
        selectionText: pendingSelectionText ?? undefined,
      });
      newCommentBody = '';
      pendingSourceLine = null;
      pendingSelectionText = null;
    } catch {
      // ignore
    } finally {
      submitting = false;
    }
  }

  async function handleReply(parentId: string) {
    if (!replyBody.trim() || submitting) return;
    submitting = true;
    try {
      await addComment({ filePath, parentId, body: replyBody.trim() });
      replyBody = '';
      replyingTo = null;
    } catch {
      // ignore
    } finally {
      submitting = false;
    }
  }

  async function handleEdit(id: string) {
    if (!editBody.trim() || submitting) return;
    submitting = true;
    try {
      await editComment(id, editBody.trim());
      editingId = null;
      editBody = '';
    } catch {
      // ignore
    } finally {
      submitting = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this comment?')) return;
    await removeComment(id);
  }

  function startEdit(comment: Comment) {
    editingId = comment.id;
    editBody = comment.body;
    replyingTo = null;
  }

  function startReply(id: string) {
    replyingTo = id;
    replyBody = '';
    editingId = null;
  }

  async function handleSendToAI() {
    if (aiStatus === 'running') return;
    aiStatus = 'running';
    aiError = '';
    try {
      const { jobId } = await triggerAIReview(filePath);
      const unsub = wsClient.onAIStatus(jobId, (status, error) => {
        if (status === 'done') {
          aiStatus = 'done';
          loadComments(filePath);
          unsub();
        } else if (status === 'error') {
          aiStatus = 'error';
          aiError = error || 'Unknown error';
          unsub();
        }
      });
    } catch (err) {
      aiStatus = 'error';
      aiError = String(err);
    }
  }

  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return ''; }
  }

  function fullDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  }

  function authorLabel(author: string): string {
    return author === 'user' ? 'You' : author === 'ai' ? 'AI' : author;
  }
</script>

<div class="comment-pane">
  <div class="pane-header">
    <span class="pane-title">Comments</span>
    <button
      class="ai-btn"
      onclick={handleSendToAI}
      disabled={aiStatus === 'running'}
      title="Send to AI for review"
    >
      {#if aiStatus === 'running'}
        <span class="spinner"></span> Reviewing...
      {:else}
        AI Review
      {/if}
    </button>
  </div>

  {#if aiStatus === 'running'}
    <div class="ai-status ai-status--running">AI is reviewing the file...</div>
  {:else if aiStatus === 'done'}
    <div class="ai-status ai-status--done">
      AI review complete.
      <button class="status-dismiss" onclick={() => aiStatus = 'idle'}>Dismiss</button>
    </div>
  {:else if aiStatus === 'error'}
    <div class="ai-status ai-status--error">
      Error: {aiError}
      <button class="status-dismiss" onclick={() => aiStatus = 'idle'}>Dismiss</button>
    </div>
  {/if}

  <div class="threads-scroll" bind:this={threadsScrollEl}>
    {#if $commentsLoading}
      <div class="empty-state">Loading...</div>
    {:else if threads.length === 0}
      <div class="empty-state">No comments yet</div>
    {:else}
      {#each threads as thread (thread.id)}
        <div class="thread" class:thread--active={activeThreadId === thread.id} data-thread-id={thread.id}>
          {#if thread.sourceLine !== null || thread.selectionText}
            <button
              class="thread-anchor"
              onclick={() => thread.sourceLine !== null && onLineClick?.(thread.id, thread.sourceLine)}
              title={thread.sourceLine !== null ? `Jump to line ${thread.sourceLine}` : undefined}
              disabled={thread.sourceLine === null}
            >
              {#if thread.sourceLine !== null}
                <span class="line-badge">Line {thread.sourceLine}</span>
              {/if}
              {#if thread.selectionText}
                <blockquote class="selection-quote">{thread.selectionText}</blockquote>
              {/if}
            </button>
          {/if}

          <div class="comment comment--top">
            <div class="comment-meta">
              <span class="comment-author comment-author--{thread.author}">{authorLabel(thread.author)}</span>
              <time class="comment-time" datetime={thread.createdAt} title={fullDate(thread.createdAt)}>
                {formatTime(thread.createdAt)}
              </time>
            </div>
            {#if editingId === thread.id}
              <div class="inline-form">
                <textarea
                  class="comment-textarea"
                  bind:value={editBody}
                  rows={3}
                  onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEdit(thread.id); }}
                ></textarea>
                <div class="form-actions">
                  <button class="btn-secondary" onclick={() => { editingId = null; editBody = ''; }}>Cancel</button>
                  <button class="btn-primary" onclick={() => handleEdit(thread.id)} disabled={submitting}>Save</button>
                </div>
              </div>
            {:else}
              <div class="comment-body">{thread.body}</div>
              <div class="comment-actions">
                <button class="action-btn" onclick={() => startReply(thread.id)}>Reply</button>
                {#if thread.author !== 'ai'}
                  <button class="action-btn" onclick={() => startEdit(thread)}>Edit</button>
                  <button class="action-btn action-btn--danger" onclick={() => handleDelete(thread.id)}>Delete</button>
                {/if}
              </div>
            {/if}
          </div>

          {#if thread.replies.length > 0}
            <div class="replies">
              {#each thread.replies as reply (reply.id)}
                <div class="comment comment--reply">
                  <div class="comment-meta">
                    <span class="comment-author comment-author--{reply.author}">{authorLabel(reply.author)}</span>
                    <time class="comment-time" datetime={reply.createdAt} title={fullDate(reply.createdAt)}>
                      {formatTime(reply.createdAt)}
                    </time>
                  </div>
                  {#if editingId === reply.id}
                    <div class="inline-form">
                      <textarea
                        class="comment-textarea"
                        bind:value={editBody}
                        rows={3}
                        onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEdit(reply.id); }}
                      ></textarea>
                      <div class="form-actions">
                        <button class="btn-secondary" onclick={() => { editingId = null; editBody = ''; }}>Cancel</button>
                        <button class="btn-primary" onclick={() => handleEdit(reply.id)} disabled={submitting}>Save</button>
                      </div>
                    </div>
                  {:else}
                    <div class="comment-body">{reply.body}</div>
                    <div class="comment-actions">
                      {#if reply.author !== 'ai'}
                        <button class="action-btn" onclick={() => startEdit(reply)}>Edit</button>
                        <button class="action-btn action-btn--danger" onclick={() => handleDelete(reply.id)}>Delete</button>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if replyingTo === thread.id}
            <div class="inline-form inline-form--reply">
              <textarea
                class="comment-textarea"
                bind:value={replyBody}
                placeholder="Write a reply…"
                rows={3}
                onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(thread.id); }}
              ></textarea>
              <div class="form-actions">
                <button class="btn-secondary" onclick={() => { replyingTo = null; replyBody = ''; }}>Cancel</button>
                <button class="btn-primary" onclick={() => handleReply(thread.id)} disabled={submitting || !replyBody.trim()}>Reply</button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <div class="add-comment-form">
    {#if pendingSourceLine !== null || pendingSelectionText}
      <div class="pending-context">
        {#if pendingSourceLine !== null}<span class="pending-line-badge">Line {pendingSourceLine}</span>{/if}
        {#if pendingSelectionText}<blockquote class="selection-quote" style="border-left-color: var(--accent-blue); margin-top:4px;">{pendingSelectionText}</blockquote>{/if}
      </div>
    {/if}
    <textarea
      class="comment-textarea"
      bind:value={newCommentBody}
      bind:this={newCommentTextarea}
      placeholder={pendingSourceLine !== null ? `Comment on line ${pendingSourceLine}...` : 'Add a general comment...'}
      rows={3}
      onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
    ></textarea>
    <div class="form-actions">
      <span class="form-hint">Cmd+Enter to submit</span>
      <button class="btn-primary" onclick={handleAddComment} disabled={submitting || !newCommentBody.trim()}>
        Comment
      </button>
    </div>
  </div>
</div>

<style>
  .comment-pane {
    width: 320px;
    min-width: 280px;
    max-width: 380px;
    border-left: 1px solid var(--border);
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
    min-height: 0;
    height: 100%;
  }

  .pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .pane-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .ai-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--accent-blue);
    color: #fff;
    border: none;
    border-radius: 5px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .ai-btn:disabled {
    opacity: 0.65;
    cursor: default;
  }

  .ai-btn:hover:not(:disabled) {
    opacity: 0.88;
  }

  .spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .ai-status {
    padding: 8px 14px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .ai-status--running {
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    color: var(--accent-blue);
    border-bottom: 1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent);
  }

  .ai-status--done {
    background: color-mix(in srgb, var(--accent-green, #98c379) 12%, transparent);
    color: var(--accent-green, #98c379);
    border-bottom: 1px solid color-mix(in srgb, var(--accent-green, #98c379) 25%, transparent);
  }

  .ai-status--error {
    background: color-mix(in srgb, var(--accent-red, #e06c75) 12%, transparent);
    color: var(--accent-red, #e06c75);
    border-bottom: 1px solid color-mix(in srgb, var(--accent-red, #e06c75) 25%, transparent);
  }

  .status-dismiss {
    background: none;
    border: none;
    font-size: 11px;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 0;
    text-decoration: underline;
  }

  .threads-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .empty-state {
    padding: 24px 14px;
    color: var(--text-secondary);
    font-size: 13px;
    text-align: center;
  }

  .thread {
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
    margin-bottom: 4px;
    transition: background 0.2s;
  }

  .thread:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .thread--active {
    background: color-mix(in srgb, var(--accent-blue) 6%, transparent);
    border-radius: 6px;
    outline: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
  }

  /* Clickable line + quote anchor at the top of each thread */
  .thread-anchor {
    display: block;
    width: 100%;
    background: color-mix(in srgb, var(--accent-yellow, #e5c07b) 6%, transparent);
    border: none;
    border-bottom: 1px solid color-mix(in srgb, var(--accent-yellow, #e5c07b) 20%, transparent);
    padding: 8px 14px 6px;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .thread-anchor:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-yellow, #e5c07b) 14%, transparent);
  }

  .thread-anchor:disabled {
    cursor: default;
  }

  .line-badge {
    display: inline-block;
    background: color-mix(in srgb, var(--accent-yellow, #e5c07b) 25%, transparent);
    color: var(--accent-yellow, #e5c07b);
    border-radius: 4px;
    padding: 1px 7px;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 4px;
    letter-spacing: 0.02em;
  }

  .selection-quote {
    margin: 0;
    padding: 3px 8px;
    border-left: 2px solid color-mix(in srgb, var(--accent-yellow, #e5c07b) 50%, transparent);
    color: var(--text-secondary);
    font-size: 12px;
    font-style: italic;
    white-space: pre-wrap;
    word-break: break-word;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  .comment {
    padding: 10px 14px 6px;
  }

  .comment--reply {
    padding-left: 22px;
    background: color-mix(in srgb, var(--bg-primary) 40%, transparent);
    border-left: 2px solid var(--border);
    margin-left: 10px;
  }

  .comment-meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 3px;
  }

  .comment-author {
    font-size: 12px;
    font-weight: 600;
  }

  .comment-author--user { color: var(--accent-blue); }
  .comment-author--ai   { color: var(--accent-green, #98c379); }

  .comment-time {
    font-size: 11px;
    color: var(--text-secondary);
    cursor: default;
  }

  .comment-body {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .comment-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  .action-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.15s;
  }

  .action-btn:hover {
    color: var(--accent-blue);
  }

  .action-btn--danger:hover {
    color: var(--accent-red, #e06c75);
  }

  .replies {
    border-top: 1px solid var(--border);
    margin-top: 4px;
  }

  .inline-form {
    padding: 8px 14px;
  }

  .inline-form--reply {
    padding-left: 24px;
    margin-left: 14px;
    border-left: 2px solid var(--border);
  }

  .comment-textarea {
    width: 100%;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    padding: 8px 10px;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
    line-height: 1.5;
  }

  .comment-textarea:focus {
    outline: none;
    border-color: var(--accent-blue);
  }

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }

  .form-hint {
    font-size: 11px;
    color: var(--text-secondary);
    flex: 1;
  }

  .btn-primary {
    background: var(--accent-blue);
    color: #fff;
    border: none;
    border-radius: 5px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.88;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 5px 10px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-secondary:hover {
    background: var(--border);
  }

  .add-comment-form {
    border-top: 1px solid var(--border);
    padding: 10px 14px;
    flex-shrink: 0;
    background: var(--bg-secondary);
  }

  .pending-context {
    margin-bottom: 8px;
  }

  .pending-line-badge {
    display: inline-block;
    background: color-mix(in srgb, var(--accent-blue) 15%, transparent);
    color: var(--accent-blue);
    border-radius: 4px;
    padding: 1px 7px;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 4px;
  }
</style>
