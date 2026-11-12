import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-store';
import { TopBar } from '../components/brand';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, ApiError } from '../lib/api';
import { t } from '../strings';

interface ServicePoint {
  id: string;
  name: string;
  code: string;
  prefix: string;
  isActive: boolean;
}
interface StaffUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
}
interface Slot {
  id: string;
  servicePointId: string;
  startsAt: string;
  capacity: number;
  bookedCount: number;
}

const msg = (e: unknown) =>
  e instanceof ApiError
    ? e.code === 'CONFLICT'
      ? t.admin.duplicate
      : e.code === 'VALIDATION_FAILED'
        ? t.admin.invalid
        : t.admin.failed
    : e
      ? t.admin.failed
      : null;

/** Clinic Admin setup screen: service points, staff accounts, booking slots. The API enforces the role. */
export function AdminPage() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const points = useQuery({ queryKey: ['admin', 'sp'], queryFn: () => api<ServicePoint[]>('/service-points') });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api<StaffUser[]>('/users') });
  const slots = useQuery({ queryKey: ['admin', 'slots'], queryFn: () => api<Slot[]>('/slots') });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] });
  const slug = user?.tenantSlug ?? '';

  return (
    <div className="min-h-dvh">
      <TopBar>
        <Link className="text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink" to="/staff">
          {t.staff.title}
        </Link>
        <span className="text-ink-soft">{user?.email}</span>
        <Button variant="quiet" size="sm" onClick={signOut}>
          {t.staff.signOut}
        </Button>
      </TopBar>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8">
        <p className="eyebrow">{t.admin.eyebrow}</p>
        <h1 className="mt-1 text-[2.4rem] font-semibold">{t.admin.title}</h1>
        {slug && (
          <p className="mt-2 text-sm text-ink-soft">
            {t.admin.patientLink}{' '}
            <a className="font-medium text-ink underline decoration-accent decoration-2 underline-offset-4" href={`/c/${slug}`} target="_blank" rel="noreferrer">
              {window.location.host}/c/{slug}
            </a>
          </p>
        )}

        <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-2">
          <Section title={t.admin.servicePoints} hint={t.admin.servicePointsHint}>
            <ul>
              {(points.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-line py-2.5">
                  <span className="numeral w-9 text-[1.6rem]">{p.prefix}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="font-mono text-xs text-ink-soft">{p.code}</span>
                  </span>
                  {!p.isActive && <Badge>{t.admin.inactive}</Badge>}
                  {slug && (
                    <a
                      className="text-sm text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink"
                      href={`/tv/${slug}/${p.code}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.admin.openTv}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <NewServicePoint onDone={refresh} />
          </Section>

          <Section title={t.admin.staff} hint={t.admin.staffHint}>
            <ul>
              {(users.data ?? []).map((u) => (
                <StaffRow key={u.id} u={u} onDone={refresh} />
              ))}
            </ul>
            <NewStaff onDone={refresh} />
          </Section>
        </div>

        <div className="mt-12">
          <Section title={t.admin.slots} hint={t.admin.slotsHint}>
            <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {(slots.data ?? []).slice(-12).map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5">
                  <span>
                    <span className="numeral text-[1.4rem]">
                      {new Date(s.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className="ml-2 text-xs text-ink-soft">
                      {new Date(s.startsAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {points.data?.find((p) => p.id === s.servicePointId)?.name}
                    </span>
                  </span>
                  <span className="numeral text-lg">
                    {s.bookedCount}
                    <span className="text-ink-soft">/{s.capacity}</span>
                  </span>
                </li>
              ))}
            </ul>
            <NewSlot points={(points.data ?? []).filter((p) => p.isActive)} onDone={refresh} />
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="rule-strong pt-3">
        <h2 className="text-[1.45rem] font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-[0.8125rem] text-ink-soft">{hint}</p>}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

const FormError = ({ error }: { error: unknown }) =>
  msg(error) ? (
    <p role="alert" className="text-sm font-medium text-alarm">
      {msg(error)}
    </p>
  ) : null;

function NewServicePoint({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [prefix, setPrefix] = useState('');
  const create = useMutation({
    mutationFn: () => api('/service-points', { body: { name, code, prefix: prefix.toUpperCase() } }),
    onSuccess: () => {
      setName('');
      setCode('');
      setPrefix('');
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-md border border-line bg-surface/60 p-4">
      <p className="eyebrow !text-ink">{t.admin.newServicePoint}</p>
      <Input aria-label={t.admin.spName} placeholder={t.admin.spName} required value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-[1fr_8.5rem] gap-3">
        <Input aria-label={t.admin.spCode} placeholder={t.admin.spCode} required pattern="[a-z0-9\-]{1,40}" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input aria-label={t.admin.spPrefix} placeholder={t.admin.spPrefix} required pattern="[A-Za-z]{1,3}" maxLength={3} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
      </div>
      <FormError error={create.error} />
      <Button type="submit" size="sm" className="justify-self-start" disabled={create.isPending}>
        {t.admin.add}
      </Button>
    </form>
  );
}

function StaffRow({ u, onDone }: { u: StaffUser; onDone: () => void }) {
  const toggle = useMutation({
    mutationFn: () => api(`/users/${u.id}`, { method: 'PATCH', body: { isActive: !u.isActive } }),
    onSuccess: onDone,
  });
  return (
    <li className="flex items-center gap-3 border-b border-line py-2.5">
      <span className="min-w-0 flex-1 truncate">{u.email}</span>
      <Badge variant={u.role === 'CLINIC_ADMIN' ? 'accent' : 'secondary'}>{u.role === 'CLINIC_ADMIN' ? t.admin.roleAdmin : t.admin.roleStaff}</Badge>
      {!u.isActive && <Badge>{t.admin.inactive}</Badge>}
      {u.role === 'STAFF' && (
        <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
          {u.isActive ? t.admin.deactivate : t.admin.reactivate}
        </Button>
      )}
    </li>
  );
}

function NewStaff({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const create = useMutation({
    mutationFn: () => api('/users', { body: { email, password } }),
    onSuccess: () => {
      setEmail('');
      setPassword('');
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-md border border-line bg-surface/60 p-4">
      <p className="eyebrow !text-ink">{t.admin.newStaff}</p>
      <Input type="email" aria-label={t.login.email} placeholder={t.login.email} required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input type="password" aria-label={t.admin.passwordHint} placeholder={t.admin.passwordHint} required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <FormError error={create.error} />
      <Button type="submit" size="sm" className="justify-self-start" disabled={create.isPending}>
        {t.admin.add}
      </Button>
    </form>
  );
}

function NewSlot({ points, onDone }: { points: ServicePoint[]; onDone: () => void }) {
  const [spId, setSpId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [capacity, setCapacity] = useState(3);
  const chosen = spId || points[0]?.id || '';
  const create = useMutation({
    mutationFn: () =>
      api('/slots', { body: { servicePointId: chosen, startsAt: new Date(startsAt).toISOString(), capacity } }),
    onSuccess: onDone,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  if (points.length === 0) return null;
  return (
    <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface/60 p-4">
      <p className="eyebrow !text-ink w-full">{t.admin.newSlot}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slot-sp">{t.staff.servicePoint}</Label>
        <select id="slot-sp" className="h-11 rounded-md border border-line-strong bg-white/70 px-3 text-[0.9375rem]" value={chosen} onChange={(e) => setSpId(e.target.value)}>
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slot-at">{t.admin.slotTime}</Label>
        <Input id="slot-at" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slot-cap">{t.admin.capacity}</Label>
        <Input id="slot-cap" type="number" min={1} max={500} required className="w-24" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
      </div>
      <Button type="submit" size="sm" className="h-11" disabled={create.isPending || !startsAt}>
        {t.admin.add}
      </Button>
      <div className="w-full">
        <FormError error={create.error} />
      </div>
    </form>
  );
}
