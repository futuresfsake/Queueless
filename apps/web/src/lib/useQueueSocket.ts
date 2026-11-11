import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config';

/**
 * Live "queue changed" hints (D-15). The socket carries no data: on every hint, and on every
 * (re)connect, `onChange` is called and the caller refetches the snapshot over HTTP. A refetch
 * on reconnect also repairs anything missed while offline.
 */
export function useQueueSocket(token: string | null, servicePointId: string | null, onChange: () => void) {
  const [connected, setConnected] = useState(true);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (!token || !servicePointId) return;
    const socket = io(API_URL || undefined, { transports: ['websocket'], auth: { token } });
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe', { servicePointId });
      latest.current(); // resync after every (re)connect
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('queue.changed', () => latest.current());
    return () => {
      socket.close();
    };
  }, [token, servicePointId]);

  return { connected };
}
