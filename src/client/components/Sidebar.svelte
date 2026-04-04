<script lang="ts">
  import { untrack } from 'svelte';
  import { currentPath, entries, selectedFile, sidebarOpen, showHiddenFiles } from '../stores/navigation';
  import { isEditing } from '../stores/editor';
  import { fetchDirectory } from '../services/api';
  import type { FileEntry } from '../../shared/types';

  let expandedDirs: Set<string> = $state(new Set(['.']));
  let treeData: Map<string, FileEntry[]> = $state(new Map());
  let loadingDirs: Set<string> = $state(new Set());

  async function loadDir(dirPath: string) {
    if (treeData.has(dirPath)) return;
    loadingDirs = new Set([...loadingDirs, dirPath]);
    try {
      const listing = await fetchDirectory(dirPath, $showHiddenFiles);
      treeData = new Map(treeData).set(dirPath, listing.entries);
      if (dirPath === '.' || dirPath === $currentPath) {
        $entries = listing.entries;
      }
    } catch {}
    const next = new Set(loadingDirs);
    next.delete(dirPath);
    loadingDirs = next;
  }

  async function toggleDir(dirPath: string) {
    if (expandedDirs.has(dirPath)) {
      const next = new Set(expandedDirs);
      next.delete(dirPath);
      expandedDirs = next;
    } else {
      expandedDirs = new Set([...expandedDirs, dirPath]);
      await loadDir(dirPath);
    }
  }

  async function navigateToDir(dirPath: string) {
    const listing = await fetchDirectory(dirPath, $showHiddenFiles);
    $currentPath = listing.path;
    $entries = listing.entries;
    $selectedFile = null;
    $isEditing = false;
    treeData = new Map(treeData).set(dirPath, listing.entries);
    expandedDirs = new Set([...expandedDirs, dirPath]);
  }

  function openFile(entry: FileEntry) {
    const dir = entry.path.includes('/') ? entry.path.substring(0, entry.path.lastIndexOf('/')) : '.';
    if (dir !== $currentPath) {
      navigateToDir(dir).then(() => {
        $selectedFile = entry.path;
        $isEditing = false;
      });
    } else {
      $selectedFile = entry.path;
      $isEditing = false;
    }
  }

  function getIcon(entry: FileEntry): string {
    if (entry.isDirectory) return '';
    if (entry.isMarkdown) return '📝';
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return '🖼️';
    if (['ts', 'js', 'tsx', 'jsx'].includes(ext)) return '⚡';
    if (['json', 'yaml', 'yml', 'toml', 'xml'].includes(ext)) return '⚙️';
    if (['css', 'scss', 'less'].includes(ext)) return '🎨';
    if (['html', 'svelte', 'vue'].includes(ext)) return '🌐';
    if (['sh', 'bash', 'zsh'].includes(ext)) return '💻';
    if (['py', 'rb', 'go', 'rs', 'java', 'swift', 'kt', 'c', 'cpp'].includes(ext)) return '📦';
    return '📄';
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  $effect(() => {
    void $showHiddenFiles;
    untrack(() => {
      treeData = new Map();
      for (const dir of expandedDirs) {
        loadDir(dir);
      }
    });
  });

  loadDir('.');
</script>

{#if $sidebarOpen}
  <aside class="tree-sidebar">
    <div class="tree-header">
      <span class="tree-title">Explorer</span>
    </div>
    <div class="tree-content">
      {#snippet treeNode(dirPath: string, depth: number)}
        {@const children = treeData.get(dirPath) || []}
        {@const dirs = children.filter(e => e.isDirectory).sort((a, b) => a.name.localeCompare(b.name))}
        {@const files = children.filter(e => !e.isDirectory).sort((a, b) => a.name.localeCompare(b.name))}
        {#each dirs as entry (entry.path)}
          {@const isExpanded = expandedDirs.has(entry.path)}
          {@const isLoading = loadingDirs.has(entry.path)}
          <button
            class="tree-row"
            style="padding-left: {12 + depth * 16}px"
            onclick={() => toggleDir(entry.path)}
            ondblclick={() => navigateToDir(entry.path)}
          >
            <svg class="tree-arrow" class:expanded={isExpanded} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            <span class="tree-folder-icon">{isLoading ? '⏳' : '📁'}</span>
            <span class="tree-label">{entry.name}</span>
          </button>
          {#if isExpanded}
            {@render treeNode(entry.path, depth + 1)}
          {/if}
        {/each}
        {#each files as entry (entry.path)}
          <button
            class="tree-row tree-file"
            class:active={$selectedFile === entry.path}
            style="padding-left: {22 + depth * 16}px"
            onclick={() => openFile(entry)}
          >
            <span class="tree-file-icon">{getIcon(entry)}</span>
            <span class="tree-label">{entry.name}</span>
            <span class="tree-size">{formatSize(entry.size)}</span>
          </button>
        {/each}
      {/snippet}
      {@render treeNode('.', 0)}
    </div>
  </aside>
{/if}

<style>
  .tree-sidebar {
    width: 100%;
    height: 100%;
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tree-header {
    padding: 12px 16px 8px;
    border-bottom: 1px solid var(--border);
  }

  .tree-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .tree-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .tree-row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 3px 12px;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: var(--sidebar-font-size, 14px);
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: background 0.1s ease;
    min-height: 26px;
  }

  .tree-row:hover {
    background: var(--bg-tertiary);
  }

  .tree-row.active {
    background: var(--bg-tertiary);
    color: var(--accent-blue);
  }

  .tree-arrow {
    flex-shrink: 0;
    color: var(--text-secondary);
    transition: transform 0.15s ease;
  }

  .tree-arrow.expanded {
    transform: rotate(90deg);
  }

  .tree-folder-icon,
  .tree-file-icon {
    flex-shrink: 0;
    font-size: 14px;
    width: 16px;
    text-align: center;
  }

  .tree-label {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .tree-size {
    font-size: 10px;
    color: var(--text-secondary);
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 8px;
  }

  .tree-file {
    color: var(--text-primary);
  }
</style>
