import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config';

/**
 * Anonymous live hints for the patient page and the TV (D-15). No token: the server only lets this
 * socket join one queue by clinic slug and service-point code, and only ever sends "changed".
 * `onChange` runs on every hint and on every (re)connect so the caller refetches the snapshot.
 */
export function usePublicSocket(slug: string | null, code: string | null, onChange: () => void) {
  const [connected, setConnected] = useState(true);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (!slug || !code) return;
    const socket = io(API_URL || undefined, { transports: ['websocket'] });
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe.public', { slug, code });
      latest.current();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('queue.changed', () => latest.current());
    return () => {
      socket.close();
    };
  }, [slug, code]);

  return { connected };
}
