import type { TicketAction, TicketStatus } from '@queueless/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-store';
import { TopBar } from '../components/brand';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/utils';
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
  const byStatus = (s: TicketStatus) => tickets.filter((x) => x.status === s);
  const waiting = byStatus('WAITING');
  const run = (id: string, action: TicketAction) => act.mutate({ id, action, key: newKey() });

  return (
    <div className="min-h-dvh">
      <TopBar>
        {user?.role === 'CLINIC_ADMIN' && <Link to="/admin">{t.admin.title}</Link>}
        <span className="text-white/70">{user?.email}</span>
        <Button variant="quiet" size="sm" onClick={signOut}>
          {t.staff.signOut}
        </Button>
      </TopBar>

      {!connected && (
        <p role="status" className="bg-alarm px-5 py-2 text-center text-[0.8125rem] font-semibold text-white">
          <span className="blink mr-2 inline-block size-2 bg-white align-middle" />
          {t.staff.reconnecting}
        </p>
      )}

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-6">
        {points.isSuccess && active.length === 0 && <p className="text-grey">{t.staff.noServicePoints}</p>}

        {active.length > 0 && (
          <>
            <div className="flex flex-wrap items-stretch justify-between gap-4">
              <div role="tablist" aria-label={t.staff.servicePoint} className="flex flex-wrap gap-2">
                {active.map((p) => (
                  <button
                    key={p.id}
                    role="tab"
                    aria-selected={p.id === servicePointId}
                    onClick={() => setServicePointId(p.id)}
                    className={cn(
                      'h-11 border-2 border-ink px-5 text-[0.9375rem] font-bold',
                      p.id === servicePointId ? 'bg-ink text-white' : 'bg-white hover:bg-mark',
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <p className="text-right leading-none">
                  <span className="num block text-[2.4rem]">{waiting.length}</span>
                  <span className="text-xs font-semibold uppercase">{t.staff.waitingCount}</span>
                </p>
                <Button
                  variant="accent"
                  size="lg"
                  className="h-14 px-6 text-[1.05rem]"
                  disabled={callNext.isPending || waiting.length === 0}
                  onClick={() => callNext.mutate(newKey())}
                >
                  {t.staff.callNext}
                  <kbd className="border border-current px-1.5 py-px font-mono text-[0.6875rem] font-semibold uppercase">
                    {t.staff.callNextHint}
                  </kbd>
                </Button>
              </div>
            </div>

            {notice && (
              <p role="alert" className="mt-4 border-2 border-ink bg-mark px-4 py-2.5 text-sm font-semibold">
                {notice}
              </p>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_0.9fr_1.05fr]">
              <Column title={t.staff.called} highlight tickets={byStatus('CALLED')}>
                {(x) => (
                  <>
                    <Button size="sm" onClick={() => run(x.id, 'start')}>{t.staff.start}</Button>
                    <Button size="sm" variant="ghost" onClick={() => run(x.id, 'no-show')}>{t.staff.noShow}</Button>
                    <Button size="sm" variant="ghost" onClick={() => run(x.id, 'skip')}>{t.staff.skip}</Button>
                  </>
                )}
              </Column>
              <Column title={t.staff.serving} tickets={byStatus('SERVING')}>
                {(x) => <Button size="sm" onClick={() => run(x.id, 'complete')}>{t.staff.complete}</Button>}
              </Column>
              <Column title={t.staff.waiting} tickets={waiting} numbered>
                {(x) => (
                  <Button size="sm" variant="ghost" className="text-grey" onClick={() => run(x.id, 'cancel')}>
                    {t.staff.cancel}
                  </Button>
                )}
              </Column>
            </div>

            {servicePointId && <WalkIn servicePointId={servicePointId} onDone={onSuccess} onError={onError} />}
          </>
        )}
      </main>
    </div>
  );
}

/** One status column as a plain ruled table: number first, name, actions on the right. */
function Column({
  title,
  tickets,
  highlight,
  numbered,
  children,
}: {
  title: string;
  tickets: Ticket[];
  highlight?: boolean;
  numbered?: boolean;
  children: (t: Ticket) => ReactNode;
}) {
  return (
    <section className="border-2 border-ink bg-white">
      <div className={cn('flex items-center justify-between border-b-2 border-ink px-3 py-2', highlight ? 'bg-mark' : 'bg-page')}>
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
        <span className="num text-lg">{tickets.length}</span>
      </div>
      {tickets.length === 0 && <p className="px-3 py-4 text-sm text-grey">{t.staff.empty}</p>}
      <ul>
        {tickets.map((x, i) => (
          <li
            key={x.id}
            data-ticket={x.number}
            className="flex items-center gap-2.5 border-b border-rule px-3 py-2 last:border-b-0"
          >
            {numbered && <span className="num w-4 text-xs text-grey">{i + 1}</span>}
            <span className="num text-[1.4rem]">{x.number}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{x.patientName}</span>
            <div className="flex shrink-0 items-center gap-1">{children(x)}</div>
          </li>
        ))}
      </ul>
    </section>
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
    <section className="mt-10 border-2 border-ink bg-white">
      <div className="border-b-2 border-ink bg-page px-3 py-2">
        <h2 className="text-sm font-bold uppercase tracking-wide">{t.staff.walkIn}</h2>
      </div>
      <form onSubmit={submit} className="grid items-end gap-x-4 gap-y-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pname">{t.staff.patientName}</Label>
          <Input id="pname" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pphone">{t.staff.phone}</Label>
          <Input id="pphone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button type="submit" disabled={add.isPending || !consent}>
          {t.staff.add}
        </Button>
        <label className="flex cursor-pointer items-start gap-2.5 text-[0.8125rem] sm:col-span-3">
          <input type="checkbox" className="mt-0.5 size-4 accent-black" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            {t.staff.consent} <span className="text-grey">{t.staff.walkInHint}</span>
          </span>
        </label>
      </form>
    </section>
  );
}
