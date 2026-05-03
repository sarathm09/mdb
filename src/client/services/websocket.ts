import type { WSMessage } from '../../shared/types';

type FileChangeCallback = () => void;
type AIStatusCallback = (status: string, error?: string) => void;

class MDBWebSocket {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private fileCallbacks = new Map<string, Set<FileChangeCallback>>();
  private commentCallbacks = new Map<string, Set<FileChangeCallback>>();
  private aiCallbacks = new Map<string, Set<AIStatusCallback>>();
  private subscribedFiles = new Set<string>();
  private connected = false;

  connect(): void {
    if (this.ws) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 1000;
      for (const filePath of this.subscribedFiles) {
        this.ws?.send(JSON.stringify({ type: 'subscribe', filePath }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data as string);
        if (msg.type === 'file-changed') {
          this.fileCallbacks.get(msg.filePath)?.forEach(cb => cb());
        } else if (msg.type === 'comments-changed') {
          this.commentCallbacks.get(msg.filePath)?.forEach(cb => cb());
        } else if (msg.type === 'ai-status') {
          this.aiCallbacks.get(msg.jobId)?.forEach(cb => cb(msg.status, msg.error));
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        this.connect();
      }, this.reconnectDelay);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private subscribeFile(filePath: string): void {
    if (!this.subscribedFiles.has(filePath)) {
      this.subscribedFiles.add(filePath);
      if (this.connected) {
        this.ws?.send(JSON.stringify({ type: 'subscribe', filePath }));
      }
    }
  }

  onFileChanged(filePath: string, cb: FileChangeCallback): () => void {
    this.subscribeFile(filePath);
    if (!this.fileCallbacks.has(filePath)) this.fileCallbacks.set(filePath, new Set());
    this.fileCallbacks.get(filePath)!.add(cb);
    return () => {
      this.fileCallbacks.get(filePath)?.delete(cb);
      if (this.fileCallbacks.get(filePath)?.size === 0) {
        this.subscribedFiles.delete(filePath);
        this.ws?.send(JSON.stringify({ type: 'unsubscribe', filePath }));
      }
    };
  }

  onCommentsChanged(filePath: string, cb: FileChangeCallback): () => void {
    this.subscribeFile(filePath);
    if (!this.commentCallbacks.has(filePath)) this.commentCallbacks.set(filePath, new Set());
    this.commentCallbacks.get(filePath)!.add(cb);
    return () => this.commentCallbacks.get(filePath)?.delete(cb);
  }

  onAIStatus(jobId: string, cb: AIStatusCallback): () => void {
    if (!this.aiCallbacks.has(jobId)) this.aiCallbacks.set(jobId, new Set());
    this.aiCallbacks.get(jobId)!.add(cb);
    return () => {
      this.aiCallbacks.get(jobId)?.delete(cb);
      if (this.aiCallbacks.get(jobId)?.size === 0) this.aiCallbacks.delete(jobId);
    };
  }
}

export const wsClient = new MDBWebSocket();
