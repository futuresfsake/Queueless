import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ClinicHeader, PoweredBy } from '../components/brand';
import { Alert, Skeleton } from '../components/feedback';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { usePublicSocket } from '../lib/usePublicSocket';
import { t } from '../strings';

interface TicketView {
  clinicName: string;
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
  const [confirming, setConfirming] = useState(false);
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
    onSettled: () => {
      setConfirming(false);
      refresh();
    },
  });

  if (q.isError) {
    return (
      <Frame>
        <h1 className="text-2xl">{t.patient.ticketNotFoundTitle}</h1>
        <p className="mt-2 text-text-2">{t.patient.ticketNotFound}</p>
      </Frame>
    );
  }
  if (!q.data) {
    return (
      <Frame>
        <Skeleton className="h-52" />
        <Skeleton className="mt-4 h-24" />
      </Frame>
    );
  }
  const v = q.data;
  const called = v.status === 'CALLED';
  const waiting = v.status === 'WAITING';
  const serving = v.status === 'SERVING';
  const canCancel = waiting || called;

  return (
    <Frame clinic={v.clinicName} sub={v.servicePoint}>
      {!connected && (
        <Alert tone="warn" className="mb-4">
          {t.patient.reconnecting}
        </Alert>
      )}

      {/* the one thing to know right now */}
      {called && (
        <div role="status" className="mb-4 flex items-center gap-3 rounded-md bg-ok px-4 py-3.5 text-white">
          <BellRing className="size-6 shrink-0" />
          <div>
            <p className="text-lg font-semibold leading-tight">{t.patient.yourTurnTitle}</p>
            <p className="text-sm text-white/90">{t.patient.yourTurnBody}</p>
          </div>
        </div>
      )}

      {/* laid out like the paper stub it replaces: number on top, a tear line, the details under it */}
      <section className="rounded-md border border-line-strong bg-surface">
        <div className="px-5 pb-6 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="caption">{t.patient.yourNumber}</p>
            <StatusBadge status={v.status} />
          </div>
          <p
            key={v.number}
            data-testid="ticket-number"
            className="ticket-no fade-in mt-4 whitespace-nowrap text-[clamp(3.25rem,19vw,4.75rem)] leading-none"
          >
            {v.number}
          </p>
          {v.patientName && <p className="mt-3 text-[0.9375rem] text-text-2">{v.patientName}</p>}
        </div>

        {(waiting || called || serving) && (
          <dl className="perforation grid grid-cols-2 divide-x divide-line">
            {waiting ? (
              <Figure label={t.patient.aheadOfYou} value={String(v.peopleAhead)} />
            ) : (
              <Figure label={t.patient.status} value={called ? t.patient.statusCalled : t.patient.statusServing} plain />
            )}
            <Figure label={t.patient.nowServing} value={v.nowServing ?? t.patient.nobodyYet} plain={!v.nowServing} />
          </dl>
        )}

        <p className="perforation px-5 py-3.5 text-sm text-text-2">
          <StatusLine v={v} />
        </p>
      </section>

      {canCancel && (
        <div className="mt-5">
          {!confirming ? (
            <Button variant="secondary" className="h-11 w-full" onClick={() => setConfirming(true)}>
              {t.patient.cancel}
            </Button>
          ) : (
            <div className="rounded-md border border-danger-line bg-surface p-4">
              <p className="text-sm font-medium">{t.patient.cancelConfirm}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  {t.patient.keepPlace}
                </Button>
                <Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                  {t.patient.confirmCancel}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-text-3">{t.patient.keepLink}</p>
    </Frame>
  );
}

function StatusBadge({ status }: { status: TicketView['status'] }) {
  switch (status) {
    case 'WAITING':
      return <Badge tone="neutral">{t.patient.statusWaiting}</Badge>;
    case 'CALLED':
      return <Badge tone="ok">{t.patient.statusCalled}</Badge>;
    case 'SERVING':
      return <Badge tone="brand">{t.patient.statusServing}</Badge>;
    case 'SERVED':
      return <Badge tone="ok">{t.patient.statusDone}</Badge>;
    default:
      return <Badge tone="neutral">{t.patient.statusClosed}</Badge>;
  }
}

/** `plain` is for values that are words, not queue numbers, so they stay in the text face. */
function Figure({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="px-5 py-3.5">
      <dt className="caption">{label}</dt>
      <dd className={cn('mt-1 text-2xl leading-tight', plain ? 'font-semibold' : 'ticket-no')}>{value}</dd>
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

function Frame({ children, clinic, sub }: { children: ReactNode; clinic?: string; sub?: string }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-5">
      <div className="mb-5 border-b border-line pb-4">{clinic ? <ClinicHeader name={clinic} sub={sub} /> : <p className="text-sm font-medium text-text-2">Queueless</p>}</div>
      {children}
      <PoweredBy />
    </main>
  );
}
