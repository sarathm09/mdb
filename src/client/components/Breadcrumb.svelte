<script lang="ts">
  import { currentPath, entries, selectedFile, rootName, showHiddenFiles } from '../stores/navigation';
  import { isEditing } from '../stores/editor';
  import { fetchDirectory } from '../services/api';

  let segments = $derived.by(() => {
    const p = $currentPath;
    if (!p || p === '.') return [];
    return p.split('/').filter(Boolean);
  });

  async function navigateTo(index: number) {
    const targetPath = index < 0 ? '.' : segments.slice(0, index + 1).join('/');
    const listing = await fetchDirectory(targetPath, $showHiddenFiles);
    $currentPath = listing.path;
    $entries = listing.entries;
    $selectedFile = null;
    $isEditing = false;
  }
</script>

<nav class="breadcrumb">
  <button
    class="breadcrumb-segment"
    class:current={segments.length === 0}
    onclick={() => navigateTo(-1)}
    disabled={segments.length === 0}
  >
    {$rootName || 'Home'}
  </button>

  {#each segments as segment, i (i)}
    <span class="separator">›</span>
    {#if i === segments.length - 1}
      <span class="breadcrumb-segment current">{segment}</span>
    {:else}
      <button
        class="breadcrumb-segment"
        onclick={() => navigateTo(i)}
      >
        {segment}
      </button>
    {/if}
  {/each}
</nav>

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    font-size: 14px;
    flex-wrap: wrap;
  }

  .separator {
    color: var(--text-secondary);
    font-size: 16px;
    user-select: none;
  }

  .breadcrumb-segment {
    background: none;
    border: none;
    color: var(--accent-blue);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 14px;
    transition: background 0.15s ease;
  }

  .breadcrumb-segment:hover:not(.current) {
    background: var(--bg-tertiary);
    text-decoration: underline;
  }

  .breadcrumb-segment.current {
    color: var(--text-primary);
    cursor: default;
    font-weight: 500;
  }
</style>
