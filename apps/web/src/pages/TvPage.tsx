import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TicketGlyph } from '../components/brand';
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

/** US-16: the waiting-room TV. Numbers only, never names. Read from the back of the room. */
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
      <main className="grid min-h-dvh place-items-center bg-ink px-8 text-center text-paper">
        <p className="font-display text-4xl">{t.patient.queueNotFound}</p>
      </main>
    );
  }
  const d = q.data;
  const next = d?.nextUp ?? [];

  return (
    <main className="flex min-h-dvh flex-col bg-ink text-paper">
      <header className="flex items-start justify-between gap-6 px-[4vw] pt-[3vh]">
        <div>
          <p className="flex items-center gap-3 font-display text-[clamp(1.4rem,2.4vw,2.6rem)] font-semibold">
            <TicketGlyph className="size-[1.1em] text-accent" />
            {d?.clinic}
          </p>
          <p className="eyebrow mt-1 !text-paper/55 !text-[clamp(0.9rem,1.3vw,1.4rem)]">{d?.servicePoint}</p>
        </div>
        <p className="numeral text-[clamp(1.6rem,2.6vw,3rem)] text-paper/70">{clock}</p>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-[4vw] px-[4vw] pb-[5vh] pt-[3vh] lg:grid-cols-[1.7fr_1fr]">
        <section className="flex flex-col justify-center">
          <p className="eyebrow !text-accent !text-[clamp(1.1rem,1.8vw,2rem)]">{t.patient.nowServing}</p>
          <p
            key={d?.nowServing ?? 'none'}
            data-testid="now-serving"
            className="numeral land mt-[1vh] text-[clamp(7rem,24vw,26rem)] leading-[0.82] text-paper"
          >
            {d?.nowServing ?? '-'}
          </p>
        </section>

        <section className="flex flex-col border-paper/15 lg:border-l lg:pl-[3.5vw]">
          <p className="eyebrow !text-paper/55 !text-[clamp(1.1rem,1.8vw,2rem)]">{t.patient.nextUp}</p>
          <ol className="mt-[2vh] flex flex-col">
            {next.length === 0 && <li className="font-display text-[clamp(1.4rem,2.2vw,2.6rem)] text-paper/45">{t.patient.nobodyWaiting}</li>}
            {next.map((n, i) => (
              <li
                key={n}
                className="numeral border-t border-paper/12 py-[1.4vh] first:border-t-0"
                style={{ fontSize: `clamp(2rem, ${Math.max(2.2, 5.4 - i * 0.7)}vw, ${Math.max(3, 7 - i)}rem)`, opacity: 1 - i * 0.14 }}
              >
                {n}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {!connected && (
        <p className="px-[4vw] pb-4 text-lg text-amber-300">{t.staff.reconnecting}</p>
      )}
    </main>
  );
}
