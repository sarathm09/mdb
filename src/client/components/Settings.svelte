<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchApplications } from '../services/api';
  import {
    contentFontSize,
    contentMaxWidth,
    fontFamily,
    lineHeight,
    showHiddenFiles,
    sidebarFontSize,
    theme,
  } from '../stores/navigation';

  let {
    terminalApp,
    editorApp,
    aiHarness,
    aiModel,
    aiAgent,
    aiExecutablePath,
    onClose,
    onSave,
  }: {
    terminalApp: string;
    editorApp: string;
    aiHarness: 'claude' | 'codex' | 'opencode';
    aiModel: string;
    aiAgent: string;
    aiExecutablePath: string;
    onClose: () => void;
    onSave: (settings: Record<string, unknown>) => Promise<void>;
  } = $props();

  const fontFamilies: Record<string, string> = {
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    inter: "'Inter', sans-serif",
    'jetbrains-mono': "'JetBrains Mono', monospace",
    'fira-code': "'Fira Code', monospace",
    'source-sans': "'Source Sans 3', sans-serif",
    excalifont: "'Excalifont', cursive, sans-serif",
  };

  const fontFamilyLabels: Record<string, string> = {
    system: 'System Default',
    inter: 'Inter',
    'jetbrains-mono': 'JetBrains Mono',
    'fira-code': 'Fira Code',
    'source-sans': 'Source Sans 3',
    excalifont: 'Excalifont',
  };

  const themeLabels: Record<string, string> = {
    'one-dark': 'Graphite',
    'tokyo-night': 'Midnight Blue',
    'catppuccin-mocha': 'Deep Mocha',
    'github-dark': 'Near Black',
    'github-light': 'Soft Daylight',
  };

  let localTheme = $state($theme);
  let localFontFamily = $state($fontFamily);
  let localContentFontSize = $state($contentFontSize);
  let localLineHeight = $state($lineHeight);
  let localContentMaxWidth = $state($contentMaxWidth);
  let localSidebarFontSize = $state($sidebarFontSize);
  let localTerminalApp = $state(terminalApp);
  let localEditorApp = $state(editorApp);
  let localAIHarness = $state(aiHarness);
  let localAIModel = $state(aiModel);
  let localAIAgent = $state(aiAgent);
  let localAIExecutablePath = $state(aiExecutablePath);
  let localShowHidden = $state($showHiddenFiles);
  let terminalApplications = $state<string[]>([]);

  onMount(async () => {
    const discovered = await fetchApplications('terminal').catch(() => []);
    terminalApplications = Array.from(new Set([localTerminalApp, ...discovered].filter(Boolean)));
    if (!localTerminalApp && discovered.length > 0) localTerminalApp = discovered[0];
  });

  function applyAppearance(
    nextTheme: string,
    nextFontFamily: string,
    nextContentFontSize: number,
    nextLineHeight: number,
    nextContentMaxWidth: number,
  ) {
    const root = document.documentElement;
    root.style.setProperty('--font-family', fontFamilies[nextFontFamily] || fontFamilies.system);
    root.style.setProperty('--font-size-content', `${nextContentFontSize}px`);
    root.style.setProperty('--line-height-content', String(nextLineHeight));
    root.style.setProperty('--content-max-width', `${nextContentMaxWidth}px`);
    root.className = nextTheme === 'one-dark' ? '' : `theme-${nextTheme}`;
  }

  $effect(() => {
    applyAppearance(localTheme, localFontFamily, localContentFontSize, localLineHeight, localContentMaxWidth);
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
    localStorage.setItem('mb-show-hidden', String(localShowHidden));

    await onSave({
      terminalApp: localTerminalApp.trim(),
      editorApp: localEditorApp.trim(),
      aiHarness: localAIHarness,
      aiModel: localAIModel.trim(),
      aiAgent: localAIAgent.trim(),
      aiExecutablePath: localAIExecutablePath.trim(),
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
    applyAppearance($theme, $fontFamily, $contentFontSize, $lineHeight, $contentMaxWidth);
    onClose();
  }
</script>

<div class="settings-page">
  <div class="settings-card">
    <div class="settings-header">
      <div>
        <h2 class="settings-title">Settings</h2>
        <p class="settings-subtitle">Tune workspace appearance, integrations, and review workflow.</p>
      </div>
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
        <div class="setting-info"><label class="setting-label" for="s-theme">Theme</label></div>
        <div class="setting-control">
          <select id="s-theme" class="setting-select" bind:value={localTheme}>
            {#each Object.entries(themeLabels) as [value, label]}
              <option {value}>{label}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info"><label class="setting-label" for="s-font">Font Family</label></div>
        <div class="setting-control">
          <select id="s-font" class="setting-select" bind:value={localFontFamily}>
            {#each Object.entries(fontFamilyLabels) as [value, label]}
              <option {value}>{label}</option>
            {/each}
          </select>
          <span class="font-preview" style="font-family: {fontFamilies[localFontFamily] || fontFamilies.system}">The quick brown fox jumps over the lazy dog</span>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-fontsize">Content Font Size</label>
          <span class="setting-value">{localContentFontSize}px</span>
        </div>
        <div class="setting-control"><input id="s-fontsize" type="range" class="setting-slider" min="12" max="20" step="1" bind:value={localContentFontSize} /></div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-lineheight">Line Height</label>
          <span class="setting-value">{localLineHeight.toFixed(1)}</span>
        </div>
        <div class="setting-control"><input id="s-lineheight" type="range" class="setting-slider" min="1.2" max="2.0" step="0.1" bind:value={localLineHeight} /></div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-maxwidth">Content Max Width</label>
          <span class="setting-value">{localContentMaxWidth}px</span>
        </div>
        <div class="setting-control"><input id="s-maxwidth" type="range" class="setting-slider" min="600" max="1200" step="50" bind:value={localContentMaxWidth} /></div>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-sidebar-fontsize">Explorer Font Size</label>
          <span class="setting-value">{localSidebarFontSize}px</span>
        </div>
        <div class="setting-control"><input id="s-sidebar-fontsize" type="range" class="setting-slider" min="12" max="18" step="1" bind:value={localSidebarFontSize} /></div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header"><h3 class="section-title">External Apps</h3></div>
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-terminal">Terminal Application</label>
          <span class="setting-hint">e.g. Terminal, iTerm, Warp, Alacritty</span>
        </div>
        <div class="setting-control">
          <select id="s-terminal" class="setting-select" bind:value={localTerminalApp}>
            {#if terminalApplications.length === 0}<option value="">System default</option>{/if}
            {#each terminalApplications as application}<option value={application}>{application}</option>{/each}
          </select>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-editor">External Editor</label>
          <span class="setting-hint">e.g. Visual Studio Code, Sublime Text, Zed</span>
        </div>
        <div class="setting-control"><input id="s-editor" type="text" class="setting-input" bind:value={localEditorApp} placeholder="System default" /></div>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-hidden">Show Hidden Files</label>
          <span class="setting-hint">Include dotfiles and hidden folders</span>
        </div>
        <div class="setting-control setting-control-toggle"><input id="s-hidden" type="checkbox" class="setting-checkbox" bind:checked={localShowHidden} /></div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header"><h3 class="section-title">AI Review</h3></div>
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-ai-harness">Harness</label>
          <span class="setting-hint">CLI used to review and revise file</span>
        </div>
        <div class="setting-control">
          <select id="s-ai-harness" class="setting-select" bind:value={localAIHarness}>
            <option value="claude">Claude Code</option>
            <option value="codex">Codex CLI</option>
            <option value="opencode">OpenCode</option>
          </select>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-ai-model">Model</label>
          <span class="setting-hint">Blank uses harness default</span>
        </div>
        <div class="setting-control"><input id="s-ai-model" type="text" class="setting-input" bind:value={localAIModel} placeholder={localAIHarness === 'opencode' ? 'provider/model' : 'Harness default'} /></div>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-ai-agent">Agent or Profile</label>
          <span class="setting-hint">Claude/OpenCode agent, or Codex profile</span>
        </div>
        <div class="setting-control"><input id="s-ai-agent" type="text" class="setting-input" bind:value={localAIAgent} placeholder="Optional" /></div>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="s-ai-executable">Executable Path</label>
          <span class="setting-hint">Blank uses harness name from PATH</span>
        </div>
        <div class="setting-control"><input id="s-ai-executable" type="text" class="setting-input" bind:value={localAIExecutablePath} placeholder={localAIHarness} /></div>
      </div>
    </section>

    </div>
  </div>
</div>

<style>
  .settings-page {
    height: 100%;
    min-height: 0;
    width: 100%;
    display: flex;
  }

  .settings-card {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    padding: clamp(22px, 3vw, 42px);
    border-radius: 18px;
    background: var(--surface-raised);
    box-shadow: var(--surface-shadow);
    backdrop-filter: blur(16px);
  }

  .settings-header,
  .section-header,
  .setting-row {
    display: flex;
    justify-content: space-between;
  }

  .settings-header,
  .section-header {
    align-items: center;
  }

  .settings-header { gap: 24px; margin-bottom: 30px; }
  .settings-title { margin: 0; color: var(--text-primary); font-size: clamp(24px, 3vw, 34px); }
  .settings-subtitle { max-width: 560px; margin: 5px 0 0; color: var(--text-secondary); font-size: 13px; line-height: 1.5; }
  .settings-header-actions { display: flex; gap: 8px; }
  .settings-sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 330px), 1fr)); gap: 30px clamp(28px, 4vw, 54px); align-items: start; }

  .settings-section {
    min-width: 0;
  }

  .section-header { margin-bottom: 16px; }
  .section-title { margin: 0; color: var(--text-heading); font-size: 16px; }

  .setting-row {
    align-items: flex-start;
    gap: 24px;
    padding: 12px 0;
    border-top: 1px solid color-mix(in srgb, var(--border) 58%, transparent);
  }

  .setting-info { display: flex; flex-direction: column; gap: 2px; min-width: 140px; }
  .setting-label { color: var(--text-primary); font-size: 14px; font-weight: 500; }
  .setting-value { color: var(--accent-blue); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .setting-hint, .font-preview { color: var(--text-secondary); font-size: 12px; }

  .setting-control {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .setting-control-toggle { align-items: flex-end; }
  .setting-select, .setting-input {
    width: 100%;
    padding: 8px 12px;
    background: var(--control-raised);
    border: 0;
    border-radius: 10px;
    color: var(--text-primary);
    font-size: 14px;
  }

  .setting-slider { width: 100%; accent-color: var(--accent-blue); cursor: pointer; }
  .setting-checkbox { width: 18px; height: 18px; accent-color: var(--accent-blue); cursor: pointer; }
  .font-preview { padding-top: 4px; line-height: 1.5; }

  .settings-btn {
    padding: 8px 16px;
    border: 0;
    border-radius: 10px;
    background: var(--control-raised);
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    box-shadow: var(--control-shadow);
  }

  .settings-btn:hover { background: var(--surface-raised-hover); }
  .settings-btn-primary { background: var(--accent-blue); border-color: var(--accent-blue); color: #fff; }
  .settings-btn-primary:hover { background: var(--accent-blue); opacity: 0.9; }
  .settings-btn-small { padding: 4px 10px; font-size: 12px; }

  @media (max-width: 700px) {
    .settings-card { padding: 20px; border-radius: 14px; }
    .settings-header { align-items: flex-start; flex-direction: column; }
    .settings-header-actions { width: 100%; }
    .settings-header-actions .settings-btn { flex: 1; }
    .setting-row { flex-direction: column; gap: 10px; }
    .setting-control { max-width: none; width: 100%; }
    .setting-control-toggle { align-items: flex-start; }
  }
</style>
