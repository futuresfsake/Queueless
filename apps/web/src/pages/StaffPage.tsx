import type { TicketAction, TicketStatus } from '@queueless/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Clock, Phone, UserPlus, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../auth/auth-store';
import { Alert, EmptyState, Skeleton } from '../components/feedback';
import { AppShell, PageHeader } from '../components/shell';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input, Select } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, ApiError } from '../lib/api';
import { useQueueSocket } from '../lib/useQueueSocket';
import { t } from '../strings';

interface ServicePoint {
  id: string;
  name: string;
  isActive: boolean;
}
interface Ticket {
  id: string;
  number: string;
  status: TicketStatus;
  patientName: string;
  issuedAt: string;
}
interface QueueSnapshot {
  servicePointId: string;
  tickets: Ticket[];
}

const newKey = () => crypto.randomUUID();

/** Whole minutes since the ticket was issued, re-evaluated every 30 s so the list stays honest. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

export function StaffPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const now = useNow();
  const [servicePointId, setServicePointId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const points = useQuery({ queryKey: ['service-points'], queryFn: () => api<ServicePoint[]>('/service-points') });
  const active = (points.data ?? []).filter((p) => p.isActive);
  useEffect(() => {
    if (!servicePointId && active.length) setServicePointId(active[0].id);
  }, [servicePointId, active]);

  const queue = useQuery({
    queryKey: ['queue', servicePointId],
    queryFn: () => api<QueueSnapshot>(`/queue/${servicePointId}`),
    enabled: !!servicePointId,
  });
  const refetch = () => void qc.invalidateQueries({ queryKey: ['queue'] });
  const { connected } = useQueueSocket(token, servicePointId, refetch);

  const onError = (e: unknown) => {
    // A 409 means another desk got there first (or the queue is empty): show the truth, not an error.
    setNotice(
      e instanceof ApiError && e.code === 'QUEUE_EMPTY'
        ? t.staff.queueEmpty
        : e instanceof ApiError && e.code === 'QUEUE_FULL'
          ? t.staff.queueFull
          : t.staff.actionFailed,
    );
    refetch();
  };
  const onSuccess = () => {
    setNotice(null);
    refetch();
  };

  // The idempotency key is created per click, so a double-tap sends two different requests only if
  // the user really pressed twice; a network retry of one click reuses the same key.
  const callNext = useMutation({
    mutationFn: (key: string) =>
      api(`/queue/${servicePointId}/call-next`, { method: 'POST', body: {}, idempotencyKey: key }),
    onSuccess,
    onError,
  });
  const act = useMutation({
    mutationFn: (v: { id: string; action: TicketAction; key: string }) =>
      api(`/tickets/${v.id}/${v.action}`, { method: 'POST', body: {}, idempotencyKey: v.key }),
    onSuccess,
    onError,
  });

  // Space = Call next (ignored while typing in a field or when a button has focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code !== 'Space' || e.repeat || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return;
      e.preventDefault();
      if (servicePointId && !callNext.isPending) callNext.mutate(newKey());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [servicePointId, callNext]);

  const tickets = queue.data?.tickets ?? [];
  const by = (s: TicketStatus) => tickets.filter((x) => x.status === s);
  const waiting = by('WAITING');
  const atDesk = tickets.filter((x) => x.status === 'CALLED' || x.status === 'SERVING');
  const longest = waiting.length ? Math.max(...waiting.map((x) => minutesSince(x.issuedAt, now))) : 0;
  const run = (id: string, action: TicketAction) => act.mutate({ id, action, key: newKey() });
  const loading = points.isLoading || (!!servicePointId && queue.isLoading);

  return (
    <AppShell>
      <PageHeader
        title={t.staff.title}
        description={t.staff.subtitle}
        actions={
          active.length > 0 && (
            <>
              <LiveBadge connected={connected} />
              {active.length > 1 && (
                <Select
                  aria-label={t.staff.servicePoint}
                  className="h-10 w-52"
                  value={servicePointId ?? ''}
                  onChange={(e) => setServicePointId(e.target.value)}
                >
                  {active.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
              <Button
                variant="primary"
                size="md"
                disabled={callNext.isPending || waiting.length === 0}
                onClick={() => callNext.mutate(newKey())}
              >
                <Bell />
                {t.staff.callNext}
                <kbd className="rounded border border-white/40 px-1.5 text-[0.6875rem] font-medium leading-4">{t.staff.callNextHint}</kbd>
              </Button>
            </>
          )
        }
      />

      {!connected && (
        <Alert tone="warn" className="mb-4">
          {t.staff.reconnecting}
        </Alert>
      )}
      {notice && (
        <Alert tone="info" className="mb-4">
          {notice}
        </Alert>
      )}
      {points.isSuccess && active.length === 0 && <Alert tone="info">{t.staff.noServicePoints}</Alert>}

      {active.length > 0 && (
        <>
          <dl className="mb-6 grid grid-cols-3 gap-3">
            <Stat label={t.staff.waitingCount} value={loading ? null : waiting.length} />
            <Stat label={t.staff.atDeskCount} value={loading ? null : atDesk.length} />
            <Stat label={t.staff.longestWait} value={loading ? null : waiting.length ? `${longest} min` : '-'} />
          </dl>

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t.staff.atDesk}</CardTitle>
                    <CardDescription>{t.staff.atDeskHint}</CardDescription>
                  </div>
                </CardHeader>
                {loading ? (
                  <RowsSkeleton />
                ) : atDesk.length === 0 ? (
                  <EmptyState title={t.staff.deskEmpty}>{t.staff.deskEmptyHint}</EmptyState>
                ) : (
                  <ul>
                    {atDesk.map((x) => (
                      <Row key={x.id} ticket={x}>
                        {x.status === 'CALLED' ? (
                          <>
                            <Badge tone="brand">
                              <Bell /> {t.staff.statusCalled}
                            </Badge>
                            <Button size="sm" variant="primary" onClick={() => run(x.id, 'start')}>
                              {t.staff.start}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => run(x.id, 'no-show')}>
                              {t.staff.noShow}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => run(x.id, 'skip')}>
                              {t.staff.skip}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge tone="ok">
                              <CheckCircle2 /> {t.staff.statusServing}
                            </Badge>
                            <Button size="sm" variant="primary" onClick={() => run(x.id, 'complete')}>
                              {t.staff.complete}
                            </Button>
                          </>
                        )}
                      </Row>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t.staff.waiting}</CardTitle>
                    <CardDescription>{t.staff.waitingHint}</CardDescription>
                  </div>
                </CardHeader>
                {loading ? (
                  <RowsSkeleton />
                ) : waiting.length === 0 ? (
                  <EmptyState title={t.staff.waitingEmpty}>{t.staff.waitingEmptyHint}</EmptyState>
                ) : (
                  <ul>
                    {waiting.map((x, i) => (
                      <Row key={x.id} ticket={x} position={i + 1}>
                        <span className="flex items-center gap-1.5 text-[0.8125rem] text-text-2">
                          <Clock className="size-3.5" />
                          {minutesSince(x.issuedAt, now)} min
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => run(x.id, 'cancel')}>
                          {t.staff.cancel}
                        </Button>
                      </Row>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {servicePointId && <WalkIn servicePointId={servicePointId} onDone={onSuccess} onError={onError} />}
          </div>
        </>
      )}
    </AppShell>
  );
}

function LiveBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge tone="ok">
      <span className="pulse-dot size-1.5 rounded-full bg-ok" />
      <Wifi className="hidden" />
      {t.staff.live}
    </Badge>
  ) : (
    <Badge tone="warn">
      <WifiOff />
      {t.staff.offline}
    </Badge>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
      <dt className="text-xs font-medium text-text-2">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums leading-none">
        {value === null ? <Skeleton className="h-6 w-10" /> : value}
      </dd>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-3 p-5">
      <Skeleton className="h-9" />
      <Skeleton className="h-9" />
    </div>
  );
}

/** One patient: position (when queued), ticket number, name, then whatever actions apply. */
function Row({ ticket, position, children }: { ticket: Ticket; position?: number; children: ReactNode }) {
  return (
    <li
      data-ticket={ticket.number}
      className="fade-in flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3 last:border-b-0"
    >
      {position !== undefined && <span className="w-5 text-[0.8125rem] tabular-nums text-text-3">{position}</span>}
      <span className="ticket-no w-[4.5rem] text-lg">{ticket.number}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{ticket.patientName}</span>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
    </li>
  );
}

function WalkIn({
  servicePointId,
  onDone,
  onError,
}: {
  servicePointId: string;
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [key, setKey] = useState(newKey); // new key per submitted action; kept on failure so a retry is safe

  const add = useMutation({
    mutationFn: () =>
      api(`/queue/${servicePointId}/tickets`, {
        method: 'POST',
        body: { patientName: name, phone: phone || undefined, consent },
        idempotencyKey: key,
      }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setConsent(false);
      setKey(newKey());
      onDone();
    },
    onError,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-text-2" />
            {t.staff.walkIn}
          </CardTitle>
          <CardDescription>{t.staff.walkInHint}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pname">{t.staff.patientName}</Label>
            <Input id="pname" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pphone">{t.staff.phone}</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
              <Input id="pphone" inputMode="tel" className="pl-9" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[0.8125rem] leading-relaxed text-text-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t.staff.consent}
          </label>
          <Button type="submit" variant="primary" disabled={add.isPending || !consent || !name.trim()}>
            {t.staff.add}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
