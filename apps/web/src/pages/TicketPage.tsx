import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { usePublicSocket } from '../lib/usePublicSocket';
import { t } from '../strings';

interface TicketView {
  clinicSlug: string;
  servicePointCode: string;
  number: string;
  status: 'WAITING' | 'CALLED' | 'SERVING' | 'SERVED' | 'SKIPPED' | 'NO_SHOW' | 'CANCELLED';
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

  if (q.isError) return <Centered>{t.patient.ticketNotFound}</Centered>;
  if (!q.data) return <Centered>{t.patient.loading}</Centered>;
  const v = q.data;
  const headline =
    v.status === 'CALLED'
      ? t.patient.yourTurn
      : v.status === 'SERVING'
        ? t.patient.beingServed
        : v.status === 'WAITING'
          ? v.peopleAhead === 0
            ? t.patient.nextInLine
            : `${v.peopleAhead} ${v.peopleAhead === 1 ? t.patient.personAhead : t.patient.peopleAhead}`
          : t.patient.finished[v.status as 'SERVED' | 'SKIPPED' | 'NO_SHOW' | 'CANCELLED'];

  return (
    <main className="mx-auto max-w-md min-h-screen p-4 flex flex-col items-center gap-4 text-center">
      {!connected && (
        <p role="status" className="w-full rounded-md bg-amber-100 text-amber-900 px-3 py-2 text-sm">
          {t.staff.reconnecting}
        </p>
      )}
      <p className="text-muted-foreground">{v.servicePoint}</p>
      <p className="text-6xl font-bold font-mono" data-testid="ticket-number">
        {v.number}
      </p>
      <Badge variant={v.status === 'CALLED' ? 'default' : 'secondary'} className="text-base px-3 py-1">
        {headline}
      </Badge>
      <p className="text-sm text-muted-foreground">
        {t.patient.nowServing}: {v.nowServing ?? t.patient.nobodyYet}
      </p>
      {(v.status === 'WAITING' || v.status === 'CALLED') && (
        <Button variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
          {t.patient.cancel}
        </Button>
      )}
      <p className="text-xs text-muted-foreground max-w-xs">{t.patient.keepLink}</p>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center p-6 text-center">{children}</main>;
}
