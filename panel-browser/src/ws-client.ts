import { RenderMessage } from './types';

export type MessageHandler = (msg: RenderMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessage: MessageHandler;
  private reconnectDelay = 1000;

  constructor(url: string, onMessage: MessageHandler) {
    this.url = url;
    this.onMessage = onMessage;
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (event) => {
      try {
        const msg: RenderMessage = JSON.parse(event.data);
        this.onMessage(msg);
      } catch {
        // Ignore malformed JSON — defensive design
      }
    };

    this.ws.onclose = () => {
      // Auto-reconnect
      setTimeout(() => this.connect(), this.reconnectDelay);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
