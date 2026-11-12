import type { TicketAction, TicketStatus } from '@queueless/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-store';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
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
}
interface QueueSnapshot {
  servicePointId: string;
  tickets: Ticket[];
}

const newKey = () => crypto.randomUUID();

export function StaffPage() {
  const { token, user, signOut } = useAuth();
  const qc = useQueryClient();
  const [servicePointId, setServicePointId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const points = useQuery({ queryKey: ['service-points'], queryFn: () => api<ServicePoint[]>('/service-points') });
  const active = (points.data ?? []).filter((p) => p.isActive);
  useEffect(() => {
    if (!servicePointId && active.length) setServicePointId(active[0].id);
  }, [servicePointId, active]);

  const queueKey = ['queue', servicePointId];
  const queue = useQuery({
    queryKey: queueKey,
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
  const byStatus = (s: TicketStatus) => tickets.filter((x) => x.status === s);
  const run = (id: string, action: TicketAction) => act.mutate({ id, action, key: newKey() });

  return (
    <main className="mx-auto max-w-5xl p-4 flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t.staff.title}</h1>
        <div className="flex items-center gap-3 text-sm">
          {user?.role === 'CLINIC_ADMIN' && (
            <Link className="underline" to="/admin">
              {t.admin.title}
            </Link>
          )}
          <span className="text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            {t.staff.signOut}
          </Button>
        </div>
      </header>

      {!connected && (
        <p role="status" className="rounded-md bg-amber-100 text-amber-900 px-3 py-2 text-sm">
          {t.staff.reconnecting}
        </p>
      )}
      {notice && (
        <p role="alert" className="rounded-md bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      {points.isSuccess && active.length === 0 && <p>{t.staff.noServicePoints}</p>}

      {active.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp">{t.staff.servicePoint}</Label>
            <select
              id="sp"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={servicePointId ?? ''}
              onChange={(e) => setServicePointId(e.target.value)}
            >
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Button size="lg" disabled={callNext.isPending || byStatus('WAITING').length === 0} onClick={() => callNext.mutate(newKey())}>
            {t.staff.callNext} <kbd className="ml-2 rounded border px-1 text-xs opacity-70">{t.staff.callNextHint}</kbd>
          </Button>
        </div>
      )}

      {servicePointId && (
        <div className="grid gap-4 md:grid-cols-3">
          <Column title={t.staff.called} tickets={byStatus('CALLED')}>
            {(x) => (
              <>
                <Button size="sm" onClick={() => run(x.id, 'start')}>{t.staff.start}</Button>
                <Button size="sm" variant="outline" onClick={() => run(x.id, 'no-show')}>{t.staff.noShow}</Button>
                <Button size="sm" variant="outline" onClick={() => run(x.id, 'skip')}>{t.staff.skip}</Button>
              </>
            )}
          </Column>
          <Column title={t.staff.serving} tickets={byStatus('SERVING')}>
            {(x) => <Button size="sm" onClick={() => run(x.id, 'complete')}>{t.staff.complete}</Button>}
          </Column>
          <Column title={t.staff.waiting} tickets={byStatus('WAITING')}>
            {(x) => (
              <Button size="sm" variant="outline" onClick={() => run(x.id, 'cancel')}>{t.staff.cancel}</Button>
            )}
          </Column>
        </div>
      )}

      {servicePointId && <WalkInForm servicePointId={servicePointId} onDone={onSuccess} onError={onError} />}
    </main>
  );
}

function Column({
  title,
  tickets,
  children,
}: {
  title: string;
  tickets: Ticket[];
  children: (t: Ticket) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title} <Badge variant="secondary">{tickets.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tickets.length === 0 && <p className="text-sm text-muted-foreground">{t.staff.empty}</p>}
        {tickets.map((x) => (
          <div key={x.id} className="flex flex-col gap-2 rounded-md border p-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono font-semibold">{x.number}</span>
              <span className="truncate text-sm">{x.patientName}</span>
            </div>
            <div className="flex flex-wrap gap-2">{children(x)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WalkInForm({
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
    <Card>
      <CardHeader>
        <CardTitle>{t.staff.walkIn}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pname">{t.staff.patientName}</Label>
            <Input id="pname" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pphone">{t.staff.phone}</Label>
            <Input id="pphone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {t.staff.consent}
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={add.isPending || !consent}>
              {t.staff.add}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
