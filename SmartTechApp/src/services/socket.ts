import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private joinedSchools: Set<string> = new Set();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(`${API_BASE_URL}/school`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 15,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to school events');
      // Re-join all previously joined school rooms
      this.joinedSchools.forEach((schoolId) => {
        this.socket?.emit('joinSchool', schoolId);
        console.log(`[Socket] Re-joined school:${schoolId}`);
      });
      // Re-register all listeners
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach((cb) => this.socket?.on(event, cb));
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.log('[Socket] Connection error:', error.message);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] Reconnection attempt:', attemptNumber);
    });

    this.socket.on('reconnect_failed', () => {
      console.log('[Socket] All reconnection attempts failed');
    });
  }

  disconnect() {
    this.joinedSchools.clear();
    this.socket?.disconnect();
    this.socket = null;
  }

  joinSchool(schoolId: string) {
    this.joinedSchools.add(schoolId);
    if (this.socket?.connected) {
      this.socket.emit('joinSchool', schoolId);
    }
  }

  leaveSchool(schoolId: string) {
    this.joinedSchools.delete(schoolId);
    if (this.socket?.connected) {
      this.socket.emit('leaveSchool', schoolId);
    }
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

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
