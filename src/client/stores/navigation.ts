import { writable, get } from 'svelte/store';
import type { FileEntry } from '../../shared/types';

export const currentPath = writable<string>('.');
export const entries = writable<FileEntry[]>([]);
export const selectedFile = writable<string | null>(null);
export const sidebarOpen = writable<boolean>(true);
export const rootName = writable<string>('');
export const showHiddenFiles = writable<boolean>(localStorage.getItem('mb-show-hidden') === 'true');
export const theme = writable<string>(localStorage.getItem('mb-theme') || 'one-dark');
export const sidebarFontSize = writable<number>(parseInt(localStorage.getItem('mb-sidebar-font-size') || '14', 10));
export const fontFamily = writable<string>(localStorage.getItem('mb-font-family') || 'system');
export const contentFontSize = writable<number>(parseInt(localStorage.getItem('mb-content-font-size') || '15', 10));
export const lineHeight = writable<number>(parseFloat(localStorage.getItem('mb-line-height') || '1.7'));
export const contentMaxWidth = writable<number>(parseInt(localStorage.getItem('mb-content-max-width') || '900', 10));

function encodeHash(dir: string, file: string | null): string {
  if (file) return '#/file/' + file;
  if (dir && dir !== '.') return '#/' + dir;
  return '#/';
}

function decodeHash(hash: string): { dir: string; file: string | null } {
  const raw = decodeURIComponent(hash.replace(/^#\/?/, ''));
  if (!raw) return { dir: '.', file: null };
  if (raw.startsWith('file/')) {
    const filePath = raw.slice(5);
    const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '.';
    return { dir, file: filePath };
  }
  return { dir: raw || '.', file: null };
}

let initialized = false;

function pushHash() {
  if (!initialized) return;
  const dir = get(currentPath);
  const file = get(selectedFile);
  const newHash = encodeHash(dir, file);
  if (window.location.hash !== newHash) {
    history.pushState(null, '', newHash);
  }
}

currentPath.subscribe(() => pushHash());
selectedFile.subscribe(() => pushHash());

export function initFromUrl(): { dir: string; file: string | null } {
  const { dir, file } = decodeHash(window.location.hash);
  currentPath.set(dir);
  selectedFile.set(file);
  initialized = true;
  return { dir, file };
}

window.addEventListener('popstate', async () => {
  const { fetchDirectory } = await import('../services/api');
  const { dir, file } = decodeHash(window.location.hash);
  initialized = false;
  currentPath.set(dir);
  selectedFile.set(file);
  initialized = true;
  const listing = await fetchDirectory(dir, get(showHiddenFiles));
  entries.set(listing.entries);
});
