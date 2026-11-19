'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-context';

const SOCKET_URL = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  .replace(/\/api\/v1\/?$/, '');

export function useSchoolSocket(events: Record<string, (data: any) => void>) {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const schoolId = (user as any)?.schoolId;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!schoolId) return;

    const socket = io(`${SOCKET_URL}/school`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinSchool', schoolId);
      Object.entries(eventsRef.current).forEach(([event, handler]) => {
        socket.on(event, handler);
      });
    });

    return () => {
      socket.emit('leaveSchool', schoolId);
      Object.entries(eventsRef.current).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [schoolId]);

  return socketRef;
}
