import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Wordmark } from '../components/brand';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { usePublicSocket } from '../lib/usePublicSocket';
import { t } from '../strings';

interface TicketView {
  clinicSlug: string;
  servicePointCode: string;
  number: string;
  status: 'WAITING' | 'CALLED' | 'SERVING' | 'SERVED' | 'SKIPPED' | 'NO_SHOW' | 'CANCELLED';
  patientName: string | null;
  servicePoint: string;
  peopleAhead: number;
  nowServing: string | null;
}

/** US-6 / US-7: the patient's live ticket. The link itself is the credential, so keep it private. */
export function TicketPage() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['ticket', token],
    queryFn: () => api<TicketView>(`/public/t/${token}`, { auth: false }),
    retry: false,
    refetchInterval: 30_000, // safety net if a socket hint is ever missed
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['ticket', token] });
  const { connected } = usePublicSocket(q.data?.clinicSlug ?? null, q.data?.servicePointCode ?? null, refresh);
  const cancel = useMutation({
    mutationFn: () => api(`/public/t/${token}/cancel`, { method: 'POST', body: {}, auth: false }),
    onSettled: refresh,
  });

  if (q.isError) return <Notice title={t.patient.ticketNotFoundTitle}>{t.patient.ticketNotFound}</Notice>;
  if (!q.data) return <Notice>{t.patient.loading}</Notice>;
  const v = q.data;

  const called = v.status === 'CALLED';
  const waiting = v.status === 'WAITING';
  const canCancel = waiting || called;

  return (
    // When it is your turn the whole screen goes yellow, so you notice it from across the room.
    <div className={cn('min-h-dvh transition-colors duration-200', called ? 'bg-mark' : 'bg-page')}>
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-5 pb-8 pt-5">
        <div className="flex items-center justify-between">
          <Wordmark className="text-base" />
          <span className="font-mono text-xs font-semibold uppercase">{v.servicePoint}</span>
        </div>

        {!connected && (
          <p role="status" className="mt-4 border-2 border-ink bg-white px-3 py-2 text-[0.8125rem] font-medium">
            <span className="blink mr-2 inline-block size-2 bg-alarm align-middle" />
            {t.patient.reconnecting}
          </p>
        )}

        {called && (
          <p className="mt-6 text-[2.1rem] font-bold leading-[1.05]">
            {t.patient.yourTurnTitle}
            <span className="mt-1 block text-lg font-medium">{t.patient.yourTurnBody}</span>
          </p>
        )}

        <div className={cn('receipt-wrap', called ? 'mt-6' : 'mt-8')}>
          <section className="receipt px-6 pb-8 pt-9 font-mono">
            <p className="text-center text-xs font-semibold uppercase tracking-widest">{v.servicePoint}</p>
            <div className="dots my-3" />
            <p className="text-center text-[0.8125rem] uppercase">{t.patient.yourNumber}</p>
            <p
              key={v.number}
              data-testid="ticket-number"
              className="num tick my-1 whitespace-nowrap text-center text-[clamp(3.6rem,19vw,5rem)] leading-none"
            >
              {v.number}
            </p>
            {v.patientName && <p className="text-center text-sm">{v.patientName}</p>}
            <div className="dots my-4" />

            <dl className="space-y-2 text-[0.9375rem]">
              {waiting && (
                <div className="flex items-baseline justify-between">
                  <dt className="uppercase">{t.patient.aheadOfYou}</dt>
                  <dd className="num text-3xl">{v.peopleAhead}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <dt className="uppercase">{t.patient.nowServing}</dt>
                <dd className="num text-3xl">{v.nowServing ?? '--'}</dd>
              </div>
            </dl>

            <div className="dots my-4" />
            <p className="text-center text-sm font-semibold uppercase leading-snug">
              <StatusLine v={v} />
            </p>
          </section>
        </div>

        {canCancel && (
          <div className="mt-5 text-center">
            <Button variant="quiet" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {t.patient.cancel}
            </Button>
          </div>
        )}

        <p className="mt-auto max-w-[19rem] pt-10 text-xs leading-relaxed text-grey">{t.patient.keepLink}</p>
      </main>
    </div>
  );
}

function StatusLine({ v }: { v: TicketView }) {
  if (v.status === 'CALLED') return <>{t.patient.yourTurn}</>;
  if (v.status === 'SERVING') return <>{t.patient.beingServed}</>;
  if (v.status === 'WAITING') {
    return v.peopleAhead === 0 ? <>{t.patient.nextInLine}</> : <>{t.patient.pleaseWait}</>;
  }
  return <>{t.patient.finished[v.status as 'SERVED' | 'SKIPPED' | 'NO_SHOW' | 'CANCELLED']}</>;
}

function Notice({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-start justify-center gap-3 px-6">
      <Wordmark />
      {title && <h1 className="mt-6 text-3xl">{title}</h1>}
      <p className="text-grey">{children}</p>
    </main>
  );
}
