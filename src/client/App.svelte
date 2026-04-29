<script lang="ts">
  import { onMount } from 'svelte';
  import { currentPath, entries, selectedFile, sidebarOpen, showHiddenFiles, theme, sidebarFontSize, fontFamily, contentFontSize, lineHeight, contentMaxWidth, initFromUrl } from './stores/navigation';
  import { isEditing, content, originalContent, isDirty } from './stores/editor';
  import { fetchDirectory, saveFile, openExternal, getSettings, saveSettings as saveSettingsApi } from './services/api';
  import { isInputFocused } from './utils/keyboard';
  import Sidebar from './components/Sidebar.svelte';
  import FileExplorer from './components/FileExplorer.svelte';
  import MarkdownPreview from './components/MarkdownPreview.svelte';
  import MarkdownEditor from './components/MarkdownEditor.svelte';
  import FilePreview from './components/FilePreview.svelte';
  import ShortcutsHelpModal from './components/ShortcutsHelpModal.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import PresentationMode from './components/PresentationMode.svelte';
  import ExportMenu from './components/ExportMenu.svelte';
  import Settings from './components/Settings.svelte';

  let shortcutsHelpOpen = $state(false);
  let isPresentationOpen = $state(false);
  let commandPaletteOpen = $state(false);
  let exportMenuOpen = $state(false);
  let saving = $state(false);
  let sidebarWidth = $state(280);
  let isResizing = $state(false);

  function startResize(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(600, ev.clientX));
      sidebarWidth = newWidth;
    };
    const onMouseUp = () => {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  let fileName = $derived($selectedFile ? ($selectedFile.split('/').pop() || $selectedFile) : '');

  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
  let isMarkdownFile = $derived($selectedFile ? /\.(md|markdown)$/i.test($selectedFile) : false);
  let isEditableFile = $derived($selectedFile ? !IMAGE_EXTS.some(ext => $selectedFile!.toLowerCase().endsWith('.' + ext)) : false);

  let terminalApp = $state('Terminal');
  let editorApp = $state('');

  function handleOpenExternal(action: 'terminal' | 'finder' | 'editor') {
    const target = $selectedFile || $currentPath;
    const app = action === 'terminal' ? terminalApp : action === 'editor' ? editorApp : undefined;
    openExternal(target, action, app || undefined).catch(err => alert(`Failed to open: ${err}`));
  }

  let editorLabel = $derived(editorApp || 'Default App');
  let showSettingsPage = $state(false);

  const fontFamiliesMap: Record<string, string> = {
    'system': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    'inter': "'Inter', sans-serif",
    'jetbrains-mono': "'JetBrains Mono', monospace",
    'fira-code': "'Fira Code', monospace",
    'source-sans': "'Source Sans 3', sans-serif",
    'excalifont': "'Excalifont', cursive, sans-serif",
  };

  function applyFontSettings() {
    const root = document.documentElement;
    const storedFont = localStorage.getItem('mb-font-family') || 'system';
    root.style.setProperty('--font-family', fontFamiliesMap[storedFont] || fontFamiliesMap.system);
    root.style.setProperty('--font-size-content', `${localStorage.getItem('mb-content-font-size') || '15'}px`);
    root.style.setProperty('--line-height-content', localStorage.getItem('mb-line-height') || '1.7');
    root.style.setProperty('--content-max-width', `${localStorage.getItem('mb-content-max-width') || '900'}px`);
  }

  function openSettings() {
    showSettingsPage = true;
  }

  async function handleSaveSettings(settings: Record<string, unknown>) {
    terminalApp = (settings.terminalApp as string) || '';
    editorApp = (settings.editorApp as string) || '';
    const hiddenChanged = (settings.showHidden as boolean) !== $showHiddenFiles;
    showSettingsPage = false;
    await saveSettingsApi(settings).catch(() => {});
    if (hiddenChanged) {
      const listing = await fetchDirectory($currentPath, $showHiddenFiles);
      $entries = listing.entries;
    }
  }

  async function handleSave() {
    if (!$selectedFile) return;
    saving = true;
    try {
      await saveFile($selectedFile, $content);
      $originalContent = $content;
    } catch (err) {
      alert(`Failed to save: ${err}`);
    }
    saving = false;
  }

  onMount(async () => {
    const settings = await getSettings().catch(() => ({}));
    if (settings.terminalApp) terminalApp = settings.terminalApp as string;
    if (settings.editorApp) editorApp = settings.editorApp as string;
    if (typeof settings.showHidden === 'boolean') $showHiddenFiles = settings.showHidden;
    if (settings.theme) {
      $theme = settings.theme as string;
      localStorage.setItem('mb-theme', $theme);
    }
    if (typeof settings.sidebarFontSize === 'number') {
      $sidebarFontSize = settings.sidebarFontSize as number;
      localStorage.setItem('mb-sidebar-font-size', String($sidebarFontSize));
    }
    if (settings.fontFamily) {
      $fontFamily = settings.fontFamily as string;
      localStorage.setItem('mb-font-family', $fontFamily);
    }
    if (typeof settings.contentFontSize === 'number') {
      $contentFontSize = settings.contentFontSize as number;
      localStorage.setItem('mb-content-font-size', String($contentFontSize));
    }
    if (typeof settings.lineHeight === 'number') {
      $lineHeight = settings.lineHeight as number;
      localStorage.setItem('mb-line-height', String($lineHeight));
    }
    if (typeof settings.contentMaxWidth === 'number') {
      $contentMaxWidth = settings.contentMaxWidth as number;
      localStorage.setItem('mb-content-max-width', String($contentMaxWidth));
    }
    document.documentElement.className = $theme === 'one-dark' ? '' : `theme-${$theme}`;
    applyFontSettings();

    const { dir } = initFromUrl();
    const listing = await fetchDirectory(dir, $showHiddenFiles);
    $currentPath = listing.path;
    $entries = listing.entries;

    function handleGlobalKeydown(e: KeyboardEvent) {
      if (isPresentationOpen) return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if ($selectedFile && isMarkdownFile && !$isEditing) {
          isPresentationOpen = true;
        }
        return;
      }

      if (mod && e.key === 'd') {
        e.preventDefault();
        $sidebarOpen = !$sidebarOpen;
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        commandPaletteOpen = !commandPaletteOpen;
        return;
      }

      if (mod && e.key === ',') {
        e.preventDefault();
        showSettingsPage = !showSettingsPage;
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if ($selectedFile && isMarkdownFile && !$isEditing) {
          exportMenuOpen = !exportMenuOpen;
        }
        return;
      }

      if (e.key === 'Escape') {
        if (showSettingsPage) { showSettingsPage = false; return; }
        if (commandPaletteOpen) { commandPaletteOpen = false; return; }
        if (shortcutsHelpOpen) { shortcutsHelpOpen = false; return; }
        if ($selectedFile) { $selectedFile = null; $isEditing = false; return; }
        return;
      }

      if (!$selectedFile && !$isEditing && !isInputFocused()
          && !commandPaletteOpen && !shortcutsHelpOpen && !showSettingsPage && !isPresentationOpen && !exportMenuOpen) {
        const vimKeys = ['j', 'k', 'l', 'h', 'g', 'G', 'ArrowDown', 'ArrowUp', 'Enter', 'Backspace'];
        if (vimKeys.includes(e.key)) {
          const explorerEl = document.querySelector('.file-explorer') as HTMLElement;
          if (explorerEl && document.activeElement !== explorerEl) {
            explorerEl.focus();
            explorerEl.dispatchEvent(new KeyboardEvent('keydown', {
              key: e.key,
              code: e.code,
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              bubbles: true,
            }));
            e.preventDefault();
            return;
          }
        }
      }

      if (e.key === '?' && !isInputFocused()) {
        shortcutsHelpOpen = !shortcutsHelpOpen;
        return;
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  });
</script>

<div class="app">
  <div class="topbar">
    <button class="btn-icon hamburger" onclick={() => $sidebarOpen = !$sidebarOpen} title="Toggle sidebar">
      <span class="hamburger-icon">☰</span>
    </button>
    {#if $selectedFile}
      <div class="topbar-file">
        <span class="topbar-filename">{fileName}</span>
        {#if $isEditing && $isDirty}
          <span class="dirty-indicator" title="Unsaved changes"></span>
        {/if}
      </div>
    {/if}
    <div class="topbar-spacer"></div>
    <div class="topbar-actions">
      {#if $selectedFile && $isEditing}
        <button
          class="topbar-btn topbar-save-btn"
          onclick={handleSave}
          disabled={!$isDirty || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button class="topbar-btn" onclick={() => $isEditing = false}>
          Preview
        </button>
      {:else if $selectedFile && isEditableFile}
        <button class="topbar-btn" onclick={() => $isEditing = true}>
          Edit
        </button>
      {/if}
      {#if $selectedFile && isMarkdownFile && !$isEditing}
        <button class="topbar-btn" onclick={() => isPresentationOpen = true} title="Present (Cmd+Shift+Enter)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>Present
        </button>
        <ExportMenu filePath={$selectedFile} bind:isOpen={exportMenuOpen} />
      {/if}
      {#if $selectedFile || $currentPath}
        <div class="topbar-sep"></div>
        <button class="topbar-btn-icon" onclick={() => handleOpenExternal('finder')} title="Reveal in Finder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button class="topbar-btn-icon" onclick={() => handleOpenExternal('terminal')} title="Open in {terminalApp}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
        </button>
        {#if $selectedFile}
          <button class="topbar-btn-icon" onclick={() => handleOpenExternal('editor')} title="Open in {editorLabel}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        {/if}
      {/if}
      <div class="topbar-sep"></div>
      <button class="topbar-btn-icon" onclick={openSettings} title="Settings">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>
  </div>
  <div class="main">
    <div class="sidebar-panel" class:collapsed={!$sidebarOpen} style={$sidebarOpen ? `width: ${sidebarWidth}px; --sidebar-font-size: ${$sidebarFontSize}px;` : ''}>
      <Sidebar />
    </div>
    {#if $sidebarOpen}
      <div class="resize-handle" onmousedown={startResize} role="separator" aria-orientation="vertical"></div>
    {/if}
    <div class="content" class:no-select={isResizing}>
      {#if showSettingsPage}
        <Settings onClose={() => showSettingsPage = false} onSave={handleSaveSettings} />
      {:else if $selectedFile && $isEditing}
        <MarkdownEditor filePath={$selectedFile} />
      {:else if $selectedFile && isMarkdownFile}
        <MarkdownPreview filePath={$selectedFile} />
      {:else if $selectedFile}
        <FilePreview filePath={$selectedFile} />
      {:else}
        <FileExplorer />
      {/if}
    </div>
  </div>
</div>

<ShortcutsHelpModal isOpen={shortcutsHelpOpen} onClose={() => shortcutsHelpOpen = false} />
<CommandPalette isOpen={commandPaletteOpen} onClose={() => commandPaletteOpen = false} />

{#if $selectedFile}
  <PresentationMode isOpen={isPresentationOpen} filePath={$selectedFile} onClose={() => isPresentationOpen = false} />
{/if}


<style>
  .hamburger {
    font-size: 20px;
    padding: 4px 8px;
    margin-right: 8px;
  }
  .hamburger-icon {
    line-height: 1;
  }

  .topbar-spacer {
    flex: 1;
  }

  .topbar-file {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
  }

  .topbar-filename {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .dirty-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-orange, #e5a00d);
    display: inline-block;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .topbar-btn {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s ease;
  }

  .topbar-btn:hover:not(:disabled) {
    background: var(--accent-blue);
    color: #fff;
    border-color: var(--accent-blue);
  }

  .topbar-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .topbar-save-btn:not(:disabled) {
    background: var(--accent-blue);
    color: #fff;
    border-color: var(--accent-blue);
  }

  .topbar-save-btn:not(:disabled):hover {
    opacity: 0.9;
  }

  .topbar-sep {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 4px;
  }

  .topbar-btn-icon {
    background: transparent;
    color: var(--text-secondary);
    border: none;
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;
  }

  .topbar-btn-icon:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .resize-handle {
    width: 4px;
    cursor: col-resize;
    background: transparent;
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .resize-handle:hover,
  .resize-handle:active {
    background: var(--accent-blue);
  }

  .no-select {
    user-select: none;
    pointer-events: none;
  }
</style>
