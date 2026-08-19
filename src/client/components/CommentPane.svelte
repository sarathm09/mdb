<script lang="ts">
  import { onDestroy } from 'svelte';
  import { comments, commentsLoading, loadComments, addComment, editComment, setCommentBlocking, removeComment } from '../stores/comments';
  import { triggerAIReview } from '../services/comments-api';
  import { wsClient } from '../services/websocket';
  import type { AIHarness, Comment } from '../../../shared/types';

  let {
    filePath,
    pendingComment = null,
    onPendingCommentConsumed = undefined,
    onLineClick = undefined,
    activeThreadId = null,
    aiHarness = 'claude',
    aiModel = '',
    aiAgent = '',
    aiExecutablePath = '',
    paneWidth = $bindable(360),
  }: {
    filePath: string;
    pendingComment?: { sourceLine: number | null; sourceEndLine: number | null; selectionText: string } | null;
    onPendingCommentConsumed?: (() => void) | undefined;
    onLineClick?: ((commentId: string, sourceLine: number) => void) | undefined;
    activeThreadId?: string | null;
    aiHarness?: AIHarness;
    aiModel?: string;
    aiAgent?: string;
    aiExecutablePath?: string;
    paneWidth?: number;
  } = $props();

  interface CommentNode extends Comment {
    replies: CommentNode[];
  }

  let newCommentBody = $state('');
  let replyingTo = $state<string | null>(null);
  let replyBody = $state('');
  let editingId = $state<string | null>(null);
  let editBody = $state('');
  let aiStatus = $state<'idle' | 'running' | 'done' | 'error'>('idle');
  let aiError = $state('');
  let formError = $state('');
  let submitting = $state(false);
  let threadsScrollEl: HTMLDivElement | undefined = $state();
  let pendingSourceLine = $state<number | null>(null);
  let pendingSourceEndLine = $state<number | null>(null);
  let pendingSelectionText = $state<string | null>(null);
  let pendingBlocking = $state(false);
  let newCommentTextarea: HTMLTextAreaElement | undefined = $state();
  let commentPane: HTMLElement | undefined = $state();
  let resizing = $state(false);

  function startResize(event: PointerEvent) {
    event.preventDefault();
    resizing = true;
    const startX = event.clientX;
    const startWidth = commentPane?.getBoundingClientRect().width ?? paneWidth;
    const onMove = (moveEvent: PointerEvent) => {
      paneWidth = Math.max(300, Math.min(620, startWidth + startX - moveEvent.clientX));
    };
    const onUp = () => {
      resizing = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  let threads = $derived.by(() => {
    const nodes = new Map($comments.map(comment => [comment.id, { ...comment, replies: [] } as CommentNode]));
    const roots: CommentNode[] = [];
    for (const comment of $comments) {
      const node = nodes.get(comment.id)!;
      const parent = comment.parentId ? nodes.get(comment.parentId) : undefined;
      if (parent) parent.replies.push(node);
      else roots.push(node);
    }
    const sortReplies = (node: CommentNode) => {
      node.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      node.replies.forEach(sortReplies);
    };
    roots.forEach(sortReplies);
    return roots.sort((a, b) => {
      if (a.sourceLine !== null && b.sourceLine !== null) return a.sourceLine - b.sourceLine;
      if (a.sourceLine !== null) return -1;
      if (b.sourceLine !== null) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  });

  $effect(() => {
    if (!pendingComment) return;
    pendingSourceLine = pendingComment.sourceLine;
    pendingSourceEndLine = pendingComment.sourceEndLine;
    pendingSelectionText = pendingComment.selectionText;
    newCommentBody = '';
    onPendingCommentConsumed?.();
    setTimeout(() => newCommentTextarea?.focus({ preventScroll: true }), 50);
  });

  let unsubComments: (() => void) | null = null;
  $effect(() => {
    if (filePath) {
      loadComments(filePath);
      unsubComments?.();
      unsubComments = wsClient.onCommentsChanged(filePath, () => loadComments(filePath));
    }
    return () => { unsubComments?.(); unsubComments = null; };
  });
  onDestroy(() => unsubComments?.());

  $effect(() => {
    const tid = activeThreadId;
    if (!tid || !threadsScrollEl) return;
    threadsScrollEl.querySelector(`[data-thread-id="${tid}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  async function handleAddComment() {
    if (!newCommentBody.trim() || submitting) return;
    submitting = true;
    formError = '';
    try {
      await addComment({
        filePath,
        body: newCommentBody.trim(),
        sourceLine: pendingSourceLine ?? undefined,
        sourceEndLine: pendingSourceEndLine ?? undefined,
        selectionText: pendingSelectionText ?? undefined,
        blocking: pendingBlocking,
      });
      newCommentBody = '';
      pendingSourceLine = null;
      pendingSourceEndLine = null;
      pendingSelectionText = null;
      pendingBlocking = false;
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Failed to add comment';
    } finally {
      submitting = false;
    }
  }

  async function handleReply(parentId: string) {
    if (!replyBody.trim() || submitting) return;
    submitting = true;
    formError = '';
    try {
      await addComment({ filePath, parentId, body: replyBody.trim() });
      replyBody = '';
      replyingTo = null;
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Failed to add reply';
    } finally {
      submitting = false;
    }
  }

  async function handleEdit(id: string) {
    if (!editBody.trim() || submitting) return;
    submitting = true;
    formError = '';
    try {
      await editComment(id, editBody.trim());
      editingId = null;
      editBody = '';
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Failed to update comment';
    } finally {
      submitting = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this comment and all replies?')) return;
    try {
      await removeComment(id, filePath);
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Failed to delete comment';
    }
  }

  async function handleBlockingChange(id: string, blocking: boolean) {
    try {
      await setCommentBlocking(id, blocking);
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Failed to update blocking state';
    }
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
      const { jobId } = await triggerAIReview({
        filePath,
        harness: aiHarness,
        model: aiModel || undefined,
        agent: aiAgent || undefined,
        executablePath: aiExecutablePath || undefined,
      });
      const unsubscribe = wsClient.onAIStatus(jobId, (status, error) => {
        if (status === 'done') {
          aiStatus = 'done';
          loadComments(filePath);
          unsubscribe();
        } else if (status === 'error') {
          aiStatus = 'error';
          aiError = error || 'Unknown error';
          unsubscribe();
        }
      });
    } catch (error) {
      aiStatus = 'error';
      aiError = String(error);
    }
  }

  function formatTime(iso: string): string {
    const date = new Date(iso);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days}d` : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function fullDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  function harnessLabel(harness: AIHarness): string {
    return harness === 'claude' ? 'Claude Code' : harness === 'codex' ? 'Codex CLI' : 'OpenCode';
  }
</script>

{#snippet icon(name: 'ai' | 'reply' | 'edit' | 'delete' | 'send')}
  {#if name === 'ai'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.3 4.2L17.5 8.5l-4.2 1.3L12 14l-1.3-4.2-4.2-1.3 4.2-1.3L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/></svg>
  {:else if name === 'reply'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 17-5-5 5-5"/><path d="M4 12h10a6 6 0 0 1 6 6v1"/></svg>
  {:else if name === 'edit'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
  {:else if name === 'delete'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/></svg>
  {:else}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>{/if}
{/snippet}

{#snippet commentNode(comment: CommentNode, depth: number)}
  <article class="comment" class:comment--nested={depth > 0} style={`--depth: ${Math.min(depth, 4)}`} data-thread-id={comment.id}>
    <div class="comment-heading">
      <span class="avatar avatar--{comment.author}" title={comment.author === 'user' ? 'Added in MDB UI' : 'Added by AI/CLI'} aria-label={comment.author === 'user' ? 'User comment' : 'AI comment'}>
        {#if comment.author === 'user'}<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>{:else}{@render icon('ai')}{/if}
      </span>
      <div class="comment-identity">
        <strong>{comment.author === 'user' ? 'You' : 'AI agent'}</strong>
        <time datetime={comment.createdAt} title={fullDate(comment.createdAt)}>{formatTime(comment.createdAt)}</time>
      </div>
      {#if depth === 0}
        <button class="blocking-toggle blocking-toggle--heading" class:blocking-toggle--active={comment.blocking} onclick={() => handleBlockingChange(comment.id, !comment.blocking)} aria-pressed={comment.blocking} title={comment.blocking ? 'Remove blocking status' : 'Mark blocking'}>Blocking</button>
      {/if}
    </div>

    {#if editingId === comment.id}
      <div class="inline-form">
        <textarea class="comment-textarea" bind:value={editBody} rows={3} onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEdit(comment.id); }}></textarea>
        <div class="form-actions"><button class="btn-secondary" onclick={() => editingId = null}>Cancel</button><button class="btn-primary" onclick={() => handleEdit(comment.id)} disabled={submitting}>Save</button></div>
      </div>
    {:else}
      <div class="comment-body">{comment.body}</div>
      <div class="comment-actions">
        <button class="icon-action" onclick={() => startReply(comment.id)} title="Reply" aria-label="Reply">{@render icon('reply')}</button>
        {#if comment.author !== 'ai'}
          <button class="icon-action" onclick={() => startEdit(comment)} title="Edit" aria-label="Edit">{@render icon('edit')}</button>
          <button class="icon-action icon-action--danger" onclick={() => handleDelete(comment.id)} title="Delete" aria-label="Delete">{@render icon('delete')}</button>
        {/if}
      </div>
    {/if}

    {#if replyingTo === comment.id}
      <div class="inline-form reply-form">
        <textarea class="comment-textarea" bind:value={replyBody} placeholder={`Reply to ${comment.author === 'user' ? 'You' : 'AI agent'}...`} rows={3} onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(comment.id); }}></textarea>
        <div class="form-actions"><button class="btn-secondary" onclick={() => replyingTo = null}>Cancel</button><button class="btn-primary" onclick={() => handleReply(comment.id)} disabled={submitting || !replyBody.trim()}>Reply</button></div>
      </div>
    {/if}

    {#if comment.replies.length}
      <div class="replies">
        {#each comment.replies as reply (reply.id)}{@render commentNode(reply, depth + 1)}{/each}
      </div>
    {/if}
  </article>
{/snippet}

<aside class="comment-pane" class:comment-pane--resizing={resizing} bind:this={commentPane} style={`width: ${paneWidth}px`} aria-label="Comments">
  <div class="pane-resize-handle" onpointerdown={startResize} role="separator" aria-orientation="vertical" aria-label="Resize comments panel"></div>
  <header class="pane-header">
    <div><h2>Comments</h2><span>{$comments.length} total</span></div>
    <button class="ai-btn" onclick={handleSendToAI} disabled={aiStatus === 'running'} title={`Review with ${harnessLabel(aiHarness)}${aiModel ? ` using ${aiModel}` : ''}`}>
      {#if aiStatus === 'running'}<span class="spinner"></span>{:else}{@render icon('ai')}{/if}
      <span>{aiStatus === 'running' ? 'Reviewing' : 'AI Review'}</span>
    </button>
  </header>

  <div class="ai-config-summary">{harnessLabel(aiHarness)}<span>·</span>{aiModel || 'default model'}{#if aiAgent}<span>·</span>{aiAgent}{/if}</div>

  {#if aiStatus !== 'idle'}
    <div class="ai-status ai-status--{aiStatus}" role="status">
      <span>{aiStatus === 'running' ? 'Reviewing file and comment threads...' : aiStatus === 'done' ? 'Review complete' : aiError}</span>
      {#if aiStatus !== 'running'}<button onclick={() => aiStatus = 'idle'} aria-label="Dismiss AI review status">×</button>{/if}
    </div>
  {/if}

  <div class="threads-scroll" bind:this={threadsScrollEl}>
    {#if $commentsLoading}
      <div class="empty-state">Loading comments...</div>
    {:else if !threads.length}
      <div class="empty-state"><strong>No comments yet</strong><span>Select text, right-click, then choose Add Comment.</span></div>
    {:else}
      {#each threads as thread (thread.id)}
        <section class="thread" class:thread--active={activeThreadId === thread.id} class:thread--blocking={thread.blocking} data-thread-id={thread.id}>
          {#if thread.sourceLine !== null || thread.selectionText}
            <button class="thread-anchor" onclick={() => thread.sourceLine !== null && onLineClick?.(thread.id, thread.sourceLine)} disabled={thread.sourceLine === null}>
              {#if thread.sourceLine !== null}<span class="line-badge">{thread.sourceEndLine && thread.sourceEndLine !== thread.sourceLine ? `L${thread.sourceLine}-${thread.sourceEndLine}` : `L${thread.sourceLine}`}</span>{/if}
              {#if thread.selectionText}<span class="selection-quote">“{thread.selectionText}”</span>{/if}
            </button>
          {/if}
          {@render commentNode(thread, 0)}
        </section>
      {/each}
    {/if}
  </div>

  <div class="composer">
    {#if pendingSourceLine !== null || pendingSelectionText}
      <div class="pending-context">
        {#if pendingSourceLine !== null}<span class="line-badge">{pendingSourceEndLine && pendingSourceEndLine !== pendingSourceLine ? `L${pendingSourceLine}-${pendingSourceEndLine}` : `L${pendingSourceLine}`}</span>{/if}
        {#if pendingSelectionText}<span class="pending-text">“{pendingSelectionText}”</span>{/if}
      </div>
    {/if}
    <textarea class="comment-textarea" bind:value={newCommentBody} bind:this={newCommentTextarea} placeholder={pendingSourceLine !== null ? `Comment on line ${pendingSourceLine}...` : 'Add a general comment...'} rows={3} onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment(); }}></textarea>
    {#if formError}<div class="form-error" role="alert">{formError}</div>{/if}
    <div class="composer-footer">
      <button class="blocking-toggle" class:blocking-toggle--active={pendingBlocking} onclick={() => pendingBlocking = !pendingBlocking} aria-pressed={pendingBlocking}>Blocking</button>
      <button class="send-btn" onclick={handleAddComment} disabled={submitting || !newCommentBody.trim()} title="Add comment (Cmd+Enter)">{@render icon('send')}<span>Comment</span></button>
    </div>
  </div>
</aside>

<style>
  .comment-pane { position: relative; width: 360px; min-width: 300px; max-width: min(620px, 70vw); height: 100%; min-height: 0; display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; border: 0; border-radius: 0; background: transparent; }
  .comment-pane--resizing { user-select: none; }
  .pane-resize-handle { position: absolute; top: 0; bottom: 0; left: -3px; z-index: 3; width: 7px; cursor: col-resize; background: transparent; transition: background .15s; }
  .pane-resize-handle:hover, .pane-resize-handle:active { background: var(--accent-blue); }
  .pane-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px; }
  .pane-header h2 { margin: 0; color: var(--text-primary); font-size: 14px; line-height: 1.2; }
  .pane-header div > span { color: var(--text-secondary); font-size: 11px; }
  .ai-btn, .send-btn { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 10px; background: var(--control-raised); color: var(--accent-blue); font-size: 12px; font-weight: 600; box-shadow: var(--control-shadow); }
  .ai-btn svg, .send-btn svg, .icon-action svg, .avatar svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .ai-btn:disabled, .send-btn:disabled { opacity: .5; cursor: default; }
  .ai-config-summary { padding: 0 16px 11px; display: flex; gap: 5px; color: var(--text-secondary); font-size: 10px; border-bottom: 0; }
  .spinner { width: 12px; height: 12px; border: 2px solid color-mix(in srgb, var(--accent-blue) 30%, transparent); border-top-color: var(--accent-blue); border-radius: 50%; animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .ai-status { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 16px; border-bottom: 0; font-size: 11px; }
  .ai-status--running { color: var(--accent-blue); background: color-mix(in srgb, var(--accent-blue) 8%, transparent); }
  .ai-status--done { color: var(--accent-green); background: color-mix(in srgb, var(--accent-green) 8%, transparent); }
  .ai-status--error { color: var(--accent-red); background: color-mix(in srgb, var(--accent-red) 8%, transparent); }
  .ai-status button { padding: 0 3px; background: none; color: inherit; font-size: 17px; }
  .threads-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .empty-state { min-height: 160px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 6px; padding: 24px; color: var(--text-secondary); text-align: center; font-size: 12px; }
  .empty-state strong { color: var(--text-primary); font-size: 13px; }
  .thread { overflow: hidden; border: 0; border-radius: 14px; background: var(--surface-raised); box-shadow: var(--control-shadow); backdrop-filter: blur(12px); }
  .thread--blocking { border-left: 3px solid var(--accent-red); }
  .thread--active { outline: 2px solid color-mix(in srgb, var(--accent-blue) 55%, transparent); }
  .thread-anchor { width: 100%; display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-bottom: 0; border-radius: 0; background: color-mix(in srgb, var(--accent-yellow) 7%, transparent); color: var(--text-secondary); text-align: left; }
  .line-badge { flex-shrink: 0; padding: 2px 5px; border-radius: 4px; background: color-mix(in srgb, var(--accent-yellow) 18%, transparent); color: var(--accent-yellow); font: 600 10px/1.3 var(--font-family-mono); }
  .selection-quote { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 11px; font-style: italic; line-height: 1.4; }
  .comment { position: relative; padding: 11px 12px 10px; }
  .comment--nested { margin-left: calc(min(var(--depth), 4) * 10px); padding-left: 12px; border-left: 1px solid var(--border); }
  .comment-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
  .avatar { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 50%; }
  .avatar--user { background: color-mix(in srgb, var(--accent-blue) 15%, transparent); color: var(--accent-blue); }
  .avatar--ai { background: color-mix(in srgb, var(--accent-green) 15%, transparent); color: var(--accent-green); }
  .comment-identity { min-width: 0; display: flex; align-items: baseline; gap: 6px; }
  .comment-identity strong { color: var(--text-primary); font-size: 12px; }
  .comment-identity time { color: var(--text-secondary); font-size: 10px; }
  .blocking-badge { margin-left: auto; padding: 2px 6px; border-radius: 10px; background: color-mix(in srgb, var(--accent-red) 14%, transparent); color: var(--accent-red); font-size: 9px; font-weight: 700; text-transform: uppercase; }
  .comment-body { padding-left: 32px; color: var(--text-primary); font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .comment-actions { min-height: 24px; display: flex; justify-content: flex-end; gap: 2px; margin-top: 5px; opacity: .85; transition: opacity .15s; }
  .comment:hover > .comment-actions { opacity: 1; }
  .icon-action { width: 27px; height: 27px; display: inline-flex; align-items: center; justify-content: center; padding: 0; background: color-mix(in srgb, var(--control-raised) 76%, transparent); color: color-mix(in srgb, var(--text-primary) 88%, white); box-shadow: var(--control-shadow); }
  .icon-action:hover, .icon-action--active { background: var(--surface-raised-hover); color: var(--accent-blue); }
  .icon-action--danger:hover { color: var(--accent-red); }
  .blocking-toggle { padding: 3px 5px; border: 0; border-radius: 4px; background: transparent; color: color-mix(in srgb, var(--text-secondary) 58%, transparent); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; box-shadow: none; }
  .blocking-toggle--heading { margin-left: auto; }
  .blocking-toggle:hover { background: color-mix(in srgb, var(--accent-red) 8%, transparent); color: color-mix(in srgb, var(--accent-red) 72%, var(--text-secondary)); }
  .blocking-toggle--active { background: color-mix(in srgb, var(--accent-red) 12%, transparent); color: var(--accent-red); text-shadow: 0 0 12px color-mix(in srgb, var(--accent-red) 45%, transparent); }
  .replies { margin-top: 4px; }
  .inline-form { padding: 4px 0 0 32px; }
  .reply-form { margin-top: 6px; }
  .comment-textarea { width: 100%; resize: vertical; border: 0; border-radius: 11px; background: var(--control-raised); color: var(--text-primary); padding: 9px 10px; font: 13px/1.5 inherit; backdrop-filter: blur(10px); box-shadow: var(--input-shadow); }
  .form-actions, .composer-footer { display: flex; align-items: center; justify-content: flex-end; gap: 7px; margin-top: 7px; }
  .btn-primary, .btn-secondary { padding: 5px 10px; border-radius: 5px; font-size: 11px; }
  .btn-primary { background: var(--accent-blue); color: #fff; }
  .btn-secondary { border: 0; background: var(--control-raised); color: var(--text-primary); }
  .composer { flex-shrink: 0; padding: 12px 14px 14px; border-top: 0; background: transparent; box-shadow: none; }
  .pending-context { display: flex; align-items: flex-start; gap: 7px; margin-bottom: 8px; padding: 7px 8px; border-radius: 10px; background: var(--control-raised); }
  .pending-text { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--text-secondary); font-size: 11px; font-style: italic; }
  .composer-footer { justify-content: space-between; }
  .send-btn { background: var(--accent-blue); color: #fff; border-color: var(--accent-blue); }
  .form-error { margin-top: 6px; color: var(--accent-red); font-size: 11px; }
</style>
