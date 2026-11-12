import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-store';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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

  return (
    <main className="mx-auto max-w-5xl p-4 flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t.admin.title}</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link className="underline" to="/staff">
            {t.staff.title}
          </Link>
          <span className="text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            {t.staff.signOut}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.admin.servicePoints}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(points.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span>
                  <span className="font-mono font-semibold">{p.prefix}</span> {p.name}{' '}
                  <span className="text-muted-foreground">({p.code})</span>
                </span>
                <span className="flex items-center gap-2">
                  <a className="underline" href={`/tv/${user?.tenantSlug ?? ''}/${p.code}`} target="_blank" rel="noreferrer">
                    TV
                  </a>
                  {!p.isActive && <Badge variant="secondary">{t.admin.inactive}</Badge>}
                </span>
              </div>
            ))}
            <NewServicePoint onDone={refresh} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.admin.staff}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(users.data ?? []).map((u) => (
              <StaffRow key={u.id} u={u} onDone={refresh} />
            ))}
            <NewStaff onDone={refresh} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.admin.slots}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            {(slots.data ?? []).slice(-12).map((s) => (
              <p key={s.id} className="text-sm">
                {points.data?.find((p) => p.id === s.servicePointId)?.name} ·{' '}
                {new Date(s.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {s.bookedCount}/
                {s.capacity}
              </p>
            ))}
          </div>
          <NewSlot points={(points.data ?? []).filter((p) => p.isActive)} onDone={refresh} />
        </CardContent>
      </Card>
    </main>
  );
}

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
    <form onSubmit={submit} className="grid gap-2 border-t pt-3">
      <Label htmlFor="sp-name">{t.admin.newServicePoint}</Label>
      <Input id="sp-name" placeholder={t.admin.spName} required value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder={t.admin.spCode} required pattern="[a-z0-9-]{1,40}" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input placeholder={t.admin.spPrefix} required pattern="[A-Za-z]{1,3}" maxLength={3} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
      </div>
      {msg(create.error) && <p role="alert" className="text-sm text-destructive">{msg(create.error)}</p>}
      <Button type="submit" size="sm" disabled={create.isPending}>{t.admin.add}</Button>
    </form>
  );
}

function StaffRow({ u, onDone }: { u: StaffUser; onDone: () => void }) {
  const toggle = useMutation({
    mutationFn: () => api(`/users/${u.id}`, { method: 'PATCH', body: { isActive: !u.isActive } }),
    onSuccess: onDone,
  });
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
      <span className="truncate">
        {u.email} <Badge variant="secondary">{u.role}</Badge>
        {!u.isActive && <Badge variant="secondary">{t.admin.inactive}</Badge>}
      </span>
      {u.role === 'STAFF' && (
        <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
          {u.isActive ? t.admin.deactivate : t.admin.reactivate}
        </Button>
      )}
    </div>
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
    <form onSubmit={submit} className="grid gap-2 border-t pt-3">
      <Label htmlFor="st-email">{t.admin.newStaff}</Label>
      <Input id="st-email" type="email" placeholder={t.login.email} required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input type="password" placeholder={t.admin.passwordHint} required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {msg(create.error) && <p role="alert" className="text-sm text-destructive">{msg(create.error)}</p>}
      <Button type="submit" size="sm" disabled={create.isPending}>{t.admin.add}</Button>
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
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t pt-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slot-sp">{t.staff.servicePoint}</Label>
        <select id="slot-sp" className="h-9 rounded-md border bg-background px-2 text-sm" value={chosen} onChange={(e) => setSpId(e.target.value)}>
          {points.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
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
      <Button type="submit" size="sm" disabled={create.isPending || !startsAt}>{t.admin.add}</Button>
      {msg(create.error) && <p role="alert" className="text-sm text-destructive w-full">{msg(create.error)}</p>}
    </form>
  );
}
