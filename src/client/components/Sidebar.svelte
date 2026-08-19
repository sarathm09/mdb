<script lang="ts">
  import { untrack } from 'svelte';
  import { currentPath, entries, selectedFile, sidebarOpen, showHiddenFiles } from '../stores/navigation';
  import { isEditing } from '../stores/editor';
  import { fetchDirectory, searchFiles } from '../services/api';
  import type { FileEntry } from '../../shared/types';

  let expandedDirs: Set<string> = $state(new Set(['.']));
  let treeData: Map<string, FileEntry[]> = $state(new Map());
  let loadingDirs: Set<string> = $state(new Set());
  let searchQuery = $state('');
  let searchResults: FileEntry[] = $state([]);
  let searching = $state(false);
  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  function handleSearchInput() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    const query = searchQuery.trim();
    if (!query) {
      searchResults = [];
      searching = false;
      return;
    }
    searching = true;
    searchDebounceTimer = setTimeout(async () => {
      try {
        searchResults = await searchFiles(query, $showHiddenFiles, 100, 'all');
      } catch {
        searchResults = [];
      }
      searching = false;
    }, 250);
  }

  function clearSearch() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchQuery = '';
    searchResults = [];
    searching = false;
  }

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
      <div class="search-container">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <label class="sr-only" for="sidebar-search">Search files</label>
        <input
          id="sidebar-search"
          class="search-input"
          type="search"
          placeholder="Search files..."
          bind:value={searchQuery}
          oninput={handleSearchInput}
          onkeydown={(e) => { if (e.key === 'Escape') clearSearch(); }}
        />
        {#if searchQuery}
          <button class="search-clear" onclick={clearSearch} aria-label="Clear file search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        {/if}
      </div>
    </div>
    <div class="tree-content">
      {#if searchQuery.trim()}
        {#if searching}
          <div class="search-empty" role="status">Searching...</div>
        {:else if searchResults.length === 0}
          <div class="search-empty" role="status">No results</div>
        {:else}
          {#each searchResults as entry (entry.path)}
            <button class="tree-row tree-file search-result" class:active={$selectedFile === entry.path} onclick={() => openFile(entry)}>
              <span class="tree-file-icon">{getIcon(entry)}</span>
              <span class="search-result-info">
                <span class="tree-label">{entry.name}</span>
                <span class="search-result-path">{entry.path}</span>
              </span>
            </button>
          {/each}
        {/if}
      {:else}
        {#snippet treeNode(dirPath: string, depth: number)}
          {@const children = treeData.get(dirPath) || []}
          {@const dirs = children.filter(e => e.isDirectory).sort((a, b) => a.name.localeCompare(b.name))}
          {@const files = children.filter(e => !e.isDirectory).sort((a, b) => a.name.localeCompare(b.name))}
          {#each dirs as entry (entry.path)}
            {@const isExpanded = expandedDirs.has(entry.path)}
            {@const isLoading = loadingDirs.has(entry.path)}
            <button class="tree-row" class:expanded-dir={isExpanded} style="padding-left: {12 + depth * 16}px" onclick={() => toggleDir(entry.path)} ondblclick={() => navigateToDir(entry.path)}>
              <svg class="tree-arrow" class:expanded={isExpanded} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              <span class="tree-folder-icon">{isLoading ? '⏳' : '📁'}</span>
              <span class="tree-label">{entry.name}</span>
            </button>
            {#if isExpanded}{@render treeNode(entry.path, depth + 1)}{/if}
          {/each}
          {#each files as entry (entry.path)}
            <button class="tree-row tree-file" class:active={$selectedFile === entry.path} style="padding-left: {22 + depth * 16}px" onclick={() => openFile(entry)}>
              <span class="tree-file-icon">{getIcon(entry)}</span>
              <span class="tree-label">{entry.name}</span>
              <span class="tree-size">{formatSize(entry.size)}</span>
            </button>
          {/each}
        {/snippet}
        {@render treeNode('.', 0)}
      {/if}
    </div>
  </aside>
{/if}

<style>
  .tree-sidebar {
    width: 100%;
    height: 100%;
    background: transparent;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tree-header {
    padding: 14px 16px 10px;
    border-bottom: 0;
  }

  .tree-title {
    font-size: 12px;
    font-weight: 600;
    color: color-mix(in srgb, var(--text-primary) 78%, white);
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .tree-content {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
  }

  .tree-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: none;
    color: color-mix(in srgb, var(--text-primary) 94%, white);
    font-size: calc(var(--sidebar-font-size, 14px) + 1px);
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: background 0.1s ease;
    min-height: 34px;
    font-weight: 520;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .55);
  }

  .tree-row:hover {
    background: var(--surface-raised);
  }

  .tree-row.active {
    background: color-mix(in srgb, var(--accent-blue) 24%, var(--bg-tertiary) 42%, transparent);
    color: color-mix(in srgb, var(--accent-blue) 72%, white);
    border-radius: 10px;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-blue) 38%, transparent), var(--control-shadow);
    font-weight: 650;
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
    font-size: 18px;
    width: 20px;
    text-align: center;
  }

  .tree-label {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .tree-size {
    font-size: 11px;
    color: color-mix(in srgb, var(--text-primary) 64%, white);
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 8px;
  }

  .tree-row.expanded-dir {
    background: rgba(97, 175, 239, 0.05);
  }

  .tree-file {
    color: var(--text-primary);
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 6px 10px;
    background: var(--control-raised);
    border: 1px solid var(--border);
    border-radius: 11px;
    box-shadow: inset 0 2px 5px rgba(1, 3, 7, 0.62), inset 0 0 0 1px rgba(1, 3, 7, 0.24);
  }

  .search-icon { flex-shrink: 0; width: 16px; height: 16px; color: color-mix(in srgb, var(--text-primary) 72%, white); }
  .search-input { flex: 1; min-width: 0; padding: 2px 0; background: transparent; border: none; color: color-mix(in srgb, var(--text-primary) 96%, white); font-size: 13px; font-weight: 520; outline: none; box-shadow: none; backdrop-filter: none; }
  .search-input::placeholder { color: color-mix(in srgb, var(--text-primary) 62%, transparent); opacity: 1; }
  .search-input::-webkit-search-cancel-button { display: none; }
  .search-clear { display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 2px; background: none; border: none; color: var(--text-secondary); }
  .search-clear:hover { color: var(--text-primary); background: var(--bg-secondary); }
  .search-empty { padding: 24px 16px; text-align: center; color: var(--text-secondary); font-size: 12px; }
  .search-result { padding-left: 12px; }
  .search-result-info { display: flex; flex: 1; flex-direction: column; min-width: 0; }
  .search-result-path { overflow: hidden; color: var(--text-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
