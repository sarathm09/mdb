<script lang="ts">
  import { fetchFile, getRawFileUrl } from '../services/api';
  import { renderMermaidSource } from '../utils/markdown-renderer';
  import hljs from 'highlight.js';

  let { filePath }: { filePath: string } = $props();

  let fileContent = $state('');
  let highlightedHtml = $state('');
  let mermaidSvg = $state('');
  let loading = $state(true);
  let error = $state('');
  let excalidrawCanvas: HTMLCanvasElement | undefined = $state();

  let ext = $derived(filePath.split('.').pop()?.toLowerCase() || '');
  let fileName = $derived(filePath.split('/').pop() || filePath);

  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif']);
  const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac']);
  const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogv', 'mov']);
  const MERMAID_EXTS = new Set(['mmd', 'mermaid']);
  const TEXT_EXTS = new Set([
    'txt', 'json', 'jsonc', 'jsonl', 'ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'less', 'html', 'htm', 'xml',
    'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'sh', 'bash', 'zsh', 'fish', 'py', 'rb', 'go', 'rs', 'java',
    'kt', 'swift', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'sql', 'r', 'lua', 'pl', 'ex', 'exs', 'erl', 'hs',
    'ml', 'clj', 'env', 'gitignore', 'dockerignore', 'editorconfig', 'prettierrc', 'lock', 'log', 'csv', 'tsv',
    'diff', 'patch', 'mmd', 'mermaid', 'excalidraw', 'drawio', 'tex', 'graphql', 'proto', 'properties',
  ]);

  let kind = $derived.by(() => {
    if (ext === 'pdf') return 'pdf';
    if (fileName.toLowerCase().endsWith('.excalidraw') || fileName.toLowerCase().endsWith('.excalidraw.json')) return 'excalidraw';
    if (MERMAID_EXTS.has(ext)) return 'mermaid';
    if (IMAGE_EXTS.has(ext)) return 'image';
    if (AUDIO_EXTS.has(ext)) return 'audio';
    if (VIDEO_EXTS.has(ext)) return 'video';
    if (ext === 'html' || ext === 'htm') return 'html';
    if (TEXT_EXTS.has(ext) || !ext) return 'text';
    return 'binary';
  });

  $effect(() => {
    loadFile(filePath, kind);
  });

  $effect(() => {
    if (kind === 'excalidraw' && fileContent && excalidrawCanvas) {
      renderExcalidraw(excalidrawCanvas, fileContent);
    }
  });

  async function loadFile(path: string, previewKind: string) {
    loading = true;
    error = '';
    fileContent = '';
    highlightedHtml = '';
    mermaidSvg = '';

    if (['image', 'audio', 'video', 'pdf', 'html', 'binary'].includes(previewKind)) {
      loading = false;
      return;
    }

    try {
      const file = await fetchFile(path);
      fileContent = file.content;
      if (previewKind === 'mermaid') {
        mermaidSvg = await renderMermaidSource(file.content);
      } else if (previewKind === 'text') {
        let source = file.content;
        if (ext === 'json') {
          try { source = JSON.stringify(JSON.parse(source), null, 2); } catch { /* show original malformed JSON */ }
        }
        const language = hljs.getLanguage(ext) ? ext : undefined;
        highlightedHtml = language
          ? hljs.highlight(source, { language }).value
          : hljs.highlightAuto(source).value;
        fileContent = source;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    loading = false;
  }

  function renderExcalidraw(canvas: HTMLCanvasElement, source: string) {
    try {
      const data = JSON.parse(source) as { elements?: ExcalidrawElement[]; appState?: { viewBackgroundColor?: string } };
      if (!Array.isArray(data.elements)) throw new Error('Missing Excalidraw elements');
      const elements = data.elements.filter((element) => !element.isDeleted);
      const bounds = drawingBounds(elements);
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(320, canvas.clientWidth || 900);
      const height = Math.max(240, canvas.clientHeight || 600);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(ratio, ratio);
      context.fillStyle = data.appState?.viewBackgroundColor || '#ffffff';
      context.fillRect(0, 0, width, height);
      const scale = Math.min((width - 48) / Math.max(bounds.width, 1), (height - 48) / Math.max(bounds.height, 1), 2);
      context.translate(24 - bounds.x * scale, 24 - bounds.y * scale);
      context.scale(scale, scale);
      for (const element of elements) drawElement(context, element);
    } catch (err) {
      error = `Invalid Excalidraw file: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  interface ExcalidrawElement {
    type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    strokeColor?: string;
    backgroundColor?: string;
    strokeWidth?: number;
    opacity?: number;
    points?: [number, number][];
    text?: string;
    fontSize?: number;
    isDeleted?: boolean;
  }

  function drawingBounds(elements: ExcalidrawElement[]) {
    if (elements.length === 0) return { x: 0, y: 0, width: 900, height: 600 };
    const minX = Math.min(...elements.map((element) => element.x ?? 0));
    const minY = Math.min(...elements.map((element) => element.y ?? 0));
    const maxX = Math.max(...elements.map((element) => (element.x ?? 0) + Math.abs(element.width ?? 0)));
    const maxY = Math.max(...elements.map((element) => (element.y ?? 0) + Math.abs(element.height ?? 0)));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function drawElement(context: CanvasRenderingContext2D, element: ExcalidrawElement) {
    const x = element.x ?? 0;
    const y = element.y ?? 0;
    const width = element.width ?? 0;
    const height = element.height ?? 0;
    context.save();
    context.globalAlpha = Math.max(0, Math.min(1, (element.opacity ?? 100) / 100));
    context.strokeStyle = element.strokeColor || '#1b1b1f';
    context.fillStyle = element.backgroundColor && element.backgroundColor !== 'transparent' ? element.backgroundColor : 'transparent';
    context.lineWidth = element.strokeWidth || 2;
    context.beginPath();
    if (element.type === 'rectangle') context.rect(x, y, width, height);
    else if (element.type === 'ellipse') context.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
    else if (element.type === 'diamond') {
      context.moveTo(x + width / 2, y); context.lineTo(x + width, y + height / 2);
      context.lineTo(x + width / 2, y + height); context.lineTo(x, y + height / 2); context.closePath();
    } else if (element.type === 'text') {
      context.font = `${element.fontSize || 20}px system-ui, sans-serif`;
      context.textBaseline = 'top';
      for (const [index, line] of (element.text || '').split('\n').entries()) context.fillText(line, x, y + index * (element.fontSize || 20) * 1.25);
      context.restore();
      return;
    } else if (element.points?.length) {
      context.moveTo(x + element.points[0][0], y + element.points[0][1]);
      for (const point of element.points.slice(1)) context.lineTo(x + point[0], y + point[1]);
    } else {
      context.restore();
      return;
    }
    if (context.fillStyle !== 'transparent') context.fill();
    context.stroke();
    context.restore();
  }
</script>

<div class="file-preview">
  {#if loading}
    <div class="state">Loading...</div>
  {:else if error}
    <div class="state state--error" role="alert">{error}</div>
  {:else if kind === 'image'}
    <div class="centered"><img src={getRawFileUrl(filePath)} alt={fileName} /></div>
  {:else if kind === 'audio'}
    <div class="centered"><audio src={getRawFileUrl(filePath)} controls><a href={getRawFileUrl(filePath)}>Download {fileName}</a></audio></div>
  {:else if kind === 'video'}
    <div class="centered"><video src={getRawFileUrl(filePath)} controls aria-label={`Video preview: ${fileName}`}><a href={getRawFileUrl(filePath)}>Download {fileName}</a></video></div>
  {:else if kind === 'pdf'}
    <iframe class="document-frame" src={getRawFileUrl(filePath)} title={`PDF preview: ${fileName}`}></iframe>
  {:else if kind === 'html'}
    <iframe class="document-frame" src={getRawFileUrl(filePath)} title={`HTML preview: ${fileName}`} sandbox=""></iframe>
  {:else if kind === 'mermaid'}
    <div class="diagram-preview">{@html mermaidSvg}</div>
  {:else if kind === 'excalidraw'}
    <div class="canvas-wrap"><canvas bind:this={excalidrawCanvas} role="img" aria-label={`Excalidraw preview: ${fileName}`}></canvas></div>
  {:else if kind === 'text'}
    <div class="code-preview"><pre><code>{@html highlightedHtml}</code></pre></div>
  {:else}
    <div class="state binary-state">
      <p>Preview unavailable for {fileName}</p>
      <a class="download-link" href={getRawFileUrl(filePath)} download={fileName}>Download file</a>
    </div>
  {/if}
</div>

<style>
  .file-preview { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; width: 100%; height: 100%; border-radius: 16px; background: var(--surface-raised); box-shadow: var(--surface-shadow); backdrop-filter: blur(16px); }
  .state, .centered { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); }
  .state--error { color: var(--accent-red); padding: 24px; text-align: center; }
  .centered { padding: 24px; overflow: auto; }
  .centered img, .centered video { max-width: 100%; max-height: 100%; object-fit: contain; }
  .centered audio { width: min(640px, 90%); }
  .document-frame { flex: 1; width: 100%; border: 0; background: #fff; }
  .diagram-preview { flex: 1; overflow: auto; display: grid; place-items: center; padding: 24px; }
  .diagram-preview :global(svg) { max-width: 100%; max-height: 100%; }
  .canvas-wrap { flex: 1; overflow: hidden; padding: 16px; background: var(--bg-tertiary); }
  .canvas-wrap canvas { width: 100%; height: 100%; display: block; background: #fff; border-radius: 8px; }
  .code-preview { flex: 1; overflow: auto; }
  .code-preview pre { margin: 0; padding: 24px; font: 14px/1.6 'JetBrains Mono', 'Fira Code', Consolas, monospace; background: transparent; color: var(--text-primary); white-space: pre; }
  .binary-state { flex-direction: column; gap: 12px; }
  .download-link { padding: 8px 16px; background: var(--accent-blue); color: #fff; border-radius: 6px; text-decoration: none; }
</style>
