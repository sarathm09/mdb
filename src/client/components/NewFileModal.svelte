<script lang="ts">
  import { currentPath } from '../stores/navigation';
  import { createFile } from '../services/api';

  let { isOpen, onClose, onCreated }: {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (path: string) => void;
  } = $props();

  let filename = $state('');
  let error = $state('');
  let creating = $state(false);
  let inputEl: HTMLInputElement | undefined = $state();

  let displayName = $derived.by(() => {
    const name = filename.trim();
    if (!name) return '';
    return name.endsWith('.md') ? name : `${name}.md`;
  });

  $effect(() => {
    if (isOpen) {
      filename = '';
      error = '';
      creating = false;
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  async function handleSubmit() {
    const name = displayName;
    if (!name) {
      error = 'Please enter a filename';
      return;
    }

    creating = true;
    error = '';

    try {
      const newPath = await createFile($currentPath, name);
      onCreated(newPath);
    } catch (err) {
      error = `Failed to create file: ${err}`;
    }

    creating = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
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
      <h3 class="modal-title">Create New File</h3>

      <div class="input-group">
        <label class="input-label" for="filename-input">Filename</label>
        <input
          id="filename-input"
          bind:this={inputEl}
          bind:value={filename}
          class="input-field"
          type="text"
          placeholder="my-document"
          disabled={creating}
        />
        {#if filename.trim() && !filename.trim().endsWith('.md')}
          <span class="input-hint">.md will be appended automatically</span>
        {/if}
      </div>

      {#if error}
        <p class="error-message">{error}</p>
      {/if}

      <div class="modal-actions">
        <button class="btn btn-cancel" onclick={onClose} disabled={creating}>
          Cancel
        </button>
        <button class="btn btn-create" onclick={handleSubmit} disabled={creating || !filename.trim()}>
          {creating ? 'Creating...' : 'Create'}
        </button>
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
    padding: 24px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal-title {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .input-group {
    margin-bottom: 16px;
  }

  .input-label {
    display: block;
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .input-field {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }

  .input-field:focus {
    border-color: var(--accent-blue);
  }

  .input-hint {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .error-message {
    color: var(--accent-red);
    font-size: 13px;
    margin: 0 0 12px 0;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .btn-cancel {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-cancel:hover:not(:disabled) {
    opacity: 0.8;
  }

  .btn-create {
    background: var(--accent-blue);
    color: #fff;
  }

  .btn-create:hover:not(:disabled) {
    opacity: 0.9;
  }
</style>
