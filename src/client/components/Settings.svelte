<script lang="ts">
  import { onMount } from 'svelte';
  import { theme, sidebarFontSize, showHiddenFiles, fontFamily, contentFontSize, lineHeight, contentMaxWidth } from '../stores/navigation';
  import { getSettings, saveSettings as saveSettingsApi } from '../services/api';

  let { onClose, onSave }: { onClose: () => void; onSave: (settings: Record<string, unknown>) => Promise<void> } = $props();

  const fontFamilies: Record<string, string> = {
    'system': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    'inter': "'Inter', sans-serif",
    'jetbrains-mono': "'JetBrains Mono', monospace",
    'fira-code': "'Fira Code', monospace",
    'source-sans': "'Source Sans 3', sans-serif",
    'excalifont': "'Excalifont', cursive, sans-serif",
  };

  const fontFamilyLabels: Record<string, string> = {
    'system': 'System Default',
    'inter': 'Inter',
    'jetbrains-mono': 'JetBrains Mono',
    'fira-code': 'Fira Code',
    'source-sans': 'Source Sans 3',
    'excalifont': 'Excalifont',
  };

  const themeLabels: Record<string, string> = {
    'one-dark': 'One Dark',
    'tokyo-night': 'Tokyo Night',
    'catppuccin-mocha': 'Catppuccin Mocha',
    'github-dark': 'GitHub Dark',
    'github-light': 'GitHub Light',
  };

  let localTheme = $state($theme);
  let localFontFamily = $state($fontFamily);
  let localContentFontSize = $state($contentFontSize);
  let localLineHeight = $state($lineHeight);
  let localContentMaxWidth = $state($contentMaxWidth);
  let localSidebarFontSize = $state($sidebarFontSize);
  let localTerminalApp = $state('');
  let localEditorApp = $state('');
  let localShowHidden = $state($showHiddenFiles);

  onMount(async () => {
    const settings = await getSettings().catch(() => ({}));
    if (settings.terminalApp) localTerminalApp = settings.terminalApp as string;
    if (settings.editorApp) localEditorApp = settings.editorApp as string;
  });

  function applySettings() {
    const root = document.documentElement;
    root.style.setProperty('--font-family', fontFamilies[localFontFamily] || fontFamilies.system);
    root.style.setProperty('--font-size-content', `${localContentFontSize}px`);
    root.style.setProperty('--line-height-content', String(localLineHeight));
    root.style.setProperty('--content-max-width', `${localContentMaxWidth}px`);
    root.className = localTheme === 'one-dark' ? '' : `theme-${localTheme}`;
  }

  $effect(() => {
    applySettings();
  });

  function resetAppearanceDefaults() {
    localTheme = 'one-dark';
    localFontFamily = 'system';
    localContentFontSize = 15;
    localLineHeight = 1.7;
    localContentMaxWidth = 900;
  }

  async function handleSave() {
    $theme = localTheme;
    $fontFamily = localFontFamily;
    $contentFontSize = localContentFontSize;
    $lineHeight = localLineHeight;
    $contentMaxWidth = localContentMaxWidth;
    $sidebarFontSize = localSidebarFontSize;
    $showHiddenFiles = localShowHidden;

    localStorage.setItem('mb-theme', localTheme);
    localStorage.setItem('mb-font-family', localFontFamily);
    localStorage.setItem('mb-content-font-size', String(localContentFontSize));
    localStorage.setItem('mb-line-height', String(localLineHeight));
    localStorage.setItem('mb-content-max-width', String(localContentMaxWidth));
    localStorage.setItem('mb-sidebar-font-size', String(localSidebarFontSize));

    applySettings();

    await onSave({
      terminalApp: localTerminalApp.trim(),
      editorApp: localEditorApp.trim(),
      showHidden: localShowHidden,
      theme: localTheme,
      sidebarFontSize: localSidebarFontSize,
      fontFamily: localFontFamily,
      contentFontSize: localContentFontSize,
      lineHeight: localLineHeight,
      contentMaxWidth: localContentMaxWidth,
    });
  }

  function handleCancel() {
    const root = document.documentElement;
    root.style.setProperty('--font-family', fontFamilies[$fontFamily] || fontFamilies.system);
    root.style.setProperty('--font-size-content', `${$contentFontSize}px`);
    root.style.setProperty('--line-height-content', String($lineHeight));
    root.style.setProperty('--content-max-width', `${$contentMaxWidth}px`);
    root.className = $theme === 'one-dark' ? '' : `theme-${$theme}`;
    onClose();
  }
</script>

