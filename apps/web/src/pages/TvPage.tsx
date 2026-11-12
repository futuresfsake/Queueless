import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { usePublicSocket } from '../lib/usePublicSocket';
import { t } from '../strings';

interface Display {
  clinic: string;
  servicePoint: string;
  nowServing: string | null;
  nextUp: string[];
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** US-16: the waiting-room board. Numbers only, never names. Red LED digits on black, like the real ones. */
export function TvPage() {
  const { slug = '', code = '' } = useParams();
  const qc = useQueryClient();
  const clock = useClock();
  const q = useQuery({
    queryKey: ['display', slug, code],
    queryFn: () => api<Display>(`/public/c/${slug}/service-points/${code}/display`, { auth: false }),
    retry: false,
    refetchInterval: 15_000,
  });
  const { connected } = usePublicSocket(slug, code, () => void qc.invalidateQueries({ queryKey: ['display', slug, code] }));

  if (q.isError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-black px-8 text-white">
        <p className="font-mono text-3xl">{t.patient.queueNotFound}</p>
      </main>
    );
  }
  const d = q.data;
  const next = d?.nextUp ?? [];

  return (
    <main className="flex min-h-dvh flex-col bg-black font-mono text-white">
      <header className="flex items-baseline justify-between gap-6 border-b-2 border-white/20 px-[3vw] py-[2vh]">
        <p className="font-sans text-[clamp(1.2rem,2.2vw,2.4rem)] font-bold">
          {d?.clinic} <span className="font-medium text-white/50">/ {d?.servicePoint}</span>
        </p>
        <p className="num text-[clamp(1.4rem,2.4vw,2.8rem)] text-white/70">{clock}</p>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1.9fr_1fr]">
        <section className="flex flex-col justify-center px-[3vw] py-[3vh]">
          <p className="text-[clamp(1.2rem,2vw,2.2rem)] font-semibold uppercase tracking-[0.2em] text-white/60">{t.patient.nowServing}</p>
          <p
            key={d?.nowServing ?? 'none'}
            data-testid="now-serving"
            className="num tick mt-[1vh] whitespace-nowrap text-[clamp(6rem,21vw,24rem)] leading-[0.9] text-led [text-shadow:0_0_0.3em_rgb(255_59_36/0.35)]"
          >
            {d?.nowServing ?? '---'}
          </p>
        </section>

        <section className="border-t-2 border-white/20 px-[3vw] py-[3vh] lg:border-l-2 lg:border-t-0">
          <p className="text-[clamp(1.2rem,2vw,2.2rem)] font-semibold uppercase tracking-[0.2em] text-white/60">{t.patient.nextUp}</p>
          <ol className="mt-[2vh]">
            {next.length === 0 && <li className="text-[clamp(1.4rem,2.2vw,2.6rem)] text-white/40">{t.patient.nobodyWaiting}</li>}
            {next.map((n, i) => (
              <li
                key={n}
                className="num border-t border-white/15 py-[1.2vh] first:border-t-0"
                style={{ fontSize: `clamp(2.2rem, ${Math.max(2.6, 5.2 - i * 0.6)}vw, ${Math.max(3.2, 6.5 - i * 0.7)}rem)`, opacity: 1 - i * 0.13 }}
              >
                {n}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {!connected && <p className="blink border-t-2 border-led px-[3vw] py-2 text-lg text-led">{t.staff.reconnecting}</p>}
    </main>
  );
}
