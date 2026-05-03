import type { WebSocket } from 'ws';
import type { WSMessage } from '../shared/types';

export class WSManager {
  private clients = new Map<WebSocket, Set<string>>();

  add(ws: WebSocket): void {
    const files = new Set<string>();
    this.clients.set(ws, files);
    ws.on('message', (msg: Buffer | string) => {
      try {
        const data = JSON.parse(typeof msg === 'string' ? msg : msg.toString());
        if (data.type === 'subscribe' && typeof data.filePath === 'string') {
          files.add(data.filePath);
        } else if (data.type === 'unsubscribe' && typeof data.filePath === 'string') {
          files.delete(data.filePath);
        }
      } catch {}
    });
    ws.on('close', () => this.clients.delete(ws));
  }

  broadcast(message: WSMessage): void {
    const msgStr = JSON.stringify(message);
    for (const [ws, files] of this.clients) {
      if (ws.readyState !== 1 /* OPEN */) continue;
      if ('filePath' in message && files.has(message.filePath)) {
        try { ws.send(msgStr); } catch {}
      }
    }
  }

  broadcastToAll(message: WSMessage): void {
    const msgStr = JSON.stringify(message);
    for (const [ws] of this.clients) {
      if (ws.readyState !== 1 /* OPEN */) continue;
      try { ws.send(msgStr); } catch {}
    }
  }
}
