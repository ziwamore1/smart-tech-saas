import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(`${API_BASE_URL}/school`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to school events');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.log('[Socket] Connection error:', error.message);
    });

    // Re-register all listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => this.socket?.on(event, cb));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinSchool(schoolId: string) {
    this.socket?.emit('joinSchool', schoolId);
  }

  leaveSchool(schoolId: string) {
    this.socket?.emit('leaveSchool', schoolId);
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket?.connected) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback);
    this.socket?.off(event, callback);
  }
}

export const socketService = new SocketService();
