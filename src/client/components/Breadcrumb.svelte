<script lang="ts">
  import { currentPath, entries, selectedFile, rootName, rootPath, showHiddenFiles } from '../stores/navigation';
  import { isEditing } from '../stores/editor';
  import { fetchDirectory } from '../services/api';

  let relativePath = $derived($selectedFile ?? ($currentPath === '.' ? '' : $currentPath));
  let segments = $derived(relativePath.split('/').filter(Boolean));
  let rootPrefix = $derived.by(() => {
    if (!$rootPath || !$rootName) return '';
    return $rootPath.slice(0, Math.max(0, $rootPath.length - $rootName.length));
  });
  let copied = $state(false);

  let absolutePath = $derived.by(() => {
    if (!$rootPath) return relativePath;
    if (!relativePath) return $rootPath;
    return `${$rootPath.replace(/\/$/, '')}/${relativePath}`;
  });

  async function navigateTo(index: number) {
    const targetPath = index < 0 ? '.' : segments.slice(0, index + 1).join('/');
    const listing = await fetchDirectory(targetPath, $showHiddenFiles);
    $currentPath = listing.path;
    $entries = listing.entries;
    $selectedFile = null;
    $isEditing = false;
  }

  async function copyPath() {
    await navigator.clipboard.writeText(absolutePath);
    copied = true;
    setTimeout(() => copied = false, 1400);
  }
</script>

<nav class="breadcrumb">
  {#if rootPrefix}<span class="root-prefix">{rootPrefix}</span>{/if}
  <button
    class="breadcrumb-segment"
    onclick={() => navigateTo(-1)}
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
  <button class="copy-path" onclick={copyPath} title={`Copy path: ${absolutePath}`} aria-label="Copy full file path">
    {#if copied}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
    {:else}
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg>
    {/if}
  </button>
</nav>

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    font-size: 14px;
    flex-wrap: nowrap;
    min-width: 0;
    max-width: min(62vw, 760px);
  }

  .separator {
    color: var(--text-secondary);
    font-size: 16px;
    user-select: none;
  }

  .root-prefix {
    flex-shrink: 1;
    min-width: 1.5em;
    overflow: hidden;
    color: var(--text-secondary);
    direction: rtl;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .breadcrumb-segment {
    background: none;
    border: none;
    color: color-mix(in srgb, var(--accent-blue) 78%, white);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 7px;
    font-size: 14px;
    transition: background 0.15s ease;
  }

  .breadcrumb-segment:hover:not(.current) {
    background: transparent;
    color: var(--text-primary);
    text-decoration: underline;
  }

  .breadcrumb-segment.current {
    overflow: hidden;
    color: color-mix(in srgb, var(--text-primary) 96%, white);
    cursor: default;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .copy-path {
    width: 27px;
    height: 27px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    box-shadow: none;
  }

  .copy-path:hover { color: var(--text-primary); background: transparent; }
  .copy-path svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
</style>