<div class="settings-page">
  <div class="settings-header">
    <h2 class="settings-title">Settings</h2>
    <div class="settings-header-actions">
      <button class="settings-btn" onclick={handleCancel}>Cancel</button>
      <button class="settings-btn settings-btn-primary" onclick={handleSave}>Save</button>
    </div>
  </div>

  <div class="settings-sections">
    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">Appearance</h3>
        <button class="settings-btn settings-btn-small" onclick={resetAppearanceDefaults}>Reset to Defaults</button>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-theme">Theme</label>
        </div>
        <div class="setting-control">
          <select id="s-theme" class="setting-select" bind:value={localTheme}>
            {#each Object.entries(themeLabels) as [value, label]}
              <option {value}>{label}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-font">Font Family</label>
        </div>
        <div class="setting-control">
          <select id="s-font" class="setting-select" bind:value={localFontFamily}>
            {#each Object.entries(fontFamilyLabels) as [value, label]}
              <option {value}>{label}</option>
            {/each}
          </select>
          <span class="font-preview" style="font-family: {fontFamilies[localFontFamily] || fontFamilies.system}">
            The quick brown fox jumps over the lazy dog
          </span>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-fontsize">Content Font Size</label>
          <span class="setting-value">{localContentFontSize}px</span>
        </div>
        <div class="setting-control">
          <input id="s-fontsize" type="range" class="setting-slider" min="12" max="20" step="1" bind:value={localContentFontSize} />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-lineheight">Line Height</label>
          <span class="setting-value">{localLineHeight.toFixed(1)}</span>
        </div>
        <div class="setting-control">
          <input id="s-lineheight" type="range" class="setting-slider" min="1.2" max="2.0" step="0.1" bind:value={localLineHeight} />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-maxwidth">Content Max Width</label>
          <span class="setting-value">{localContentMaxWidth}px</span>
        </div>
        <div class="setting-control">
          <input id="s-maxwidth" type="range" class="setting-slider" min="600" max="1200" step="50" bind:value={localContentMaxWidth} />
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">Sidebar</h3>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-sidebar-fontsize">Sidebar Font Size</label>
          <span class="setting-value">{localSidebarFontSize}px</span>
        </div>
        <div class="setting-control">
          <input id="s-sidebar-fontsize" type="range" class="setting-slider" min="12" max="18" step="1" bind:value={localSidebarFontSize} />
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">External Apps</h3>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-terminal">Terminal Application</label>
          <span class="setting-hint">e.g. Terminal, iTerm, Warp, Alacritty</span>
        </div>
        <div class="setting-control">
          <input id="s-terminal" type="text" class="setting-input" bind:value={localTerminalApp} placeholder="Terminal" />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-editor">External Editor</label>
          <span class="setting-hint">e.g. Visual Studio Code, Sublime Text, Zed</span>
        </div>
        <div class="setting-control">
          <input id="s-editor" type="text" class="setting-input" bind:value={localEditorApp} placeholder="System default" />
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">Files</h3>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-hidden">Show Hidden Files</label>
          <span class="setting-hint">Show files and folders starting with a dot (e.g. .gitignore, .env)</span>
        </div>
        <div class="setting-control">
          <label class="toggle-switch">
            <input id="s-hidden" type="checkbox" bind:checked={localShowHidden} />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .settings-page {
    height: 100%;
    overflow-y: auto;
    padding: 32px 40px;
    max-width: 720px;
    margin: 0 auto;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }

  .settings-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .settings-header-actions {
    display: flex;
    gap: 8px;
  }

  .settings-btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
    background: var(--bg-tertiary);
    color: var(--text-primary);
    transition: background 0.15s, border-color 0.15s;
  }

  .settings-btn:hover {
    background: var(--bg-secondary);
  }

  .settings-btn-primary {
    background: var(--accent-blue);
    color: #fff;
    border-color: var(--accent-blue);
  }

  .settings-btn-primary:hover {
    opacity: 0.9;
    background: var(--accent-blue);
  }

  .settings-btn-small {
    padding: 4px 10px;
    font-size: 12px;
  }

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .settings-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px 24px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-heading);
    margin: 0;
  }

  .setting-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 12px 0;
    border-top: 1px solid var(--border);
    gap: 24px;
  }

  .setting-row:first-of-type {
    border-top: none;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 180px;
  }

  .setting-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .setting-value {
    font-size: 12px;
    color: var(--accent-blue);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .setting-hint {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .setting-control {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 300px;
  }

  .setting-select {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
  }

  .setting-select:focus {
    border-color: var(--accent-blue);
    outline: none;
  }

  .setting-input {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    box-sizing: border-box;
  }

  .setting-input:focus {
    border-color: var(--accent-blue);
    outline: none;
  }

  .setting-slider {
    width: 100%;
    accent-color: var(--accent-blue);
    cursor: pointer;
  }

  .font-preview {
    font-size: 13px;
    color: var(--text-secondary);
    padding: 8px 0 0;
    line-height: 1.5;
  }

  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
    cursor: pointer;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-track {
    position: absolute;
    inset: 0;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 11px;
    transition: background 0.2s;
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: var(--text-secondary);
    border-radius: 50%;
    transition: transform 0.2s, background 0.2s;
  }

  .toggle-switch input:checked + .toggle-track {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
  }

  .toggle-switch input:checked + .toggle-track::after {
    transform: translateX(18px);
    background: #fff;
  }
</style>
