import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@queueless/shared';
import { MonitorSmartphone, Smartphone, UserCheck } from 'lucide-react';
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

const points = [
  { icon: Smartphone, title: t.home.pointPatientsTitle, body: t.home.pointPatientsBody },
  { icon: UserCheck, title: t.home.pointStaffTitle, body: t.home.pointStaffBody },
  { icon: MonitorSmartphone, title: t.home.pointScreenTitle, body: t.home.pointScreenBody },
];

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
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <Wordmark />
          <Link to="/login" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
            {t.home.staffSignIn}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="py-16 md:py-24">
          <h1 className="max-w-2xl text-[clamp(2rem,4.6vw,3.25rem)] font-semibold leading-[1.1] tracking-tight">{t.home.headline}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-2">{t.home.body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link to="/login" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
              {t.home.staffSignIn}
            </Link>
            <span className="text-sm text-text-2">{t.home.patientNote}</span>
          </div>
        </section>

        <section className="grid gap-4 pb-16 md:grid-cols-3">
          {points.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-line bg-surface p-5 shadow-card">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 text-base">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-text-2">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-1 px-5 py-4 text-xs text-text-3">
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
        </div>
      </footer>
    </div>
  );
}
