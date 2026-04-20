<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorView, keymap, lineNumbers } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { content, originalContent, isDirty } from '../stores/editor';
  import { theme } from '../stores/navigation';
  import { saveFile, fetchFile, uploadFile } from '../services/api';

  let { filePath }: { filePath: string } = $props();

  let editorContainer: HTMLDivElement | undefined = $state();
  let view: EditorView | undefined = $state();
  let saving = $state(false);
  let loading = $state(true);
  let isDragging = $state(false);
  let initialized = false;

  const lightTheme = EditorView.theme({
    '&': { backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' },
    '.cm-content': { caretColor: 'var(--text-primary)' },
    '.cm-cursor': { borderLeftColor: 'var(--text-primary)' },
    '.cm-activeLine': { backgroundColor: 'var(--bg-tertiary)' },
    '.cm-gutters': { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--bg-tertiary)' },
    '.cm-selectionMatch': { backgroundColor: 'rgba(9, 105, 218, 0.15)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'rgba(9, 105, 218, 0.2)' },
  }, { dark: false });

  async function handleSave() {
    if (!filePath) return;
    saving = true;
    try {
      await saveFile(filePath, $content);
      $originalContent = $content;
    } catch (err) {
      alert(`Failed to save: ${err}`);
    }
    saving = false;
  }

  function wrapSelection(view: EditorView, before: string, after: string): boolean {
    const { from, to } = view.state.selection.main;
    if (from === to) {
      const placeholder = 'text';
      const insert = before + placeholder + after;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + before.length, head: from + before.length + placeholder.length },
      });
    } else {
      const selected = view.state.sliceDoc(from, to);
      const insert = before + selected + after;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + before.length, head: from + before.length + selected.length },
      });
    }
    return true;
  }

  function insertLink(view: EditorView): boolean {
    const { from, to } = view.state.selection.main;
    const selected = from === to ? 'text' : view.state.sliceDoc(from, to);
    const insert = `[${selected}](url)`;
    const urlStart = from + selected.length + 3;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: urlStart, head: urlStart + 3 },
    });
    return true;
  }

  function insertCodeBlock(view: EditorView): boolean {
    const { from, to } = view.state.selection.main;
    const selected = from === to ? '' : view.state.sliceDoc(from, to);
    const insert = '```\n' + selected + '\n```';
    const contentStart = from + 4;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: contentStart, head: contentStart + selected.length },
    });
    return true;
  }

  function generateTable(cols: number, rows: number): string {
    const header = '| ' + Array.from({ length: cols }, (_, i) => `Header ${i + 1}`).join(' | ') + ' |';
    const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
    const dataRows = Array.from({ length: rows }, () =>
      '| ' + Array.from({ length: cols }, () => '   ').join(' | ') + ' |'
    ).join('\n');
    return header + '\n' + separator + '\n' + dataRows;
  }

  function insertTable(view: EditorView): boolean {
    showTableDialog = true;
    pendingView = view;
    return true;
  }

  function confirmTableInsert() {
    if (!pendingView) return;
    const v = pendingView;
    const { from, to } = v.state.selection.main;
    const table = generateTable(tableCols, tableRows);
    const needsNewline = from > 0 && v.state.sliceDoc(from - 1, from) !== '\n' ? '\n\n' : '\n';
    const insert = (from === 0 ? '' : needsNewline) + table + '\n';
    v.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.indexOf('Header 1'), head: from + insert.indexOf('Header 1') + 8 },
    });
    showTableDialog = false;
    pendingView = undefined;
    v.focus();
  }

  let showTableDialog = $state(false);
  let tableCols = $state(3);
  let tableRows = $state(2);
  let pendingView: EditorView | undefined = $state();

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (!e.dataTransfer?.files.length) return;
    const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '.';
    for (const file of e.dataTransfer.files) {
      const uploadedPath = await uploadFile(file, dir);
      const isImage = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i.test(file.name);
      const relativeName = uploadedPath.split('/').pop() || file.name;
      const relativeLink = `assets/${relativeName}`;
      const mdLink = isImage ? `![${file.name}](${relativeLink})` : `[${file.name}](${relativeLink})`;
      if (view) {
        const pos = view.state.selection.main.head;
        view.dispatch({ changes: { from: pos, insert: mdLink + '\n' } });
      }
    }
  }

  function getThemeExtension(currentTheme: string) {
    return currentTheme === 'github-light' ? lightTheme : oneDark;
  }

  function createEditor(doc: string) {
    if (!editorContainer) return;

    const saveKeymap = keymap.of([{
      key: 'Mod-s',
      run: () => {
        handleSave();
        return true;
      },
    }]);

    const formattingKeymap = keymap.of([
      { key: 'Mod-b', run: (v) => wrapSelection(v, '**', '**') },
      { key: 'Mod-i', run: (v) => wrapSelection(v, '*', '*') },
      { key: 'Mod-u', run: (v) => wrapSelection(v, '<u>', '</u>') },
      { key: 'Mod-k', run: (v) => insertLink(v) },
      { key: 'Mod-Shift-x', run: (v) => wrapSelection(v, '~~', '~~') },
      { key: 'Mod-Shift-k', run: (v) => insertCodeBlock(v) },
      { key: 'Mod-Shift-t', run: (v) => insertTable(v) },
    ]);

    const startState = EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        saveKeymap,
        formattingKeymap,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        getThemeExtension($theme),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            content.set(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" },
        }),
      ],
    });

    view = new EditorView({
      state: startState,
      parent: editorContainer!,
    });
  }

  $effect(() => {
    const currentTheme = $theme;
    if (!initialized || !editorContainer) return;
    const doc = view ? view.state.doc.toString() : $content;
    if (view) {
      view.destroy();
      view = undefined;
    }
    createEditor(doc);
  });

  onMount(() => {
    if (!editorContainer) return;

    async function init() {
      try {
        const file = await fetchFile(filePath);
        $content = file.content;
        $originalContent = file.content;
      } catch {
        $content = '';
        $originalContent = '';
      }
      loading = false;
      createEditor($content);
      initialized = true;
    }

    init();
    return () => view?.destroy();
  });
