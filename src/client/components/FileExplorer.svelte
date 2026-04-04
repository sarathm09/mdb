<script lang="ts">
  import { onMount } from 'svelte';
  import { currentPath, entries, selectedFile, showHiddenFiles } from '../stores/navigation';
  import { isEditing } from '../stores/editor';
  import { fetchDirectory } from '../services/api';
  import type { FileEntry } from '../../shared/types';
  import NewFileModal from './NewFileModal.svelte';
  import { isInputFocused } from '../utils/keyboard';

  let showNewFileModal = $state(false);
  let viewMode: 'list' | 'grid' = $state('list');
  let focusedIndex = $state(-1);
  let explorerEl: HTMLDivElement | undefined = $state();

  onMount(() => {
    explorerEl?.focus();
  });

  $effect(() => {
    sortedEntries;
    focusedIndex = -1;
    setTimeout(() => explorerEl?.focus(), 0);
  });

  function scrollFocusedIntoView() {
    const el = document.querySelector('.file-explorer .focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  $effect(() => {
    if (focusedIndex >= 0) {
      setTimeout(scrollFocusedIntoView, 0);
    }
  });

  function handleExplorerKeydown(e: KeyboardEvent) {
    if (isInputFocused()) return;

    const len = sortedEntries.length;
    if (len === 0) return;

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        focusedIndex = Math.min(focusedIndex + 1, len - 1);
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, 0);
        break;
      case 'l':
      case 'Enter': {
        if (focusedIndex < 0 || focusedIndex >= len) break;
        const entry = sortedEntries[focusedIndex];
        if (entry.isDirectory) navigateToDir(entry.path);
        else openFile(entry);
        break;
      }
      case 'h':
      case 'Backspace': {
        const parent = $currentPath;
        if (parent && parent !== '.') {
          const parts = parent.split('/');
          parts.pop();
          navigateToDir(parts.length ? parts.join('/') : '.');
        }
        break;
      }
      case 'g':
        if (!e.shiftKey) {
          e.preventDefault();
          focusedIndex = 0;
        } else {
          e.preventDefault();
          focusedIndex = len - 1;
        }
        break;
      case 'G':
        e.preventDefault();
        focusedIndex = len - 1;
        break;
    }
  }

  async function navigateToDir(dirPath: string) {
    const listing = await fetchDirectory(dirPath, $showHiddenFiles);
    $currentPath = listing.path;
    $entries = listing.entries;
    $selectedFile = null;
    $isEditing = false;
  }

  function openFile(entry: FileEntry) {
    if (!entry.isDirectory) {
      $selectedFile = entry.path;
      $isEditing = false;
    }
  }

  function getIcon(entry: FileEntry): string {
    if (entry.isDirectory) return '📁';
    if (entry.isMarkdown) return '📝';
    return '📄';
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function handleCreated(path: string) {
    showNewFileModal = false;
    $selectedFile = path;
    $isEditing = true;
  }

  let sortedEntries = $derived.by(() => {
    const dirs = $entries.filter((e: FileEntry) => e.isDirectory).sort((a: FileEntry, b: FileEntry) => a.name.localeCompare(b.name));
    const files = $entries.filter((e: FileEntry) => !e.isDirectory).sort((a: FileEntry, b: FileEntry) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  });
</script>

<div class="file-explorer" tabindex="0" onkeydown={handleExplorerKeydown} bind:this={explorerEl}>
  <div class="explorer-header">
    <h2 class="explorer-title">Files</h2>
    <div class="header-actions">
      <div class="view-toggle">
        <button class="toggle-btn" class:active={viewMode === 'list'} onclick={() => viewMode = 'list'} title="List view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <button class="toggle-btn" class:active={viewMode === 'grid'} onclick={() => viewMode = 'grid'} title="Grid view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
      </div>
      <button class="new-file-btn" onclick={() => (showNewFileModal = true)}>
        + New File
      </button>
    </div>
  </div>

  {#if sortedEntries.length === 0}
    <div class="empty-state">
      <span class="empty-icon">📂</span>
      <p class="empty-text">This directory is empty</p>
      <button class="new-file-btn" onclick={() => (showNewFileModal = true)}>
        Create a new file
      </button>
    </div>
  {:else if viewMode === 'list'}
    <div class="file-list">
      <div class="list-header">
        <span class="list-col-name">Name</span>
        <span class="list-col-size">Size</span>
        <span class="list-col-date">Modified</span>
      </div>
      {#each sortedEntries as entry, i (entry.path)}
        <button
          class="list-row"
          class:directory={entry.isDirectory}
          class:markdown={entry.isMarkdown}
          class:focused={focusedIndex === i}
          onclick={() => entry.isDirectory ? navigateToDir(entry.path) : openFile(entry)}
        >
          <span class="list-col-name">
            <span class="row-icon">{getIcon(entry)}</span>
            <span class="row-name">{entry.name}</span>
          </span>
          <span class="list-col-size">{entry.isDirectory ? '--' : formatSize(entry.size)}</span>
          <span class="list-col-date">{formatDate(entry.modifiedAt)}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="file-grid">
      {#each sortedEntries as entry, i (entry.path)}
        <button
          class="file-card"
          class:directory={entry.isDirectory}
          class:markdown={entry.isMarkdown}
          class:focused={focusedIndex === i}
          onclick={() => entry.isDirectory ? navigateToDir(entry.path) : openFile(entry)}
        >
          <span class="card-icon">{getIcon(entry)}</span>
          <span class="card-name">{entry.name}</span>
          <div class="card-meta">
            {#if !entry.isDirectory}
              <span class="card-size">{formatSize(entry.size)}</span>
            {/if}
            <span class="card-date">{formatDate(entry.modifiedAt)}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<NewFileModal
  isOpen={showNewFileModal}
  onClose={() => (showNewFileModal = false)}
  onCreated={handleCreated}
/>

<style>
  .file-explorer {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
  }

  .explorer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .explorer-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .view-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .toggle-btn {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    border: none;
    padding: 6px 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
  }

  .toggle-btn:not(:last-child) {
    border-right: 1px solid var(--border);
  }

  .toggle-btn.active {
    background: var(--accent-blue);
    color: #fff;
  }

  .toggle-btn:hover:not(.active) {
    color: var(--text-primary);
  }

  .new-file-btn {
    background: var(--accent-blue);
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    font-weight: 500;
    transition: opacity 0.15s ease;
  }

  .new-file-btn:hover {
    opacity: 0.9;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    gap: 12px;
  }

  .empty-icon {
    font-size: 48px;
  }

  .empty-text {
    color: var(--text-secondary);
    font-size: 16px;
    margin: 0;
  }

  /* List view */
  .file-list {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    padding: 8px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .list-row {
    display: flex;
    padding: 10px 16px;
    background: var(--bg-primary);
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    text-align: left;
    color: var(--text-primary);
    font-size: 14px;
    transition: background 0.1s;
    align-items: center;
    width: 100%;
  }

  .list-row:last-child {
    border-bottom: none;
  }

  .list-row:hover {
    background: var(--bg-tertiary);
  }

  .list-col-name {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .row-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .row-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .list-col-size {
    width: 80px;
    text-align: right;
    color: var(--text-secondary);
    font-size: 13px;
    flex-shrink: 0;
  }

  .list-col-date {
    width: 120px;
    text-align: right;
    color: var(--text-secondary);
    font-size: 13px;
    flex-shrink: 0;
  }

  /* Grid view */
  .file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .file-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 16px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    color: var(--text-primary);
    font-size: 14px;
  }

  .file-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .card-icon {
    font-size: 28px;
  }

  .card-name {
    font-weight: 500;
    word-break: break-word;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .list-row.focused {
    background: var(--bg-tertiary);
    outline: 2px solid var(--accent-blue);
    outline-offset: -2px;
  }

  .file-card.focused {
    outline: 2px solid var(--accent-blue);
    outline-offset: -2px;
  }

  .file-explorer:focus {
    outline: none;
  }
</style>
