import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@queueless/shared';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './config';

type SocketState = 'connecting' | 'connected' | 'error';

/** F6 hello-world check: can this browser hold a WebSocket to the API (cross-origin, through the host's proxy)? */
function useSocketCheck(): { state: SocketState; detail: string } {
  const [result, setResult] = useState<{ state: SocketState; detail: string }>({
    state: 'connecting',
    detail: '',
  });
  useEffect(() => {
    const socket = io(API_URL || undefined, { transports: ['websocket'], reconnectionAttempts: 3 });
    socket.on('connect', () =>
      socket.emit('echo', { from: 'web' }, (ack: { ok: boolean; serverTime: string }) =>
        setResult(
          ack?.ok
            ? { state: 'connected', detail: `echo ok, server time ${ack.serverTime}` }
            : { state: 'error', detail: 'unexpected reply' },
        ),
      ),
    );
    socket.on('connect_error', (e) => setResult({ state: 'error', detail: e.message }));
    return () => {
      socket.close();
    };
  }, []);
  return result;
}

export function App() {
  const health = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/health`);
      if (!res.ok) throw new Error('health failed');
      return res.json();
    },
    refetchInterval: 10_000,
  });
  const socket = useSocketCheck();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-3xl font-bold">Queueless</h1>
      <p className="text-slate-600">Wait anywhere. Get called when it&apos;s your turn.</p>
      <p className="text-sm" data-testid="api-status">
        API:{' '}
        {health.isLoading
          ? 'checking…'
          : health.isError
            ? 'unreachable'
            : `${health.data?.status} (db ${health.data?.db})`}
      </p>
      <p className="text-sm" data-testid="socket-status">
        WebSocket: {socket.state}
        {socket.detail ? ` — ${socket.detail}` : ''}
      </p>
    </main>
  );
}
