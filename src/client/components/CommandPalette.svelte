<script lang="ts">
  import { searchFiles, fetchDirectory, fetchFile } from '../services/api';
  import { currentPath, entries, selectedFile, showHiddenFiles } from '../stores/navigation';
  import { isEditing, renderedHtml } from '../stores/editor';
  import { exportAsMarkdown, exportAsHtml, printAsPdf, copyAsMarkdown, copyAsRichText } from '../utils/export';
  import type { FileEntry } from '../../shared/types';

  interface ActionItem {
    label: string;
    icon: string;
    action: () => void | Promise<void>;
  }

  let { isOpen, onClose }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  let query = $state('');
  let results: FileEntry[] = $state([]);
  let selectedIndex = $state(0);
  let loading = $state(false);
  let inputEl: HTMLInputElement | undefined = $state();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  let isMarkdownSelected = $derived(
    $selectedFile ? /\.(md|markdown)$/i.test($selectedFile) : false
  );

  let exportActions: ActionItem[] = $derived(
    isMarkdownSelected
      ? [
          { label: 'Export as Markdown', icon: '📄', action: async () => { const f = await fetchFile($selectedFile!); exportAsMarkdown($selectedFile!, f.content, false); } },
          { label: 'Export as HTML', icon: '🌐', action: () => exportAsHtml($selectedFile!, $renderedHtml) },
          { label: 'Export as PDF', icon: '🖨️', action: () => { const t = ($selectedFile!.split('/').pop() || 'document').replace(/\.(md|markdown)$/i, ''); printAsPdf($renderedHtml, t); } },
          { label: 'Copy as Markdown', icon: '📋', action: async () => { const f = await fetchFile($selectedFile!); copyAsMarkdown(f.content); } },
          { label: 'Copy as Rich Text', icon: '📝', action: () => { copyAsRichText($renderedHtml); } },
        ]
      : []
  );

  let filteredActions: ActionItem[] = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (q.startsWith('>')) {
      const actionQuery = q.slice(1).trim();
      return exportActions.filter(a => a.label.toLowerCase().includes(actionQuery));
    }
    if (!q) return exportActions;
    return [];
  });

  $effect(() => {
    if (isOpen) {
      query = '';
      results = [];
      selectedIndex = 0;
      loading = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  function handleInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    const q = query.trim();
    if (!q || q.startsWith('>')) {
      results = [];
      selectedIndex = 0;
      loading = false;
      return;
    }
    loading = true;
    debounceTimer = setTimeout(async () => {
      try {
        results = await searchFiles(q, $showHiddenFiles);
        selectedIndex = 0;
      } catch {
        results = [];
      }
      loading = false;
    }, 200);
  }

  async function selectResult(entry: FileEntry) {
    const dir = entry.path.includes('/') ? entry.path.substring(0, entry.path.lastIndexOf('/')) : '.';
    try {
      const listing = await fetchDirectory(dir, $showHiddenFiles);
      $currentPath = listing.path;
      $entries = listing.entries;
    } catch {}
    $selectedFile = entry.path;
    $isEditing = false;
    onClose();
  }

  let totalItems = $derived(filteredActions.length + results.length);

  function executeSelectedItem() {
    if (selectedIndex < filteredActions.length) {
      filteredActions[selectedIndex].action();
      onClose();
    } else {
      const fileIndex = selectedIndex - filteredActions.length;
      if (fileIndex >= 0 && fileIndex < results.length) {
        selectResult(results[fileIndex]);
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, totalItems - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter' && totalItems > 0) {
      e.preventDefault();
      executeSelectedItem();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('palette-backdrop')) {
      onClose();
    }
  }
</script>

{#if isOpen}
  <div class="palette-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown} role="dialog" aria-modal="true">
    <div class="palette-container">
      <input
        bind:this={inputEl}
        bind:value={query}
        oninput={handleInput}
        class="palette-input"
        type="text"
        placeholder="Search files or type > for actions..."
        autocomplete="off"
      />
      <div class="palette-results">
        {#if filteredActions.length > 0}
          {#each filteredActions as action, i}
            <button
              class="palette-result"
              class:selected={i === selectedIndex}
              onclick={() => { action.action(); onClose(); }}
              onmouseenter={() => selectedIndex = i}
            >
              <span class="result-icon">{action.icon}</span>
              <span class="result-path">{action.label}</span>
            </button>
          {/each}
          {#if results.length > 0}
            <div class="palette-divider"></div>
          {/if}
        {/if}
        {#if !query.trim() && filteredActions.length === 0}
          <div class="palette-empty">Type to search...</div>
        {:else if loading && results.length === 0 && filteredActions.length === 0}
          <div class="palette-empty">Searching...</div>
        {:else if results.length === 0 && !loading && filteredActions.length === 0}
          <div class="palette-empty">No results</div>
        {:else}
          {#each results as entry, i (entry.path)}
            <button
              class="palette-result"
              class:selected={(i + filteredActions.length) === selectedIndex}
              onclick={() => selectResult(entry)}
              onmouseenter={() => selectedIndex = i + filteredActions.length}
            >
              <span class="result-icon">📝</span>
              <span class="result-path">{entry.path}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    padding-top: 20vh;
    z-index: 200;
  }

  .palette-container {
    width: 500px;
    max-width: 90vw;
    max-height: 400px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    align-self: flex-start;
  }

  .palette-input {
    width: 100%;
    padding: 14px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
    font-size: 16px;
    outline: none;
    box-sizing: border-box;
  }

  .palette-input::placeholder {
    color: var(--text-secondary);
  }

  .palette-results {
    overflow-y: auto;
    flex: 1;
  }

  .palette-empty {
    padding: 24px 16px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 14px;
  }

  .palette-result {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .palette-result:hover,
  .palette-result.selected {
    background: var(--bg-tertiary);
  }

  .result-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .result-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .palette-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
</style>
