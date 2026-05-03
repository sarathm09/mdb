import { watch } from 'node:fs';

export class FileWatcher {
  private watchers = new Map<string, ReturnType<typeof watch>>();
  private callbacks = new Map<string, Set<() => void>>();

  watch(absolutePath: string, callback: () => void): () => void {
    if (!this.callbacks.has(absolutePath)) {
      this.callbacks.set(absolutePath, new Set());
      const watcher = watch(absolutePath, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          this.callbacks.get(absolutePath)?.forEach(cb => cb());
        }
      });
      this.watchers.set(absolutePath, watcher);
    }
    this.callbacks.get(absolutePath)!.add(callback);
    return () => {
      this.callbacks.get(absolutePath)?.delete(callback);
      if (this.callbacks.get(absolutePath)?.size === 0) {
        this.watchers.get(absolutePath)?.close();
        this.watchers.delete(absolutePath);
        this.callbacks.delete(absolutePath);
      }
    };
  }

  notify(absolutePath: string): void {
    this.callbacks.get(absolutePath)?.forEach(cb => cb());
  }

  close(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.callbacks.clear();
  }
}
