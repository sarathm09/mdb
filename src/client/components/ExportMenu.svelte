<script lang="ts">
  import { exportAsMarkdown, exportAsHtml, printAsPdf, copyAsMarkdown, copyAsRichText } from '../utils/export';
  import { fetchFile } from '../services/api';
  import { renderedHtml } from '../stores/editor';

  let { filePath, isOpen = $bindable(false) }: {
    filePath: string;
    isOpen: boolean;
  } = $props();

  let toast = $state('');
  let toastTimeout: ReturnType<typeof setTimeout> | undefined;
  let menuEl: HTMLDivElement | undefined = $state();

  function showToast(msg: string) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast = msg;
    toastTimeout = setTimeout(() => { toast = ''; }, 1500);
  }

  function close() {
    isOpen = false;
  }

  async function getRawContent(): Promise<string> {
    const file = await fetchFile(filePath);
    return file.content;
  }

  async function handleAction(action: string) {
    close();
    switch (action) {
      case 'md-no-sections': {
        const raw = await getRawContent();
        exportAsMarkdown(filePath, raw, false);
        break;
      }
      case 'md-with-sections': {
        const raw = await getRawContent();
        exportAsMarkdown(filePath, raw, true);
        break;
      }
      case 'html':
        exportAsHtml(filePath, $renderedHtml);
        break;
      case 'pdf': {
        const pdfTitle = (filePath.split('/').pop() || 'document').replace(/\.(md|markdown)$/i, '');
        printAsPdf($renderedHtml, pdfTitle);
        break;
      }
      case 'copy-md': {
        const raw = await getRawContent();
        const ok = await copyAsMarkdown(raw);
        showToast(ok ? 'Copied!' : 'Copy failed');
        break;
      }
      case 'copy-rich': {
        const ok = await copyAsRichText($renderedHtml);
        showToast(ok ? 'Copied!' : 'Copy failed');
        break;
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (menuEl && !menuEl.contains(e.target as Node)) {
      close();
    }
  }

  $effect(() => {
    if (isOpen) {
      const handler = (e: MouseEvent) => handleOutsideClick(e);
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  });
</script>

<div class="export-menu" bind:this={menuEl} onkeydown={handleKeydown}>
  <button class="topbar-btn" onclick={() => isOpen = !isOpen} title="Export (Cmd+Shift+E)">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>Export
  </button>

  {#if isOpen}
    <div class="export-dropdown">
      <button class="export-option" onclick={() => handleAction('md-no-sections')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>Export as Markdown</span>
      </button>
      <button class="export-option" onclick={() => handleAction('md-with-sections')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/></svg>
        <span>Export as Markdown (with sections)</span>
      </button>
      <button class="export-option" onclick={() => handleAction('html')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <span>Export as HTML</span>
      </button>
      <button class="export-option" onclick={() => handleAction('pdf')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        <span>Export as PDF (print)</span>
      </button>
      <div class="export-divider"></div>
      <button class="export-option" onclick={() => handleAction('copy-md')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>Copy as Markdown</span>
      </button>
      <button class="export-option" onclick={() => handleAction('copy-rich')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>Copy as Rich Text</span>
      </button>
    </div>
  {/if}
</div>

{#if toast}
  <div class="export-toast">{toast}</div>
{/if}

<style>
  .export-menu {
    position: relative;
  }

  .export-menu :global(.topbar-btn) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s ease;
  }

  .export-menu :global(.topbar-btn:hover) {
    background: var(--accent-blue);
    color: #fff;
    border-color: var(--accent-blue);
  }

  .export-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 260px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 150;
    padding: 4px 0;
  }

  .export-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 14px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    border-radius: 0;
    transition: background 0.1s;
  }

  .export-option:hover {
    background: var(--bg-tertiary);
  }

  .export-option svg {
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  .export-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }

  .export-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent-green);
    color: #1b1d23;
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    z-index: 300;
    pointer-events: none;
    animation: toast-in 0.2s ease;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>
