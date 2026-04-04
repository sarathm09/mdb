export const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

export const modLabel = isMac ? 'Cmd' : 'Ctrl';

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (el.classList.contains('cm-content')) return true;
  return false;
}

export interface ShortcutInfo {
  keys: string;
  description: string;
  category: 'General' | 'Editor' | 'Explorer';
}

export const SHORTCUTS: ShortcutInfo[] = [
  { keys: `${modLabel}+D`, description: 'Toggle sidebar', category: 'General' },
  { keys: `${modLabel}+Shift+P`, description: 'Command palette', category: 'General' },
  { keys: '?', description: 'Show keyboard shortcuts', category: 'General' },
  { keys: `${modLabel}+Shift+Enter`, description: 'Presentation mode', category: 'General' },
  { keys: `${modLabel}+Shift+E`, description: 'Export menu', category: 'General' },
  { keys: 'Escape', description: 'Close modal / deselect file', category: 'General' },
  { keys: `${modLabel}+B`, description: 'Bold', category: 'Editor' },
  { keys: `${modLabel}+I`, description: 'Italic', category: 'Editor' },
  { keys: `${modLabel}+U`, description: 'Underline', category: 'Editor' },
  { keys: `${modLabel}+K`, description: 'Insert link', category: 'Editor' },
  { keys: `${modLabel}+Shift+X`, description: 'Strikethrough', category: 'Editor' },
  { keys: `${modLabel}+Shift+K`, description: 'Code block', category: 'Editor' },
  { keys: `${modLabel}+Shift+T`, description: 'Insert table', category: 'Editor' },
  { keys: `${modLabel}+S`, description: 'Save', category: 'Editor' },
  { keys: 'j / ArrowDown', description: 'Move down', category: 'Explorer' },
  { keys: 'k / ArrowUp', description: 'Move up', category: 'Explorer' },
  { keys: 'l / Enter', description: 'Open file/folder', category: 'Explorer' },
  { keys: 'h / Backspace', description: 'Go to parent', category: 'Explorer' },
  { keys: 'g', description: 'Jump to first', category: 'Explorer' },
  { keys: 'G', description: 'Jump to last', category: 'Explorer' },
];
