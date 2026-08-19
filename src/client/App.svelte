<script lang="ts">
  import { onMount } from 'svelte';
  import { currentPath, entries, selectedFile, sidebarOpen, rootName, rootPath, activePage, showHiddenFiles, theme, sidebarFontSize, fontFamily, contentFontSize, lineHeight, contentMaxWidth, initFromUrl } from './stores/navigation';
  import { isEditing, content, originalContent, isDirty } from './stores/editor';
  import { fetchDirectory, saveFile, openExternal, getSettings, saveSettings as saveSettingsApi } from './services/api';
  import { isInputFocused } from './utils/keyboard';
  import { wsClient } from './services/websocket';
  import { comments, loadComments } from './stores/comments';
  import Sidebar from './components/Sidebar.svelte';
  import FileExplorer from './components/FileExplorer.svelte';
  import MarkdownPreview from './components/MarkdownPreview.svelte';
  import MarkdownEditor from './components/MarkdownEditor.svelte';
  import FilePreview from './components/FilePreview.svelte';
  import ShortcutsHelpModal from './components/ShortcutsHelpModal.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import PresentationMode from './components/PresentationMode.svelte';
  import ExportMenu from './components/ExportMenu.svelte';
  import CommentPane from './components/CommentPane.svelte';
  import Settings from './components/Settings.svelte';
  import Breadcrumb from './components/Breadcrumb.svelte';

  let shortcutsHelpOpen = $state(false);
  let isPresentationOpen = $state(false);
  let commandPaletteOpen = $state(false);
  let exportMenuOpen = $state(false);
  let saving = $state(false);
  let sidebarWidth = $state(280);
  let isResizing = $state(false);
  let commentPaneOpen = $state(false);
  let commentPaneWidth = $state(360);
  let splitView = $state(false);
  let markdownPreview: MarkdownPreview | undefined = $state();
  let aiHarness = $state<'claude' | 'codex' | 'opencode'>('claude');
  let aiModel = $state('');
  let aiAgent = $state('');
  let aiExecutablePath = $state('');
  let pendingComment = $state<{ sourceLine: number | null; sourceEndLine: number | null; selectionText: string } | null>(null);
  let activeCommentLine = $state<number | null>(null);
  let activeCommentId = $state<string | null>(null);
  let activeThreadId = $state<string | null>(null);
  let _autoOpenedForFile = $state<string | null>(null);

  $effect(() => {
    const file = $selectedFile;
    if (file && /\.(md|markdown)$/i.test(file)) loadComments(file);
  });

  $effect(() => {
    if ($selectedFile && $comments.length > 0 && _autoOpenedForFile !== $selectedFile) {
      _autoOpenedForFile = $selectedFile;
      commentPaneOpen = true;
    }
  });

  let commentAnnotations = $derived(
    $comments
      .filter(c => c.sourceLine !== null && !c.parentId)
      .map(c => ({ id: c.id, sourceLine: c.sourceLine!, sourceEndLine: c.sourceEndLine, selectionText: c.selectionText }))
  );

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

  let isMarkdownFile = $derived($selectedFile ? /\.(md|markdown)$/i.test($selectedFile) : false);
  const NON_EDITABLE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif', 'pdf', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'mp4', 'webm', 'ogv', 'mov'];
  let isEditableFile = $derived($selectedFile ? !NON_EDITABLE_EXTS.some(ext => $selectedFile!.toLowerCase().endsWith('.' + ext)) : false);

  let terminalApp = $state('Terminal');
  let editorApp = $state('');

  const fontFamilies: Record<string, string> = {
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    inter: "'Inter', sans-serif",
    'jetbrains-mono': "'JetBrains Mono', monospace",
    'fira-code': "'Fira Code', monospace",
    'source-sans': "'Source Sans 3', sans-serif",
    excalifont: "'Excalifont', cursive, sans-serif",
  };

  function applyAppearance() {
    const root = document.documentElement;
    root.style.setProperty('--font-family', fontFamilies[$fontFamily] || fontFamilies.system);
    root.style.setProperty('--font-size-content', `${$contentFontSize}px`);
    root.style.setProperty('--line-height-content', String($lineHeight));
    root.style.setProperty('--content-max-width', `${$contentMaxWidth}px`);
    root.className = $theme === 'one-dark' ? '' : `theme-${$theme}`;
  }

  function handleAddCommentFromPreview(sourceLine: number | null, sourceEndLine: number | null, selectionText: string) {
    commentPaneOpen = true;
    pendingComment = { sourceLine, sourceEndLine, selectionText };
  }

  function handleLineClick(commentId: string, sourceLine: number) {
    activeCommentId = null;
    activeCommentLine = null;
    setTimeout(() => { activeCommentId = commentId; activeCommentLine = sourceLine; }, 0);
  }

  function handleMarkClick(commentId: string) {
    activeThreadId = null;
    commentPaneOpen = true;
    setTimeout(() => { activeThreadId = commentId; }, 0);
  }

  function toggleComments() {
    if (!$selectedFile || !isMarkdownFile || $isEditing) return;
    commentPaneOpen = !commentPaneOpen;
  }

  function addCommentFromSelection() {
    if (!$selectedFile || !isMarkdownFile || $isEditing) return;
    markdownPreview?.addCommentFromSelection();
  }

  function toggleSplitView() {
    if (!$selectedFile || !isMarkdownFile) return;
    splitView = !splitView;
    if (splitView) $isEditing = false;
  }

  function handleOpenExternal(action: 'terminal' | 'finder' | 'editor') {
    const target = $selectedFile || $currentPath;
    const app = action === 'terminal' ? terminalApp : action === 'editor' ? editorApp : undefined;
    openExternal(target, action, app || undefined).catch(err => alert(`Failed to open: ${err}`));
  }

  let editorLabel = $derived(editorApp || 'Default App');
  function openSettings() {
    $activePage = 'settings';
    $selectedFile = null;
  }

  function closeSettings() {
    $activePage = null;
  }

  async function handleSaveSettings(settings: Record<string, unknown>) {
    terminalApp = (settings.terminalApp as string) || '';
    editorApp = (settings.editorApp as string) || '';
    aiHarness = (settings.aiHarness as typeof aiHarness) || 'claude';
    aiModel = (settings.aiModel as string) || '';
    aiAgent = (settings.aiAgent as string) || '';
    aiExecutablePath = (settings.aiExecutablePath as string) || '';
    const hiddenChanged = (settings.showHidden as boolean) !== $showHiddenFiles;
    closeSettings();
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

  onMount(() => {
    wsClient.connect();

    void (async () => {
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
      if (settings.aiHarness === 'claude' || settings.aiHarness === 'codex' || settings.aiHarness === 'opencode') {
        aiHarness = settings.aiHarness;
      }
      aiModel = (settings.aiModel as string) || '';
      aiAgent = (settings.aiAgent as string) || '';
      aiExecutablePath = (settings.aiExecutablePath as string) || (settings.claudeCliPath as string) || '';
      applyAppearance();

      const { dir } = initFromUrl();
      const listing = await fetchDirectory(dir, $showHiddenFiles);
      $currentPath = listing.path;
      $rootName = listing.rootName;
      $rootPath = listing.rootPath;
      $entries = listing.entries;
    })();

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

      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        toggleComments();
        return;
      }

      if (mod && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        addCommentFromSelection();
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        toggleSplitView();
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        commandPaletteOpen = !commandPaletteOpen;
        return;
      }

      if (mod && e.key === ',') {
        e.preventDefault();
        if ($activePage === 'settings') closeSettings();
        else openSettings();
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
        if ($activePage === 'settings') { closeSettings(); return; }
        if (commandPaletteOpen) { commandPaletteOpen = false; return; }
        if (shortcutsHelpOpen) { shortcutsHelpOpen = false; return; }
        if ($selectedFile) { $selectedFile = null; $isEditing = false; return; }
        return;
      }

      if (!$selectedFile && !$isEditing && !isInputFocused()
          && !commandPaletteOpen && !shortcutsHelpOpen && !$activePage && !isPresentationOpen && !exportMenuOpen) {
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
    <button class="btn-icon hamburger" onclick={() => $sidebarOpen = !$sidebarOpen} title="Toggle sidebar" aria-label="Toggle sidebar">
      <span class="hamburger-icon">☰</span>
    </button>
    {#if $selectedFile}
      <div class="topbar-file">
        <Breadcrumb />
        {#if $isEditing && $isDirty}
          <span class="dirty-indicator" title="Unsaved changes"></span>
        {/if}
      </div>
    {/if}
    <div class="topbar-spacer"></div>
    <div class="topbar-actions">
      {#if $selectedFile && $isEditing}
        <button class="topbar-action topbar-save-btn" onclick={handleSave} disabled={!$isDirty || saving} title="Save">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg><span>{saving ? 'Saving' : 'Save'}</span>
        </button>
        <button class="topbar-action" onclick={() => $isEditing = false} title="Preview">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span>Preview</span>
        </button>
      {:else if $selectedFile && isEditableFile}
        <button class="topbar-action" onclick={() => { splitView = false; $isEditing = true; }} title="Edit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg><span>Edit</span>
        </button>
      {/if}
      {#if $selectedFile && isMarkdownFile && !$isEditing}
        <button class="topbar-action" onclick={() => isPresentationOpen = true} title="Present (Cmd+Shift+Enter)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Present</span>
        </button>
        <button class="topbar-action" class:topbar-btn--active={splitView} onclick={toggleSplitView} title="Split edit and preview (Cmd+Shift+V)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></svg><span>Split</span>
        </button>
        <div class="topbar-sep"></div>
        <button class="topbar-action topbar-action--icon" class:topbar-btn--active={commentPaneOpen} onclick={toggleComments} title="Toggle comments (Cmd+Shift+C)" aria-label="Toggle comments">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>
        </button>
        <ExportMenu filePath={$selectedFile} bind:isOpen={exportMenuOpen} />
      {/if}
      {#if $currentPath}
        <span class="open-in-label">Open in</span>
        <button class="topbar-action topbar-action--icon" onclick={() => handleOpenExternal('terminal')} title="Open in {terminalApp}" aria-label="Open in {terminalApp}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
        </button>
        <button class="topbar-action topbar-action--icon" onclick={() => handleOpenExternal('finder')} title="Reveal in Finder" aria-label="Reveal in Finder">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z"/></svg>
        </button>
        {#if $selectedFile}
          <button class="topbar-action topbar-action--icon" onclick={() => handleOpenExternal('editor')} title="Open in {editorLabel}" aria-label="Open in {editorLabel}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
          </button>
        {/if}
      {/if}
      <div class="topbar-sep"></div>
      <button class="topbar-action topbar-action--icon" class:topbar-btn--active={$activePage === 'settings'} onclick={openSettings} title="Settings (Cmd+,)" aria-label="Settings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>
      </button>
    </div>
  </div>
  <div class="main">
    <div class="sidebar-panel" class:collapsed={!$sidebarOpen} style={$sidebarOpen ? `width: ${sidebarWidth}px; --sidebar-font-size: ${$sidebarFontSize}px;` : ''}>
      <Sidebar />
    </div>
    {#if $sidebarOpen}
      <div class="resize-handle" onmousedown={startResize} role="separator" aria-orientation="vertical" aria-label="Resize sidebar"></div>
    {/if}
    <div class="content" class:no-select={isResizing}>
      {#if $activePage === 'settings'}
        <Settings
          {terminalApp}
          {editorApp}
          {aiHarness}
          {aiModel}
          {aiAgent}
          {aiExecutablePath}
          onClose={closeSettings}
          onSave={handleSaveSettings}
        />
      {:else if $selectedFile && splitView && isMarkdownFile}
        <div class="split-view">
          <MarkdownEditor filePath={$selectedFile} />
          <MarkdownPreview filePath={$selectedFile} liveContent={$content} />
        </div>
      {:else if $selectedFile && $isEditing}
        <MarkdownEditor filePath={$selectedFile} />
      {:else if $selectedFile && isMarkdownFile}
        <div class="preview-with-comments">
          <MarkdownPreview
            bind:this={markdownPreview}
            filePath={$selectedFile}
            onAddComment={handleAddCommentFromPreview}
            onMarkClick={handleMarkClick}
            commentPaneOpen={commentPaneOpen}
            commentAnnotations={commentAnnotations}
            activeCommentLine={activeCommentLine}
            activeCommentId={activeCommentId}
          />
          <div
            class="comment-pane-transition"
            class:comment-pane-transition--open={commentPaneOpen}
            style={`--comment-pane-width: ${commentPaneWidth}px`}
            aria-hidden={!commentPaneOpen}
          >
            {#if commentPaneOpen}
              <CommentPane
                filePath={$selectedFile}
                bind:paneWidth={commentPaneWidth}
                pendingComment={pendingComment}
                onPendingCommentConsumed={() => { pendingComment = null; }}
                onLineClick={handleLineClick}
                activeThreadId={activeThreadId}
                {aiHarness}
                {aiModel}
                {aiAgent}
                {aiExecutablePath}
              />
            {/if}
          </div>
        </div>
      {:else if $selectedFile}
        <FilePreview filePath={$selectedFile} />
      {:else}
        <FileExplorer />
      {/if}
    </div>
  </div>
</div>

<ShortcutsHelpModal isOpen={shortcutsHelpOpen} onClose={() => shortcutsHelpOpen = false} />
<CommandPalette
  isOpen={commandPaletteOpen}
  onClose={() => commandPaletteOpen = false}
  onToggleSidebar={() => $sidebarOpen = !$sidebarOpen}
  onToggleComments={toggleComments}
  onOpenSettings={openSettings}
  onAddComment={addCommentFromSelection}
  onToggleSplitView={toggleSplitView}
/>

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
    flex-wrap: nowrap;
  }

  .topbar-action--icon {
    width: 30px;
    padding: 5px;
  }

  .open-in-label {
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 650;
    white-space: nowrap;
  }

  .topbar-action {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: var(--control-raised);
    color: color-mix(in srgb, var(--text-primary) 94%, white);
    border: 0;
    padding: 5px 10px;
    border-radius: 9px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 650;
    text-shadow: var(--text-shadow);
    transition: background 0.15s ease;
    box-shadow: var(--control-shadow);
  }

  .topbar-action svg { width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  .topbar-action:hover:not(:disabled) {
    background: var(--accent-blue);
    color: #fff;
  }

  .topbar-action:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .topbar-save-btn:not(:disabled) {
    background: var(--accent-blue);
    color: #fff;
  }

  .topbar-save-btn:not(:disabled):hover {
    opacity: 0.9;
  }

  .topbar-sep {
    width: 1px;
    height: 22px;
    flex-shrink: 0;
    margin: 0 3px;
    background: color-mix(in srgb, var(--border) 72%, transparent);
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

  .topbar-btn--active {
    background: var(--accent-blue);
    color: #fff;
  }

  .topbar-btn--active:hover:not(:disabled) {
    opacity: 0.88;
    background: var(--accent-blue);
    color: #fff;
  }

  .preview-with-comments {
    flex: 1;
    display: flex;
    overflow: visible;
    min-height: 0;
  }

  .split-view {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;
  }

  @media (max-width: 820px) {
    .split-view { grid-template-columns: 1fr; grid-template-rows: minmax(280px, 1fr) minmax(280px, 1fr); overflow-y: auto; }
    .topbar-file { display: none; }
    .topbar-action { padding-inline: 7px; }
  }

  .comment-pane-transition {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-shrink: 0;
    overflow: hidden;
    width: 0;
    margin-left: 0;
    opacity: 0;
    transform: translateX(18px);
    transition: width 240ms ease, margin-left 240ms ease, opacity 180ms ease, transform 240ms ease;
  }

  .comment-pane-transition--open {
    width: min(var(--comment-pane-width), 70vw);
    margin-left: 14px;
    opacity: 1;
    transform: translateX(0);
  }
</style>
