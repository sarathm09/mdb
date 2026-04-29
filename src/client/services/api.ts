import type { DirectoryListing, FileContent, FileEntry } from '../../shared/types';

export async function fetchDirectory(path: string, showHidden: boolean = false): Promise<DirectoryListing> {
  const response = await fetch(`/api/files?path=${encodeURIComponent(path)}&showHidden=${showHidden}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch directory' }));
    throw new Error(error.error || 'Failed to fetch directory');
  }
  return response.json();
}

export async function fetchFile(path: string): Promise<FileContent> {
  const response = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch file' }));
    throw new Error(error.error || 'Failed to fetch file');
  }
  return response.json();
}

export async function saveFile(path: string, content: string): Promise<void> {
  const response = await fetch('/api/file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to save file' }));
    throw new Error(error.error || 'Failed to save file');
  }
}

export async function createFile(directory: string, name: string): Promise<string> {
  const response = await fetch('/api/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory, name }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create file' }));
    throw new Error(error.error || 'Failed to create file');
  }
  const data = await response.json();
  return data.path;
}

export async function searchFiles(query: string, showHidden: boolean = false, maxDepth?: number, types?: 'all' | 'markdown'): Promise<FileEntry[]> {
  let url = `/api/search?q=${encodeURIComponent(query)}&showHidden=${showHidden}`;
  if (maxDepth !== undefined) url += `&maxDepth=${maxDepth}`;
  if (types) url += `&types=${types}`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to search files' }));
    throw new Error(error.error || 'Failed to search files');
  }
  return response.json();
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const response = await fetch('/api/settings');
  if (!response.ok) return {};
  return response.json();
}

export async function saveSettings(settings: Record<string, unknown>): Promise<void> {
  await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export function getRawFileUrl(path: string): string {
  return `/api/raw?path=${encodeURIComponent(path)}`;
}

export async function openExternal(path: string, action: 'terminal' | 'finder' | 'editor', app?: string): Promise<void> {
  const body: Record<string, string> = { path, action };
  if (app) body.app = app;
  const response = await fetch('/api/open-external', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to open' }));
    throw new Error(error.error || 'Failed to open');
  }
}

export async function uploadFile(file: File, directory: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('directory', directory);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.path;
}
