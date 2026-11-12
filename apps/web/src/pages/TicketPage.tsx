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
  const serving = v.status === 'SERVING';
  const waiting = v.status === 'WAITING';
  const finished = !called && !serving && !waiting;
  const canCancel = waiting || called;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-5 pb-8 pt-5">
      <div className="flex items-center justify-between">
        <Wordmark className="text-[1.05rem]" />
        <span className="eyebrow">{v.servicePoint}</span>
      </div>

      {!connected && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-md bg-warn-soft px-3 py-2 text-[0.8125rem] text-warn">
          <span className="breathe size-2 rounded-full bg-warn" />
          {t.patient.reconnecting}
        </p>
      )}

      <div className="stub-wrap mt-6">
        <section
          className={cn(
            'stub-top px-7 pb-9 pt-7 text-center transition-colors duration-500',
            called && '!bg-go text-white',
            serving && '!bg-go-soft',
            finished && '!bg-sunken',
          )}
        >
          <p className={cn('eyebrow', called && '!text-white/80')}>{t.patient.yourNumber}</p>
          <p
            key={v.number}
            data-testid="ticket-number"
            className="numeral land mt-3 whitespace-nowrap text-[clamp(5rem,29vw,7.25rem)] leading-[0.85] tracking-[0.02em]"
          >
            {v.number}
          </p>
          {v.patientName && (
            <p className={cn('mt-3 text-sm', called ? 'text-white/85' : 'text-ink-soft')}>{v.patientName}</p>
          )}
        </section>

        <section className="stub-bottom perforation relative px-7 pb-7 pt-6 text-center">
          <Headline v={v} />
          <div className="mx-auto mt-5 flex max-w-[15rem] items-baseline justify-between border-t border-line pt-4">
            <span className="eyebrow">{t.patient.nowServing}</span>
            <span className={cn('numeral text-3xl', !v.nowServing && '!font-sans !text-sm !font-normal text-ink-soft')}>{v.nowServing ?? t.patient.nobodyYet}</span>
          </div>
        </section>
      </div>

      {canCancel && (
        <div className="mt-6 text-center">
          <Button variant="quiet" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            {t.patient.cancel}
          </Button>
        </div>
      )}

      <p className="mx-auto mt-auto max-w-[17rem] pt-10 text-center text-xs leading-relaxed text-ink-soft">
        {t.patient.keepLink}
      </p>
    </main>
  );
}

function Headline({ v }: { v: TicketView }) {
  if (v.status === 'CALLED') {
    return (
      <>
        <p className="font-display text-[1.85rem] font-semibold leading-tight text-go">{t.patient.yourTurnTitle}</p>
        <p className="mt-1 text-sm text-ink-soft">{t.patient.yourTurnBody}</p>
      </>
    );
  }
  if (v.status === 'SERVING') {
    return <p className="font-display text-[1.6rem] font-semibold leading-tight">{t.patient.beingServed}</p>;
  }
  if (v.status === 'WAITING') {
    if (v.peopleAhead === 0) {
      return (
        <>
          <p className="font-display text-[1.85rem] font-semibold leading-tight">{t.patient.nextInLine}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.patient.nextInLineBody}</p>
        </>
      );
    }
    return (
      <div className="flex items-baseline justify-center gap-3">
        <span className="numeral text-[4rem]">{v.peopleAhead}</span>
        <span className="text-left font-display text-lg leading-tight">
          {v.peopleAhead === 1 ? t.patient.personAhead : t.patient.peopleAhead}
        </span>
      </div>
    );
  }
  return (
    <p className="font-display text-[1.5rem] font-semibold leading-snug">
      {t.patient.finished[v.status as 'SERVED' | 'SKIPPED' | 'NO_SHOW' | 'CANCELLED']}
    </p>
  );
}

function Notice({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
      <Wordmark />
      {title && <h1 className="mt-4 text-2xl font-semibold">{title}</h1>}
      <p className="text-ink-soft">{children}</p>
    </main>
  );
}
