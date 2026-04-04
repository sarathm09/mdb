<script lang="ts">
  import { SHORTCUTS, type ShortcutInfo } from '../utils/keyboard';

  let { isOpen, onClose }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  const categories = ['General', 'Editor', 'Explorer'] as const;

  function getShortcutsByCategory(category: string): ShortcutInfo[] {
    return SHORTCUTS.filter(s => s.category === category);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      onClose();
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown} role="dialog" aria-modal="true">
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">Keyboard Shortcuts</h3>
        <button class="close-btn" onclick={onClose}>&times;</button>
      </div>
      <div class="modal-body">
        {#each categories as category}
          <div class="shortcut-section">
            <h4 class="section-title">{category}</h4>
            <div class="shortcut-list">
              {#each getShortcutsByCategory(category) as shortcut}
                <div class="shortcut-row">
                  <span class="shortcut-keys">
                    {#each shortcut.keys.split('+') as part, i}
                      {#if i > 0}<span class="key-sep">+</span>{/if}
                      <kbd class="key">{part.trim()}</kbd>
                    {/each}
                  </span>
                  <span class="shortcut-desc">{shortcut.description}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 520px;
    max-width: 90vw;
    max-height: 80vh;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--border);
  }

  .modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: 16px 24px 24px;
    overflow-y: auto;
  }

  .shortcut-section {
    margin-bottom: 20px;
  }

  .shortcut-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 10px 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
  }

  .shortcut-keys {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .key {
    display: inline-block;
    padding: 3px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    color: var(--text-primary);
    min-width: 20px;
    text-align: center;
  }

  .key-sep {
    color: var(--text-secondary);
    font-size: 11px;
    margin: 0 1px;
  }

  .shortcut-desc {
    color: var(--text-secondary);
    font-size: 13px;
  }
</style>
