import { SERVICE_ICONS } from '@queueless/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Plus } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../auth/auth-store';
import { Alert, EmptyState } from '../components/feedback';
import { ICONS, ServiceIcon } from '../components/service-icon';
import { AppShell, PageHeader } from '../components/shell';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input, Select } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/utils';
import { t } from '../strings';

interface ServicePoint {
  id: string;
  name: string;
  code: string;
  prefix: string;
  description: string | null;
  icon: string | null;
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

type Tab = 'services' | 'staff' | 'slots';

/** Clinic Admin setup: services, staff accounts, booking slots. The API enforces the role. */
export function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('services');
  const points = useQuery({ queryKey: ['admin', 'sp'], queryFn: () => api<ServicePoint[]>('/service-points') });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api<StaffUser[]>('/users') });
  const slots = useQuery({ queryKey: ['admin', 'slots'], queryFn: () => api<Slot[]>('/slots') });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] });
  const slug = user?.tenantSlug ?? '';
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'services', label: t.admin.servicePoints, count: points.data?.length },
    { id: 'staff', label: t.admin.staff, count: users.data?.length },
    { id: 'slots', label: t.admin.slots, count: slots.data?.length },
  ];

  return (
    <AppShell>
      <PageHeader title={t.admin.title} description={t.admin.subtitle} />

      {slug && <PatientLink slug={slug} />}

      <div role="tablist" aria-label={t.admin.title} className="mb-5 flex gap-1 border-b border-line">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={cn(
              '-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
              tab === x.id ? 'border-brand text-brand' : 'border-transparent text-text-2 hover:text-text',
            )}
          >
            {x.label}
            {x.count !== undefined && <span className="ml-1.5 text-xs text-text-3">{x.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'services' && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t.admin.servicePoints}</CardTitle>
                <CardDescription>{t.admin.servicePointsHint}</CardDescription>
              </div>
            </CardHeader>
            {(points.data ?? []).length === 0 ? (
              <EmptyState title={t.admin.noServices}>{t.admin.noServicesHint}</EmptyState>
            ) : (
              <ul>
                {(points.data ?? []).map((p) => (
                  <ServiceRow key={p.id} p={p} slug={slug} onDone={refresh} />
                ))}
              </ul>
            )}
          </Card>
          <NewServicePoint onDone={refresh} />
        </div>
      )}

      {tab === 'staff' && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t.admin.staff}</CardTitle>
                <CardDescription>{t.admin.staffHint}</CardDescription>
              </div>
            </CardHeader>
            <ul>
              {(users.data ?? []).map((u) => (
                <StaffRow key={u.id} u={u} onDone={refresh} />
              ))}
            </ul>
          </Card>
          <NewStaff onDone={refresh} />
        </div>
      )}

      {tab === 'slots' && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t.admin.slots}</CardTitle>
                <CardDescription>{t.admin.slotsHint}</CardDescription>
              </div>
            </CardHeader>
            {(slots.data ?? []).length === 0 ? (
              <EmptyState title={t.admin.noSlots}>{t.admin.noSlotsHint}</EmptyState>
            ) : (
              <ul>
                {(slots.data ?? []).slice(-14).map((s) => (
                  <li key={s.id} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
                    <span className="w-16 text-base font-semibold tabular-nums">
                      {new Date(s.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className="w-14 text-[0.8125rem] text-text-2">
                      {new Date(s.startsAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{points.data?.find((p) => p.id === s.servicePointId)?.name}</span>
                    <Badge tone={s.bookedCount >= s.capacity ? 'warn' : 'neutral'}>
                      {s.bookedCount}/{s.capacity} {t.admin.booked}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <NewSlot points={(points.data ?? []).filter((p) => p.isActive)} onDone={refresh} />
        </div>
      )}
    </AppShell>
  );
}

function PatientLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/c/${slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard can be blocked; the link is still visible to select by hand */
    }
  };
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t.admin.patientLink}</p>
          <p className="mt-0.5 truncate font-mono text-[0.8125rem] text-text-2">{url}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? t.admin.copied : t.admin.copy}
          </Button>
          <a href={`/c/${slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-[0.8125rem] font-medium shadow-card hover:bg-subtle">
            <ExternalLink className="size-4" />
            {t.admin.open}
          </a>
        </div>
      </div>
    </Card>
  );
}

function ServiceRow({ p, slug, onDone }: { p: ServicePoint; slug: string; onDone: () => void }) {
  const toggle = useMutation({
    mutationFn: () => api(`/service-points/${p.id}`, { method: 'PATCH', body: { isActive: !p.isActive } }),
    onSuccess: onDone,
  });
  return (
    <li className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-md', p.isActive ? 'bg-brand-soft text-brand' : 'bg-subtle text-text-3')}>
        <ServiceIcon name={p.icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{p.name}</span>
          {!p.isActive && <Badge>{t.admin.closed}</Badge>}
        </p>
        <p className="truncate text-[0.8125rem] text-text-2">{p.description || t.admin.noDescription}</p>
        <p className="mt-0.5 text-xs text-text-3">
          {t.admin.prefix} <span className="font-semibold text-text-2">{p.prefix}</span> · {p.code}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {slug && (
          <a className="rounded-md px-2 py-1.5 text-[0.8125rem] font-medium text-brand hover:bg-brand-soft" href={`/tv/${slug}/${p.code}`} target="_blank" rel="noreferrer">
            {t.admin.openTv}
          </a>
        )}
        <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
          {p.isActive ? t.admin.closeService : t.admin.openService}
        </Button>
      </div>
    </li>
  );
}

const FormError = ({ error }: { error: unknown }) => (msg(error) ? <Alert tone="danger">{msg(error)}</Alert> : null);

function NewServicePoint({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [prefix, setPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string>('stethoscope');
  const create = useMutation({
    mutationFn: () =>
      api('/service-points', {
        body: { name, code, prefix: prefix.toUpperCase(), description: description.trim() || undefined, icon },
      }),
    onSuccess: () => {
      setName('');
      setCode('');
      setPrefix('');
      setDescription('');
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="size-4 text-text-2" />
          {t.admin.newServicePoint}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sp-name">{t.admin.spNameLabel}</Label>
            <Input id="sp-name" placeholder={t.admin.spName} required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sp-desc">{t.admin.spDescLabel}</Label>
            <Input id="sp-desc" maxLength={140} placeholder={t.admin.spDescPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} />
            <p className="text-xs text-text-3">{t.admin.spDescHint}</p>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{t.admin.iconLabel}</legend>
            <div role="radiogroup" aria-label={t.admin.iconLabel} className="grid grid-cols-4 gap-2">
              {SERVICE_ICONS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={icon === k}
                  aria-label={ICONS[k].label}
                  title={ICONS[k].label}
                  onClick={() => setIcon(k)}
                  className={cn(
                    'grid h-11 place-items-center rounded-md border transition-colors',
                    icon === k ? 'border-brand bg-brand-soft text-brand ring-1 ring-brand' : 'border-line-strong text-text-2 hover:bg-subtle',
                  )}
                >
                  <ServiceIcon name={k} />
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sp-code">{t.admin.spCodeLabel}</Label>
              <Input id="sp-code" placeholder={t.admin.spCode} required pattern="[a-z0-9\-]{1,40}" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sp-prefix">{t.admin.spPrefixLabel}</Label>
              <Input id="sp-prefix" placeholder={t.admin.spPrefix} required pattern="[A-Za-z]{1,3}" maxLength={3} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </div>
          </div>
          <FormError error={create.error} />
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t.admin.add}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StaffRow({ u, onDone }: { u: StaffUser; onDone: () => void }) {
  const toggle = useMutation({
    mutationFn: () => api(`/users/${u.id}`, { method: 'PATCH', body: { isActive: !u.isActive } }),
    onSuccess: onDone,
  });
  return (
    <li className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-sm font-semibold text-text-2">
        {u.email.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{u.email}</span>
      <Badge tone={u.role === 'CLINIC_ADMIN' ? 'brand' : 'neutral'}>{u.role === 'CLINIC_ADMIN' ? t.admin.roleAdmin : t.admin.roleStaff}</Badge>
      {!u.isActive && <Badge tone="warn">{t.admin.inactive}</Badge>}
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="size-4 text-text-2" />
          {t.admin.newStaff}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="st-email">{t.login.email}</Label>
            <Input id="st-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="st-pass">{t.login.password}</Label>
            <Input id="st-pass" type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-text-3">{t.admin.passwordHint}</p>
          </div>
          <FormError error={create.error} />
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t.admin.add}
          </Button>
        </form>
      </CardContent>
    </Card>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="size-4 text-text-2" />
          {t.admin.newSlot}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm text-text-2">{t.admin.needService}</p>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="slot-sp">{t.staff.servicePoint}</Label>
              <Select id="slot-sp" value={chosen} onChange={(e) => setSpId(e.target.value)}>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="slot-at">{t.admin.slotTime}</Label>
              <Input id="slot-at" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="slot-cap">{t.admin.capacity}</Label>
              <Input id="slot-cap" type="number" min={1} max={500} required value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
            <FormError error={create.error} />
            <Button type="submit" variant="primary" disabled={create.isPending || !startsAt}>
              {t.admin.add}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
