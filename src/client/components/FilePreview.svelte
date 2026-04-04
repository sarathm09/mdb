<script lang="ts">
  import { fetchFile, getRawFileUrl } from '../services/api';
  import hljs from 'highlight.js';

  let { filePath }: { filePath: string } = $props();

  let fileContent = $state('');
  let loading = $state(true);
  let error = $state('');

  const ext = $derived(filePath.split('.').pop()?.toLowerCase() || '');
  let fileName = $derived(filePath.split('/').pop() || filePath);

  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
  const TEXT_EXTS = [
    'txt', 'json', 'ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'less', 'html', 'xml', 'svg',
    'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'sh', 'bash', 'zsh', 'fish',
    'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp', 'cs',
    'php', 'sql', 'r', 'lua', 'pl', 'ex', 'exs', 'erl', 'hs', 'ml', 'clj',
    'env', 'gitignore', 'dockerignore', 'editorconfig', 'prettierrc',
    'lock', 'log', 'csv', 'tsv', 'diff', 'patch',
  ];

  const isImage = $derived(IMAGE_EXTS.includes(ext));
  const isText = $derived(TEXT_EXTS.includes(ext) || !ext);
  const isBinary = $derived(!isImage && !isText);

  let highlightedHtml = $state('');

  $effect(() => {
    loadFile(filePath);
  });

  async function loadFile(path: string) {
    loading = true;
    error = '';
    fileContent = '';
    highlightedHtml = '';

    if (isImage || isBinary) {
      loading = false;
      return;
    }

    try {
      const file = await fetchFile(path);
      fileContent = file.content;
      try {
        const lang = hljs.getLanguage(ext) ? ext : undefined;
        if (lang) {
          highlightedHtml = hljs.highlight(fileContent, { language: lang }).value;
        } else {
          highlightedHtml = hljs.highlightAuto(fileContent).value;
        }
      } catch {
        highlightedHtml = '';
      }
    } catch (err) {
      error = `Failed to load file: ${err}`;
    }
    loading = false;
  }
</script>

<div class="file-preview">
  {#if loading}
    <div class="loading-state">Loading...</div>
  {:else if error}
    <div class="error-state">{error}</div>
  {:else if isImage}
    <div class="image-preview">
      <img src={getRawFileUrl(filePath)} alt={fileName} />
    </div>
  {:else if isText}
    <div class="code-preview">
      <pre><code>{#if highlightedHtml}{@html highlightedHtml}{:else}{fileContent}{/if}</code></pre>
    </div>
  {:else}
    <div class="binary-preview">
      <span class="binary-icon">📄</span>
      <p class="binary-name">{fileName}</p>
      <p class="binary-hint">Binary file - cannot be previewed</p>
      <a class="download-link" href={getRawFileUrl(filePath)} download={fileName}>
        Download
      </a>
    </div>
  {/if}
</div>

<style>
  .file-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .loading-state,
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-secondary);
    font-size: 16px;
  }

  .error-state {
    color: var(--accent-red);
  }

  .image-preview {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: 24px;
  }

  .image-preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }

  .code-preview {
    flex: 1;
    overflow: auto;
    padding: 0;
  }

  .code-preview pre {
    margin: 0;
    padding: 24px;
    font-size: 14px;
    line-height: 1.6;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    background: transparent;
    color: var(--text-primary);
    white-space: pre;
    overflow-x: auto;
  }

  .code-preview code {
    font-family: inherit;
  }

  .binary-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .binary-icon {
    font-size: 48px;
  }

  .binary-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .binary-hint {
    color: var(--text-secondary);
    font-size: 14px;
  }

  .download-link {
    padding: 8px 16px;
    background: var(--accent-blue);
    color: #fff;
    border-radius: 6px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
  }

  .download-link:hover {
    opacity: 0.9;
  }
</style>
