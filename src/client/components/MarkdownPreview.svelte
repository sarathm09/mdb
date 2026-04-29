<script lang="ts">
  import { fetchFile } from '../services/api';
  import { content, originalContent, renderedHtml } from '../stores/editor';
  import { currentPath } from '../stores/navigation';
  import { renderMarkdown, postProcessElement } from '../utils/markdown-renderer';
  import { parseFrontmatter } from '../utils/frontmatter';
  import type { FrontmatterData } from '../utils/frontmatter';

  let { filePath }: { filePath: string } = $props();

  let htmlContent = $state('');
  let loading = $state(true);
  let previewEl: HTMLDivElement | undefined = $state();
  let frontmatter: FrontmatterData | null = $state(null);

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
      htmlContent = await renderMarkdown(body, dirPath);
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

</script>

<div class="preview-container">
  {#if loading}
    <div class="loading-state">Loading...</div>
  {:else}
    <div class="markdown-body" bind:this={previewEl}>
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
</div>

<style>
  .preview-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
    line-height: var(--line-height-content, 1.7);
    font-size: var(--font-size-content, 15px);
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
  }

</style>
