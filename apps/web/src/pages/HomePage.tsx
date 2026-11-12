import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@queueless/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Wordmark } from '../components/brand';
import { buttonVariants } from '../components/ui/button';
import { API_URL } from '../config';
import { cn } from '../lib/utils';
import { t } from '../strings';

type SocketState = 'connecting' | 'connected' | 'error';

/** F6 deploy check: can this browser hold a WebSocket to the API (cross-origin, through the host's proxy)? */
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

export function HomePage() {
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
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-5">
      <header className="flex items-center justify-between border-b-2 border-ink pb-4">
        <Wordmark />
        <Link to="/login" className="text-sm font-medium underline underline-offset-4">
          {t.home.staffSignIn}
        </Link>
      </header>

      <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h1 className="text-[clamp(2.6rem,6vw,4.6rem)] leading-[1]">
            <span className="block">{t.home.headlineA}</span>
            <span className="marker block w-fit">{t.home.headlineB}</span>
          </h1>
          <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-grey">{t.home.body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/login" className={cn(buttonVariants({ variant: 'accent', size: 'lg' }))}>
              {t.home.staffSignIn}
            </Link>
            <span className="text-sm text-grey">{t.home.patientNote}</span>
          </div>
        </div>

        <div aria-hidden="true" className="receipt-wrap mx-auto w-full max-w-[16rem]">
          <div className="receipt px-5 pb-8 pt-9 text-center font-mono">
            <p className="text-xs font-semibold uppercase tracking-widest">Demo Health Center</p>
            <div className="dots my-3" />
            <p className="text-[0.8125rem] uppercase">{t.patient.yourNumber}</p>
            <p className="num whitespace-nowrap text-[4.4rem] leading-none">G-014</p>
            <div className="dots my-3" />
            <p className="flex items-baseline justify-between text-sm uppercase">
              {t.patient.aheadOfYou} <span className="num text-2xl">3</span>
            </p>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap gap-x-6 gap-y-1 border-t border-rule pt-3 font-mono text-xs text-grey">
        <span data-testid="api-status">
          API:{' '}
          {health.isLoading
            ? 'checking'
            : health.isError
              ? 'unreachable'
              : `${health.data?.status} (db ${health.data?.db})`}
        </span>
        <span data-testid="socket-status">
          WebSocket: {socket.state}
          {socket.detail ? `, ${socket.detail}` : ''}
        </span>
      </footer>
    </main>
  );
}