</script>

<div class="editor-container" ondragover={handleDragOver} ondragleave={handleDragLeave} ondrop={handleDrop} class:drag-over={isDragging}>
  {#if loading}
    <div class="loading-state">Loading...</div>
  {/if}
  <div class="editor-area" class:hidden={loading} bind:this={editorContainer}></div>
</div>

{#if showTableDialog}
  <div class="table-dialog-backdrop" onclick={() => { showTableDialog = false; pendingView?.focus(); }} onkeydown={(e) => { if (e.key === 'Escape') { showTableDialog = false; pendingView?.focus(); } }} role="dialog" aria-modal="true">
    <div class="table-dialog" onclick={(e) => e.stopPropagation()}>
      <h4 class="table-dialog-title">Insert Table</h4>
      <div class="table-dialog-fields">
        <label class="table-dialog-label">
          Columns
          <input type="number" min="1" max="20" bind:value={tableCols} class="table-dialog-input" />
        </label>
        <label class="table-dialog-label">
          Rows
          <input type="number" min="1" max="50" bind:value={tableRows} class="table-dialog-input" />
        </label>
      </div>
      <div class="table-dialog-preview">
        <div class="table-preview-grid" style="grid-template-columns: repeat({tableCols}, 1fr);">
          {#each Array(Math.min(tableCols * (tableRows + 1), 100)) as _, i}
            <div class="table-preview-cell" class:header={i < tableCols}></div>
          {/each}
        </div>
        <span class="table-preview-label">{tableCols} x {tableRows}</span>
      </div>
      <div class="table-dialog-actions">
        <button class="table-dialog-btn" onclick={() => { showTableDialog = false; pendingView?.focus(); }}>Cancel</button>
        <button class="table-dialog-btn primary" onclick={confirmTableInsert}>Insert</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .drag-over {
    position: relative;
  }

  .drag-over::after {
    content: 'Drop files here';
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(97, 175, 239, 0.1);
    border: 2px dashed var(--accent-blue);
    border-radius: 8px;
    font-size: 18px;
    color: var(--accent-blue);
    font-weight: 600;
    pointer-events: none;
    z-index: 10;
  }

  .editor-area {
    flex: 1;
    overflow: hidden;
  }

  .editor-area.hidden {
    display: none;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-secondary);
    font-size: 16px;
  }

  .editor-area :global(.cm-editor) {
    height: 100%;
  }

  .table-dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .table-dialog {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    width: 300px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .table-dialog-title {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .table-dialog-fields {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .table-dialog-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .table-dialog-input {
    width: 100%;
    padding: 8px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    box-sizing: border-box;
  }

  .table-dialog-input:focus {
    border-color: var(--accent-blue);
    outline: none;
  }

  .table-dialog-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .table-preview-grid {
    display: grid;
    gap: 2px;
    width: 100%;
    max-width: 200px;
  }

  .table-preview-cell {
    height: 12px;
    border-radius: 2px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
  }

  .table-preview-cell.header {
    background: var(--accent-blue);
    opacity: 0.5;
  }

  .table-preview-label {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .table-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .table-dialog-btn {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 500;
  }

  .table-dialog-btn:hover {
    background: var(--bg-primary);
  }

  .table-dialog-btn.primary {
    background: var(--accent-blue);
    color: #fff;
    border-color: var(--accent-blue);
  }

  .table-dialog-btn.primary:hover {
    opacity: 0.9;
  }
</style>
