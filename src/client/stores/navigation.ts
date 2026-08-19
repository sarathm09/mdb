import { writable, get, type Writable } from 'svelte/store';
import type { FileEntry } from '../../shared/types';

export const currentPath = writable<string>('.');
export const entries = writable<FileEntry[]>([]);
export const activePage = writable<'settings' | null>(null);
const selectedFileStore = writable<string | null>(null);
export const selectedFile: Writable<string | null> = {
  subscribe: selectedFileStore.subscribe,
  set(value) {
    if (value && initialized) activePage.set(null);
    selectedFileStore.set(value);
  },
  update(updater) {
    const value = updater(get(selectedFileStore));
    if (value && initialized) activePage.set(null);
    selectedFileStore.set(value);
  },
};
export const sidebarOpen = writable<boolean>(true);
export const rootName = writable<string>('');
export const rootPath = writable<string>('');
export const showHiddenFiles = writable<boolean>(localStorage.getItem('mb-show-hidden') === 'true');
export const theme = writable<string>(localStorage.getItem('mb-theme') || 'one-dark');
export const sidebarFontSize = writable<number>(parseInt(localStorage.getItem('mb-sidebar-font-size') || '14', 10));
export const fontFamily = writable<string>(localStorage.getItem('mb-font-family') || 'system');
export const contentFontSize = writable<number>(parseInt(localStorage.getItem('mb-content-font-size') || '15', 10));
export const lineHeight = writable<number>(parseFloat(localStorage.getItem('mb-line-height') || '1.7'));
export const contentMaxWidth = writable<number>(parseInt(localStorage.getItem('mb-content-max-width') || '900', 10));

function encodeHash(dir: string, file: string | null, page: 'settings' | null): string {
  if (page) return `#/${page}`;
  if (file) return '#/file/' + file;
  if (dir && dir !== '.') return '#/' + dir;
  return '#/';
}

function decodeHash(hash: string): { dir: string; file: string | null; page: 'settings' | null } {
  const raw = decodeURIComponent(hash.replace(/^#\/?/, ''));
  if (!raw) return { dir: '.', file: null, page: null };
  if (raw === 'settings') return { dir: get(currentPath), file: null, page: 'settings' };
  if (raw.startsWith('file/')) {
    const filePath = raw.slice(5);
    const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '.';
    return { dir, file: filePath, page: null };
  }
  return { dir: raw || '.', file: null, page: null };
}

let initialized = false;

function pushHash() {
  if (!initialized) return;
  const dir = get(currentPath);
  const file = get(selectedFile);
  const page = get(activePage);
  const newHash = encodeHash(dir, file, page);
  if (window.location.hash !== newHash) {
    history.pushState(null, '', newHash);
  }
}

currentPath.subscribe(() => pushHash());
selectedFile.subscribe(() => pushHash());
activePage.subscribe(() => pushHash());

export function initFromUrl(): { dir: string; file: string | null; page: 'settings' | null } {
  const { dir, file, page } = decodeHash(window.location.hash);
  currentPath.set(dir);
  selectedFile.set(file);
  activePage.set(page);
  initialized = true;
  return { dir, file, page };
}

window.addEventListener('popstate', async () => {
  const { fetchDirectory } = await import('../services/api');
  const { dir, file, page } = decodeHash(window.location.hash);
  initialized = false;
  currentPath.set(dir);
  selectedFile.set(file);
  activePage.set(page);
  initialized = true;
  const listing = await fetchDirectory(dir, get(showHiddenFiles));
  entries.set(listing.entries);
});
