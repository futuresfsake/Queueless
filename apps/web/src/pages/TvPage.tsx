import { useQuery, useQueryClient } from '@tanstack/react-query';
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

/** US-16: the waiting-room TV. Numbers only, never names. Big text, high contrast. */
export function TvPage() {
  const { slug = '', code = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['display', slug, code],
    queryFn: () => api<Display>(`/public/c/${slug}/service-points/${code}/display`, { auth: false }),
    retry: false,
    refetchInterval: 15_000,
  });
  const { connected } = usePublicSocket(slug, code, () => void qc.invalidateQueries({ queryKey: ['display', slug, code] }));

  if (q.isError) return <main className="min-h-screen grid place-items-center bg-black text-white text-3xl">{t.patient.queueNotFound}</main>;
  const d = q.data;
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-10 p-8">
      <p className="text-3xl text-neutral-300">
        {d?.clinic} · {d?.servicePoint}
      </p>
      <section className="text-center">
        <p className="text-4xl uppercase tracking-widest text-neutral-400">{t.patient.nowServing}</p>
        <p className="font-mono font-bold text-[10rem] leading-none" data-testid="now-serving">
          {d?.nowServing ?? '—'}
        </p>
      </section>
      <section className="text-center">
        <p className="text-3xl uppercase tracking-widest text-neutral-400">{t.patient.nextUp}</p>
        <p className="mt-2 font-mono text-5xl flex flex-wrap justify-center gap-x-8 gap-y-2">
          {d?.nextUp.length ? d.nextUp.map((n) => <span key={n}>{n}</span>) : <span className="text-neutral-500">—</span>}
        </p>
      </section>
      {!connected && <p className="text-amber-300 text-xl">{t.staff.reconnecting}</p>}
    </main>
  );
}
