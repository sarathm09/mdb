import type { ServerWebSocket } from 'bun';
import type { WSMessage } from '../shared/types';

interface WSData {
  subscribedFiles: Set<string>;
}

export class WSManager {
  private clients = new Map<ServerWebSocket<WSData>, Set<string>>();

  open(ws: ServerWebSocket<WSData>): void {
    ws.data = { subscribedFiles: new Set() };
    this.clients.set(ws, ws.data.subscribedFiles);
  }

  handleMessage(ws: ServerWebSocket<WSData>, msg: string | Buffer): void {
    try {
      const data = JSON.parse(typeof msg === 'string' ? msg : msg.toString());
      if (data.type === 'subscribe' && typeof data.filePath === 'string') {
        this.clients.get(ws)?.add(data.filePath);
      } else if (data.type === 'unsubscribe' && typeof data.filePath === 'string') {
        this.clients.get(ws)?.delete(data.filePath);
      }
    } catch {}
  }

  close(ws: ServerWebSocket<WSData>): void {
    this.clients.delete(ws);
  }

  broadcast(message: WSMessage): void {
    const msgStr = JSON.stringify(message);
    for (const [ws, files] of this.clients) {
      if ('filePath' in message && files.has(message.filePath)) {
        try { ws.send(msgStr); } catch {}
      } else if (message.type === 'ai-status') {
        try { ws.send(msgStr); } catch {}
      }
    }
  }

  broadcastToAll(message: WSMessage): void {
    const msgStr = JSON.stringify(message);
    for (const [ws] of this.clients) {
      try { ws.send(msgStr); } catch {}
    }
  }
}
