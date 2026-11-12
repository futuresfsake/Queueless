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
        {user?.role === 'CLINIC_ADMIN' && (
          <Link className="text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink" to="/admin">
            {t.admin.title}
          </Link>
        )}
        <span className="text-ink-soft">{user?.email}</span>
        <Button variant="quiet" size="sm" onClick={signOut}>
          {t.staff.signOut}
        </Button>
      </TopBar>

      {!connected && (
        <p role="status" className="flex items-center justify-center gap-2 bg-warn-soft px-5 py-2 text-[0.8125rem] font-medium text-warn">
          <span className="breathe size-2 rounded-full bg-warn" />
          {t.staff.reconnecting}
        </p>
      )}

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-7">
        {points.isSuccess && active.length === 0 && <p className="text-ink-soft">{t.staff.noServicePoints}</p>}

        {active.length > 0 && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
              <div>
                <p className="eyebrow">{t.staff.servicePoint}</p>
                {active.length <= 4 ? (
                  <div role="tablist" className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                    {active.map((p) => (
                      <button
                        key={p.id}
                        role="tab"
                        aria-selected={p.id === servicePointId}
                        onClick={() => setServicePointId(p.id)}
                        className={cn(
                          'border-b-2 pb-1 font-display text-[1.75rem] font-semibold leading-tight transition-colors',
                          p.id === servicePointId ? 'border-accent text-ink' : 'border-transparent text-ink-soft/70 hover:text-ink',
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <select
                    aria-label={t.staff.servicePoint}
                    className="mt-2 h-11 rounded-md border border-line-strong bg-surface px-3 font-display text-xl"
                    value={servicePointId ?? ''}
                    onChange={(e) => setServicePointId(e.target.value)}
                  >
                    {active.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="numeral text-[2.6rem]">{waiting.length}</p>
                  <p className="eyebrow -mt-0.5">{t.staff.waitingCount}</p>
                </div>
                <Button
                  variant="accent"
                  size="lg"
                  className="h-14 px-7 text-[1.05rem]"
                  disabled={callNext.isPending || waiting.length === 0}
                  onClick={() => callNext.mutate(newKey())}
                >
                  {t.staff.callNext}
                  <kbd className="rounded-[3px] border border-white/40 px-1.5 py-px font-num text-[0.75rem] font-semibold uppercase tracking-wider text-white/90">
                    {t.staff.callNextHint}
                  </kbd>
                </Button>
              </div>
            </div>

            {notice && (
              <p role="alert" className="mt-5 border-l-[3px] border-accent bg-surface px-4 py-2.5 text-sm">
                {notice}
              </p>
            )}

            <div className="mt-8 grid gap-x-10 gap-y-10 lg:grid-cols-[1.5fr_0.85fr_1.05fr]">
              <Column title={t.staff.called} tone="go" tickets={byStatus('CALLED')}>
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
                  <Button size="sm" variant="ghost" className="text-ink-soft" onClick={() => run(x.id, 'cancel')}>
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

/** One status column as a ledger: ruled rows, number first, actions on the right. */
function Column({
  title,
  tickets,
  tone,
  numbered,
  children,
}: {
  title: string;
  tickets: Ticket[];
  tone?: 'go';
  numbered?: boolean;
  children: (t: Ticket) => ReactNode;
}) {
  return (
    <section>
      <div className={cn('flex items-baseline justify-between border-t-[1.5px] pt-2.5', tone === 'go' ? 'border-go' : 'border-ink')}>
        <h2 className="eyebrow !text-ink">{title}</h2>
        <span className="numeral text-xl text-ink-soft">{tickets.length}</span>
      </div>
      {tickets.length === 0 && <p className="py-5 text-sm text-ink-soft">{t.staff.empty}</p>}
      <ul>
        {tickets.map((x, i) => (
          <li
            key={x.id}
            data-ticket={x.number}
            className={cn('flex items-center gap-3 border-b border-line py-3', tone === 'go' && 'border-l-[3px] border-l-go bg-go-soft/50 pl-3')}
          >
            {numbered && <span className="numeral w-4 text-sm text-ink-soft/70">{i + 1}</span>}
            <span className="numeral text-[1.9rem]">{x.number}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{x.patientName}</span>
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
    <section className="mt-14">
      <div className="rule-strong pt-3">
        <h2 className="text-xl font-semibold">{t.staff.walkIn}</h2>
        <p className="mt-0.5 text-[0.8125rem] text-ink-soft">{t.staff.walkInHint}</p>
      </div>
      <form onSubmit={submit} className="mt-4 grid items-end gap-x-4 gap-y-4 sm:grid-cols-[1fr_1fr_auto]">
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
        <label className="flex cursor-pointer items-start gap-2.5 text-[0.8125rem] text-ink-soft sm:col-span-3">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          {t.staff.consent}
        </label>
      </form>
    </section>
  );
}
