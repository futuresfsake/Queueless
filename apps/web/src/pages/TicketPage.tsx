import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCircle2, Clock, Stethoscope, XCircle } from 'lucide-react';
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
        <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-ok-line bg-ok-soft p-4">
          <BellRing className="mt-0.5 size-6 shrink-0 text-ok" />
          <div>
            <p className="text-lg font-semibold text-ok">{t.patient.yourTurnTitle}</p>
            <p className="text-sm text-text">{t.patient.yourTurnBody}</p>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-line bg-surface p-6 text-center shadow-card">
        <StatusBadge status={v.status} />
        <p className="mt-5 text-sm text-text-2">{t.patient.yourNumber}</p>
        <p
          key={v.number}
          data-testid="ticket-number"
          className="ticket-no fade-in mt-1 whitespace-nowrap text-[clamp(3.25rem,18vw,4.5rem)] leading-none"
        >
          {v.number}
        </p>
        {v.patientName && <p className="mt-3 text-[0.9375rem] text-text-2">{v.patientName}</p>}

        {(waiting || called || serving) && (
          <dl className="mt-6 grid grid-cols-2 divide-x divide-line rounded-lg border border-line bg-canvas">
            {waiting ? (
              <Figure label={t.patient.aheadOfYou} value={String(v.peopleAhead)} />
            ) : (
              <Figure label={t.patient.status} value={called ? t.patient.statusCalled : t.patient.statusServing} />
            )}
            <Figure label={t.patient.nowServing} value={v.nowServing ?? t.patient.nobodyYet} />
          </dl>
        )}

        <p className="mt-5 text-sm text-text-2">
          <StatusLine v={v} />
        </p>
      </section>

      {canCancel && (
        <div className="mt-5">
          {!confirming ? (
            <Button variant="ghost" className="w-full" onClick={() => setConfirming(true)}>
              {t.patient.cancel}
            </Button>
          ) : (
            <div className="rounded-lg border border-danger-line bg-surface p-4">
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

      <p className="mt-8 text-center text-xs leading-relaxed text-text-3">{t.patient.keepLink}</p>
    </Frame>
  );
}

function StatusBadge({ status }: { status: TicketView['status'] }) {
  switch (status) {
    case 'WAITING':
      return (
        <Badge tone="neutral">
          <Clock /> {t.patient.statusWaiting}
        </Badge>
      );
    case 'CALLED':
      return (
        <Badge tone="ok">
          <BellRing /> {t.patient.statusCalled}
        </Badge>
      );
    case 'SERVING':
      return (
        <Badge tone="brand">
          <Stethoscope /> {t.patient.statusServing}
        </Badge>
      );
    case 'SERVED':
      return (
        <Badge tone="ok">
          <CheckCircle2 /> {t.patient.statusDone}
        </Badge>
      );
    default:
      return (
        <Badge tone="neutral">
          <XCircle /> {t.patient.statusClosed}
        </Badge>
      );
  }
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3">
      <dt className="text-xs text-text-2">{label}</dt>
      <dd className="ticket-no mt-0.5 text-xl">{value}</dd>
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
    <main className={cn('mx-auto min-h-dvh max-w-md px-4 pb-10 pt-6')}>
      <div className="mb-6">{clinic ? <ClinicHeader name={clinic} sub={sub} /> : <p className="text-sm font-medium text-text-2">Queueless</p>}</div>
      {children}
      <PoweredBy />
    </main>
  );
}
