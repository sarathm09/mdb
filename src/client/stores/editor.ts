import { writable, derived } from 'svelte/store';

export const isEditing = writable<boolean>(false);
export const content = writable<string>('');
export const originalContent = writable<string>('');

export const renderedHtml = writable<string>('');

export const isDirty = derived(
  [content, originalContent],
  ([$content, $originalContent]) => $content !== $originalContent
);
