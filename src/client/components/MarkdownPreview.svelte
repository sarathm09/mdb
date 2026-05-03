<script lang="ts">
  import { tick } from 'svelte';
  import { fetchFile } from '../services/api';
  import { content, originalContent, renderedHtml, isEditing } from '../stores/editor';
  import { currentPath } from '../stores/navigation';
  import { renderMarkdown, postProcessElement } from '../utils/markdown-renderer';
  import { parseFrontmatter } from '../utils/frontmatter';
  import { wsClient } from '../services/websocket';
  import type { FrontmatterData } from '../utils/frontmatter';

  interface CommentAnnotation {
    id: string;
    sourceLine: number;
    selectionText: string | null;
  }

  let {
    filePath,
    onAddComment = undefined,
    onMarkClick = undefined,
    commentPaneOpen = false,
    commentAnnotations = [],
    activeCommentLine = null,
    activeCommentId = null,
  }: {
    filePath: string;
    onAddComment?: ((sourceLine: number | null, selectionText: string) => void) | undefined;
    onMarkClick?: ((commentId: string) => void) | undefined;
    commentPaneOpen?: boolean;
    commentAnnotations?: CommentAnnotation[];
    activeCommentLine?: number | null;
    activeCommentId?: string | null;
  } = $props();

  interface SelectionPopover {
    sourceLine: number | null;
    selectionText: string;
    x: number; // cursor clientX
    y: number; // cursor clientY
  }

  let htmlContent = $state('');
  let loading = $state(true);
  let previewEl: HTMLDivElement | undefined = $state();
  let frontmatter: FrontmatterData | null = $state(null);
  let selectionPopover = $state<SelectionPopover | null>(null);

  $effect(() => {
    loadFile(filePath);
  });

  async function loadFile(path: string) {
    loading = true;
    try {
      const file = await fetchFile(path);
      $content = file.content;
      $originalContent = file.content;
      const { frontmatter: fm, body } = parseFrontmatter(file.content);
      frontmatter = fm;
      const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : $currentPath;
      htmlContent = await renderMarkdown(body, dirPath, true);
      $renderedHtml = htmlContent;
    } catch (err) {
      htmlContent = `<p style="color: var(--accent-red)">Error loading file: ${String(err)}</p>`;
    }
    loading = false;
  }

  $effect(() => {
    if (!loading && previewEl) {
      postProcessElement(previewEl);
    }
  });

  function highlightTextInElement(el: HTMLElement, text: string, commentId: string): boolean {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let n: Text | null;
    while ((n = walker.nextNode() as Text | null)) textNodes.push(n);

    const fullText = textNodes.map(t => t.textContent ?? '').join('');
    const idx = fullText.toLowerCase().indexOf(text.toLowerCase());
    if (idx === -1) return false;

    let offset = 0;
    let startNode: Text | null = null, startOff = 0;
    let endNode: Text | null = null, endOff = 0;

    for (const tn of textNodes) {
      const len = tn.textContent?.length ?? 0;
      if (!startNode && offset + len > idx) { startNode = tn; startOff = idx - offset; }
      if (startNode && offset + len >= idx + text.length) { endNode = tn; endOff = idx + text.length - offset; break; }
      offset += len;
    }
    if (!startNode || !endNode) return false;

    try {
      const range = document.createRange();
      range.setStart(startNode, startOff);
      range.setEnd(endNode, endOff);
      const mark = document.createElement('mark');
      mark.className = 'comment-highlight';
      mark.dataset.commentId = commentId;
      const contents = range.extractContents();
      mark.appendChild(contents);
      range.insertNode(mark);
      return true;
    } catch {
      return false;
    }
  }

  $effect(() => {
    if (loading || !previewEl) return;
    const annotations = commentAnnotations;

    for (const mark of previewEl.querySelectorAll('mark.comment-highlight')) {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      }
    }
    for (const el of previewEl.querySelectorAll('[data-source-line]')) {
      el.classList.remove('commented-line');
    }

    for (const ann of annotations) {
      const el = previewEl.querySelector(`[data-source-line="${ann.sourceLine}"]`) as HTMLElement | null;
      if (!el) continue;
      if (ann.selectionText) {
        if (!highlightTextInElement(el, ann.selectionText, ann.id)) {
          el.classList.add('commented-line');
        }
      } else {
        el.classList.add('commented-line');
      }
    }
  });

  $effect(() => {
    const cid = activeCommentId;
    const line = activeCommentLine;
    if ((cid === null && line === null) || !previewEl) return;

    let target: HTMLElement | null = null;
    if (cid) {
      target = previewEl.querySelector(`mark.comment-highlight[data-comment-id="${cid}"]`) as HTMLElement | null;
    }
    if (!target && line !== null) {
      target = previewEl.querySelector(`[data-source-line="${line}"]`) as HTMLElement | null;
    }
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('active-comment-line');
    const timer = setTimeout(() => target!.classList.remove('active-comment-line'), 1500);
    return () => clearTimeout(timer);
  });

  function handleMarkClick(e: MouseEvent) {
    const mark = (e.target as HTMLElement).closest('mark.comment-highlight');
    if (!mark) return;
    const commentId = (mark as HTMLElement).dataset.commentId;
    if (commentId) {
      e.stopPropagation();
      onMarkClick?.(commentId);
    }
  }

  let unsubFile: (() => void) | null = null;

  $effect(() => {
    unsubFile?.();
    unsubFile = null;
    if (filePath) {
      unsubFile = wsClient.onFileChanged(filePath, async () => {
        if ($isEditing) return;
        const container = previewEl?.parentElement;
        const scrollTop = container?.scrollTop ?? 0;
        await loadFile(filePath);
        await tick();
        if (container) container.scrollTop = scrollTop;
      });
    }
    return () => {
      unsubFile?.();
      unsubFile = null;
    };
  });

  $effect(() => {
    function onDocMousedown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest('.markdown-body') && !t.closest('.context-menu')) {
        selectionPopover = null;
      }
    }
    document.addEventListener('mousedown', onDocMousedown);
    return () => document.removeEventListener('mousedown', onDocMousedown);
  });

  function handleTextSelection(e: MouseEvent) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      selectionPopover = null;
      return;
    }
    const selText = sel.toString().trim();
    const range = sel.getRangeAt(0);
    const lineEl = range.startContainer.parentElement?.closest('[data-source-line]');
    const sourceLine = lineEl ? parseInt((lineEl as HTMLElement).dataset.sourceLine ?? '0') : null;

    if (commentPaneOpen) {
      onAddComment?.(sourceLine, selText);
      selectionPopover = null;
    } else {
      selectionPopover = { sourceLine, selectionText: selText, x: e.clientX, y: e.clientY };
    }
  }

  function handlePopoverAddComment() {
    if (!selectionPopover) return;
    onAddComment?.(selectionPopover.sourceLine, selectionPopover.selectionText);
    selectionPopover = null;
    window.getSelection()?.removeAllRanges();
  }
