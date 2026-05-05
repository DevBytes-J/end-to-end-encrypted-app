import { getAccessToken, refreshAccessToken } from "./api";
import type { MessageResponse } from "./api";

type MessageHandler = (msg: MessageResponse) => void;
type SessionExpiredHandler = () => void;

class WSManager {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private onSessionExpired: SessionExpiredHandler | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldConnect = false;

  connect() {
    this.shouldConnect = true;
    this._open();
  }

  disconnect() {
    this.shouldConnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  setSessionExpiredHandler(handler: SessionExpiredHandler) {
    this.onSessionExpired = handler;
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _open() {
    const token = getAccessToken();
    if (!token || !this.shouldConnect) return;

    this.ws = new WebSocket(`wss://whisperbox.koyeb.app/ws?token=${token}`);

    this.ws.onmessage = (e) => {
      try {
        const frame = JSON.parse(e.data);
        if (frame.event === "message.receive") {
          // Frame is flat: { event, id, from_user_id, to_user_id, payload, created_at }
          this.handlers.forEach((h) => h(frame as MessageResponse));
        }
      } catch { /* ignore malformed frames */ }
    };

    this.ws.onclose = (e) => {
      if (!this.shouldConnect) return;
      if (e.code === 4003) {
        // Token invalid — force logout
        this.shouldConnect = false;
        this.onSessionExpired?.();
        return;
      }
      if (e.code === 4001) {
        // Token expired — refresh then reconnect
        refreshAccessToken().then((ok) => {
          if (ok) this._open();
          else { this.shouldConnect = false; this.onSessionExpired?.(); }
        });
        return;
      }
      // Generic reconnect
      this.reconnectTimer = setTimeout(() => this._open(), 3000);
    };

    this.ws.onerror = () => this.ws?.close();
  }
}

export const wsManager = new WSManager();
