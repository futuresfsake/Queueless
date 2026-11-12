import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@queueless/shared';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Wordmark } from '../components/brand';
import { Badge } from '../components/ui/badge';
import { buttonVariants } from '../components/ui/button';
import { API_URL, DEMO_SERVICE_CODE, DEMO_SLUG } from '../config';
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

const patientPath = `/c/${DEMO_SLUG}`;
const tvPath = `/tv/${DEMO_SLUG}/${DEMO_SERVICE_CODE}`;

/** The public front page: what the product is, how to try it, what was tested and what is missing. */
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
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3">
          <Wordmark />
          <nav aria-label="Page" className="flex items-center gap-6 text-sm font-medium text-text-2">
            <a href="#how" className="hidden hover:text-text sm:inline">
              {t.home.navHow}
            </a>
            <a href="#demo" className="hidden hover:text-text sm:inline">
              {t.home.navDemo}
            </a>
            <a href="#tested" className="hidden hover:text-text sm:inline">
              {t.home.navTested}
            </a>
            <Link to="/login" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'text-text')}>
              {t.home.staffSignIn}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-x-14 gap-y-12 px-5 py-14 md:py-20 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h1 className="text-[clamp(2.125rem,4.4vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.022em]">{t.home.headline}</h1>
            <p className="mt-5 max-w-[34rem] text-[1.0625rem] leading-relaxed text-text-2">{t.home.body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={patientPath} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
                {t.home.tryDemo}
                <ArrowRight />
              </Link>
              <Link to="/login" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}>
                {t.home.staffSignIn}
              </Link>
            </div>
            <p className="mt-4 text-[0.8125rem] text-text-3">{t.home.demoNote}</p>
          </div>
          <SampleScreens />
        </section>

        <Band id="how" title={t.home.howTitle}>
          <ol>
            {t.home.steps.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2.25rem_1fr] gap-x-3 border-t border-line py-5 first:border-t-0 first:pt-0 last:pb-0">
                <span aria-hidden="true" className="ticket-no pt-0.5 text-sm text-text-3">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[1.0625rem]">{step.title}</h3>
                  <p className="mt-1.5 max-w-[38rem] leading-relaxed text-text-2">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Band>

        <Band id="demo" title={t.home.demoTitle}>
          <ul className="border-y border-line">
            <DemoLink to={patientPath} path={patientPath} {...t.home.demoLinks.patient} />
            <DemoLink to={tvPath} path={tvPath} {...t.home.demoLinks.tv} />
            <DemoLink to="/login" path="/login" {...t.home.demoLinks.staff} />
          </ul>
        </Band>

        <Band id="tested" title={t.home.testedTitle} note={t.home.testedIntro}>
          <dl className="border-y border-line">
            {t.home.tests.map((row) => (
              <div key={row.what} className="grid gap-x-8 gap-y-1 border-t border-line py-3.5 first:border-t-0 sm:grid-cols-2">
                <dt className="text-text-2">{row.what}</dt>
                <dd className="font-semibold">{row.result}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 max-w-[42rem] text-[0.8125rem] leading-relaxed text-text-3">{t.home.testedNote}</p>
        </Band>

        <Band title={t.home.privacyBandTitle}>
          <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 text-[0.9375rem]">{t.home.privacyTitle}</h3>
              <PlainList items={t.home.privacy} />
            </div>
            <div>
              <h3 className="mb-3 text-[0.9375rem]">{t.home.limitsTitle}</h3>
              <PlainList items={t.home.limits} />
            </div>
          </div>
        </Band>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-5 text-xs text-text-3">
          <span>{t.home.footer}</span>
          <span className="flex flex-wrap gap-x-5 gap-y-1">
            <span data-testid="api-status">
              {t.home.apiStatus}:{' '}
              {health.isLoading ? 'checking' : health.isError ? 'unreachable' : `${health.data?.status} (db ${health.data?.db})`}
            </span>
            <span data-testid="socket-status" title={socket.detail || undefined}>
              {t.home.liveStatus}: {socket.state}
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** One ruled section: the heading sits in a narrow left column on wide screens, the content beside it. */
function Band({ id, title, note, children }: { id?: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-6 px-5 py-12 md:py-16 lg:grid-cols-[17rem_1fr]">
        <div>
          <h2 className="text-xl leading-snug">{title}</h2>
          {note && <p className="mt-2 text-sm leading-relaxed text-text-2">{note}</p>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function DemoLink({ to, path, label, hint }: { to: string; path: string; label: string; hint: string }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link to={to} className="group flex items-center gap-4 py-3.5">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold group-hover:text-brand">{label}</span>
          <span className="block text-sm text-text-2">{hint}</span>
        </span>
        <span className="hidden font-mono text-[0.8125rem] text-text-3 sm:block">{path}</span>
        <ArrowRight className="size-4 shrink-0 text-text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
      </Link>
    </li>
  );
}

function PlainList({ items }: { items: readonly string[] }) {
  return (
    <ul className="grid gap-2.5">
      {items.map((x) => (
        <li key={x} className="border-l-2 border-line-strong pl-3 leading-relaxed text-text-2">
          {x}
        </li>
      ))}
    </ul>
  );
}

/**
 * A drawing of two real screens with sample numbers (G-014 has one person ahead of it on the board).
 * It is an illustration, so it is hidden from screen readers and described by the caption.
 * The ticket hangs off the bottom edge of the board, over its empty margin, so it never covers a number.
 */
function SampleScreens() {
  return (
    <figure>
      <div aria-hidden="true" className="relative pb-32 pr-6 sm:pr-10">
        <div className="overflow-hidden rounded-md bg-night text-white">
          <div className="flex items-baseline justify-between gap-4 px-5 py-3 text-[0.8125rem]">
            <span className="truncate font-semibold">
              {t.home.sampleClinic} <span className="font-normal text-white/55">{t.home.sampleService}</span>
            </span>
            <span className="tabular-nums text-white/55">9:42</span>
          </div>
          <div className="grid grid-cols-[1.7fr_1fr] border-t border-white/15">
            <div className="px-5 pb-16 pt-5">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-white/60">{t.patient.nowServing}</p>
              <p className="ticket-no mt-2.5 text-[clamp(2.75rem,9vw,5rem)] leading-none">G-012</p>
            </div>
            <div className="border-l border-white/15 bg-night-2 px-4 pb-16 pt-5">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-white/60">{t.patient.nextUp}</p>
              <ol className="ticket-no mt-2 text-[clamp(0.9375rem,2.6vw,1.25rem)] leading-[1.7]">
                <li>G-013</li>
                <li className="opacity-80">G-014</li>
                <li className="opacity-60">G-015</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 right-0 w-[12rem] rounded-md border border-line-strong bg-surface shadow-pop">
          <div className="px-4 pb-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="caption">{t.patient.yourNumber}</span>
              <Badge>{t.patient.statusWaiting}</Badge>
            </div>
            <p className="ticket-no mt-3 text-[2.375rem] leading-none">G-014</p>
          </div>
          <dl className="perforation grid grid-cols-2 divide-x divide-line">
            <div className="px-4 py-2.5">
              <dt className="caption">{t.patient.aheadOfYou}</dt>
              <dd className="ticket-no mt-0.5 text-lg leading-tight">1</dd>
            </div>
            <div className="px-3 py-2.5">
              <dt className="caption">{t.patient.nowServing}</dt>
              <dd className="ticket-no mt-0.5 text-lg leading-tight">G-012</dd>
            </div>
          </dl>
        </div>
      </div>
      <figcaption className="-mt-24 max-w-[36%] text-xs leading-relaxed text-text-3 sm:max-w-[50%]">{t.home.sampleCaption}</figcaption>
    </figure>
  );
}