</script>

<div class="preview-container" role="presentation">
  {#if loading}
    <div class="loading-state">Loading...</div>
  {:else}
    <div class="markdown-body" bind:this={previewEl} onmouseup={handleTextSelection} onclick={handleMarkClick} role="document">
      {#if frontmatter && frontmatter.entries.length > 0}
        <div class="frontmatter-panel">
          <div class="frontmatter-header">Metadata</div>
          <table class="frontmatter-table">
            <tbody>
              {#each frontmatter.entries as [key, value]}
                <tr>
                  <td class="fm-key">{key}</td>
                  <td class="fm-value">{value}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      {@html htmlContent}
    </div>
  {/if}

  {#if selectionPopover && onAddComment}
    <div
      class="context-menu"
      style="left: {selectionPopover.x}px; top: {selectionPopover.y + 6}px;"
      role="menu"
    >
      <button
        class="context-menu-item"
        role="menuitem"
        onmousedown={(e) => { e.preventDefault(); handlePopoverAddComment(); }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Add Comment
      </button>
    </div>
  {/if}
</div>

<style>
  .preview-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-secondary);
    font-size: 16px;
  }

  .markdown-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
    color: var(--text-primary);
    line-height: 1.7;
    font-size: 15px;
  }

  .markdown-body :global(h1) {
    font-size: 2em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
    margin-top: 24px;
  }

  .markdown-body :global(h2) {
    font-size: 1.5em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 6px;
    margin-top: 20px;
  }

  .markdown-body :global(h3) {
    font-size: 1.25em;
    margin-top: 16px;
  }

  .markdown-body :global(a) {
    color: var(--accent-blue);
    text-decoration: none;
  }

  .markdown-body :global(a:hover) {
    text-decoration: underline;
  }

  .markdown-body :global([data-source-line].commented-line) {
    background: color-mix(in srgb, var(--accent-yellow, #e5c07b) 10%, transparent);
    border-left: 2px solid var(--accent-yellow, #e5c07b);
    padding-left: 10px;
    margin-left: -12px;
    border-radius: 0 3px 3px 0;
    transition: background 0.2s;
  }

  .markdown-body :global(mark.comment-highlight) {
    background: color-mix(in srgb, var(--accent-yellow, #e5c07b) 30%, transparent);
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
    outline: 1px solid color-mix(in srgb, var(--accent-yellow, #e5c07b) 60%, transparent);
    cursor: pointer;
    transition: background 0.15s, outline-color 0.15s;
  }

  .markdown-body :global(mark.comment-highlight:hover) {
    background: color-mix(in srgb, var(--accent-yellow, #e5c07b) 45%, transparent);
  }

  .markdown-body :global(mark.comment-highlight.active-comment-line) {
    background: color-mix(in srgb, var(--accent-blue) 30%, transparent);
    outline: 2px solid var(--accent-blue);
  }

  .markdown-body :global([data-source-line].active-comment-line) {
    background: color-mix(in srgb, var(--accent-blue) 15%, transparent);
    border-left: 2px solid var(--accent-blue);
    transition: background 0.2s;
  }

  .context-menu {
    position: fixed;
    z-index: 200;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    padding: 4px;
    min-width: 160px;
    pointer-events: all;
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: none;
    border: none;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.1s;
  }

  .context-menu-item:hover {
    background: color-mix(in srgb, var(--accent-blue) 15%, transparent);
    color: var(--accent-blue);
  }

  @media print {
    .preview-container {
      overflow: visible !important;
      height: auto !important;
      flex: none !important;
      display: block !important;
    }

    .markdown-body {
      overflow: visible !important;
      height: auto !important;
      flex: none !important;
    }

    .selection-popover {
      display: none;
    }
  }
</style>
