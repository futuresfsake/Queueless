import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LogoMark } from '../components/brand';
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
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** US-16: the waiting-room display. Numbers only, never names. High contrast, readable from the back of the room. */
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
      <main className="grid min-h-dvh place-items-center bg-night px-8 text-white">
        <p className="text-3xl font-medium">{t.patient.queueNotFound}</p>
      </main>
    );
  }
  const d = q.data;
  const next = d?.nextUp ?? [];
  // Tabular digits are about 0.6em wide, so the size that fills the panel follows from the number's length.
  // 96 = usable panel width in vw divided by that width; a longer prefix shrinks the number instead of clipping it.
  const serving = d?.nowServing ?? '-';
  const servingSize = `clamp(4.5rem, ${(96 / Math.max(serving.length, 4)).toFixed(1)}vw, 24rem)`;

  return (
    <main className="flex min-h-dvh flex-col bg-night text-white">
      <header className="flex items-center justify-between gap-6 px-[3.5vw] py-[2.4vh]">
        <div className="flex items-center gap-4">
          <LogoMark className="size-[clamp(2rem,3vw,3.5rem)]" />
          <div>
            <p className="text-[clamp(1.3rem,2.2vw,2.4rem)] font-semibold leading-tight">{d?.clinic}</p>
            <p className="text-[clamp(1rem,1.5vw,1.7rem)] text-white/60">{d?.servicePoint}</p>
          </div>
        </div>
        <p className="text-[clamp(1.5rem,2.6vw,3rem)] font-medium tabular-nums text-white/70">{clock}</p>
      </header>

      <div className="grid flex-1 border-t border-white/15 lg:grid-cols-[1.9fr_1fr]">
        <section className="flex flex-col justify-center px-[3.5vw] py-[3vh]">
          <p className="text-[clamp(1rem,1.6vw,1.8rem)] font-semibold uppercase tracking-[0.12em] text-white/60">{t.patient.nowServing}</p>
          <p
            key={d?.nowServing ?? 'none'}
            data-testid="now-serving"
            className="ticket-no fade-in mt-[1.5vh] whitespace-nowrap leading-[0.95] text-white"
            style={{ fontSize: servingSize }}
          >
            {serving}
          </p>
        </section>

        <section className="border-t border-white/15 bg-night-2 px-[3vw] py-[3vh] lg:border-l lg:border-t-0">
          <p className="text-[clamp(1rem,1.6vw,1.8rem)] font-semibold uppercase tracking-[0.12em] text-white/60">{t.patient.nextUp}</p>
          <ol className="mt-[2vh]">
            {next.length === 0 && <li className="text-[clamp(1.3rem,2vw,2.4rem)] text-white/40">{t.patient.nobodyWaiting}</li>}
            {next.map((n, i) => (
              <li
                key={n}
                className="ticket-no flex items-baseline justify-between border-t border-white/10 py-[1.3vh] first:border-t-0"
                style={{ fontSize: 'clamp(1.75rem, 3.6vw, 4.75rem)', opacity: 1 - i * 0.14 }}
              >
                {n}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {!connected && <p className="bg-amber-500/15 px-[3.5vw] py-2 text-lg text-amber-200">{t.staff.reconnecting}</p>}
    </main>
  );
}
