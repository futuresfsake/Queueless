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
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-6">
      <header className="flex items-center justify-between">
        <Wordmark />
        <Link to="/login" className="text-sm text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink">
          {t.home.staffSignIn}
        </Link>
      </header>

      <section className="my-auto grid items-center gap-12 py-16 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="eyebrow">{t.home.eyebrow}</p>
          <h1 className="mt-2 text-balance text-[clamp(2.4rem,5.4vw,4.2rem)] font-semibold leading-[1.04]">
            <span className="block whitespace-nowrap">{t.home.headlineA}</span>
            <span className="block text-accent">{t.home.headlineB}</span>
          </h1>
          <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-ink-soft">{t.home.body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/login" className={cn(buttonVariants({ variant: 'accent', size: 'lg' }))}>
              {t.home.staffSignIn}
            </Link>
            <span className="text-sm text-ink-soft">{t.home.patientNote}</span>
          </div>
        </div>

        <div aria-hidden="true" className="relative mx-auto w-full max-w-[17rem] rotate-[2.5deg]">
          <div className="stub-wrap">
            <div className="stub-top px-6 pb-8 pt-6 text-center">
              <p className="eyebrow">{t.patient.yourNumber}</p>
              <p className="numeral mt-2 whitespace-nowrap text-[5.75rem] leading-[0.85]">G-014</p>
            </div>
            <div className="stub-bottom perforation px-6 pb-6 pt-5 text-center">
              <div className="flex items-baseline justify-center gap-3">
                <span className="numeral text-[3.2rem]">3</span>
                <span className="font-display text-lg leading-tight">{t.patient.peopleAhead}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-4 font-num text-[0.8125rem] uppercase tracking-[0.12em] text-ink-soft">
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
