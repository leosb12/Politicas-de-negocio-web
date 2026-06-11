import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_BASE_URL } from '../../../core/config/api.config';
import { SocketConnectionState } from '../models/politica-colaboracion.model';

@Injectable({ providedIn: 'root' })
export class PoliticaColaboracionSocketService {
  private readonly connectionStateSubject =
    new BehaviorSubject<SocketConnectionState>('DISCONNECTED');
  readonly connectionState$ = this.connectionStateSubject.asObservable();

  private client: Client | null = null;
  private manualDisconnect = false;
  private destinationSubscriptions = new Map<string, StompSubscription>();

  connect(): void {
    if (this.client?.active || this.client?.connected) {
      return;
    }

    const current = this.connectionStateSubject.value;
    const nextState: SocketConnectionState =
      current === 'DISCONNECTED' ? 'CONNECTING' : 'RECONNECTING';
    this.connectionStateSubject.next(nextState);
    this.manualDisconnect = false;

    const socketClient = new Client({
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      connectHeaders: {},
      webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws-politicas`),
      debug: () => {
        // Keep disabled in production by default to avoid noisy logs.
      },
    });

    this.client = socketClient;

    socketClient.onConnect = () => {
      if (this.client !== socketClient) return;
      this.connectionStateSubject.next('CONNECTED');
    };

    socketClient.onDisconnect = () => {
      if (this.client !== socketClient) return;
      if (this.manualDisconnect) {
        this.connectionStateSubject.next('DISCONNECTED');
      }
    };

    socketClient.onWebSocketClose = () => {
      if (this.client !== socketClient) return;
      if (this.manualDisconnect) {
        this.connectionStateSubject.next('DISCONNECTED');
        return;
      }

      this.connectionStateSubject.next('RECONNECTING');
    };

    socketClient.onWebSocketError = (event) => {
      if (this.client !== socketClient) return;
      console.error('WebSocket error en colaboración', event);
    };

    socketClient.onStompError = (frame) => {
      if (this.client !== socketClient) return;
      console.error('STOMP error en colaboración', frame.headers['message'], frame.body);
    };

    socketClient.activate();
  }

  isConnected(): boolean {
    return !!this.client?.connected;
  }

  subscribe<T>(
    destination: string,
    next: (payload: T) => void
  ): (() => void) | null {
    if (!this.client?.connected) {
      return null;
    }

    this.unsubscribe(destination);

    const subscription = this.client.subscribe(destination, (message: IMessage) => {
      next(this.parseBody<T>(message.body));
    });

    this.destinationSubscriptions.set(destination, subscription);

    return () => {
      this.unsubscribe(destination);
    };
  }

  publish(destination: string, payload: unknown): boolean {
    if (!this.client?.connected) {
      return false;
    }

    this.client.publish({
      destination,
      body: JSON.stringify(payload),
    });

    return true;
  }

  async disconnect(): Promise<void> {
    this.manualDisconnect = true;

    for (const destination of [...this.destinationSubscriptions.keys()]) {
      this.unsubscribe(destination);
    }

    const activeClient = this.client;
    this.client = null;

    if (!activeClient) {
      this.connectionStateSubject.next('DISCONNECTED');
      return;
    }

    await activeClient.deactivate();
    
    // Only emit DISCONNECTED if no new client was started in the meantime
    if (this.client === null) {
      this.connectionStateSubject.next('DISCONNECTED');
    }
  }

  private unsubscribe(destination: string): void {
    const existing = this.destinationSubscriptions.get(destination);
    if (!existing) {
      return;
    }

    existing.unsubscribe();
    this.destinationSubscriptions.delete(destination);
  }

  private parseBody<T>(body: string): T {
    if (!body) {
      return {} as T;
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      return { mensaje: body } as T;
    }
  }
}
