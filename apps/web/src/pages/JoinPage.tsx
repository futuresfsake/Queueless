import { useMutation, useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClinicHeader, PoweredBy } from '../components/brand';
import { Alert, Skeleton } from '../components/feedback';
import { ServiceIcon } from '../components/service-icon';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/utils';
import { t } from '../strings';

interface Listing {
  clinic: string;
  servicePoints: { id: string; name: string; code: string; description: string | null; icon: string | null; closed: boolean }[];
}
interface Slots {
  slots: { id: string; startsAt: string; remaining: number }[];
}
interface Joined {
  ticket: { number: string };
  accessToken: string;
}

const errorText = (e: unknown) =>
  e instanceof ApiError
    ? e.code === 'QUEUE_FULL'
      ? t.patient.queueFull
      : e.code === 'SLOT_FULL'
        ? t.patient.slotFull
        : e.code === 'RATE_LIMITED'
          ? t.patient.rateLimited
          : e.code === 'SERVICE_POINT_INACTIVE'
            ? t.patient.serviceClosedError
            : e.code === 'CONSENT_REQUIRED'
            ? t.staff.consentRequired
            : t.patient.failed
    : e
      ? t.patient.failed
      : null;

/** US-5 join the queue, US-8 book a slot. No account: the ticket link is the patient's access. */
export function JoinPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const listing = useQuery({
    queryKey: ['public', slug],
    queryFn: () => api<Listing>(`/public/c/${slug}/service-points`, { auth: false }),
    retry: false,
  });
  const [code, setCode] = useState<string | null>(null);
  const firstOpen = listing.data?.servicePoints.find((p) => !p.closed)?.code ?? null;
  const chosen = code ?? firstOpen;

  const slots = useQuery({
    queryKey: ['public', slug, chosen, 'slots'],
    queryFn: () => api<Slots>(`/public/c/${slug}/service-points/${chosen}/slots`, { auth: false }),
    enabled: !!chosen,
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  // One key per intended action; kept after a failure so a retry cannot create a second ticket.
  const [key] = useState(() => crypto.randomUUID());

  const done = (r: Joined) => navigate(`/t/${r.accessToken}`);
  const body = { patientName: name, phone: phone || undefined, consent };
  const join = useMutation({
    mutationFn: () =>
      api<Joined>(`/public/c/${slug}/service-points/${chosen}/tickets`, {
        body,
        idempotencyKey: key,
        auth: false,
      }),
    onSuccess: done,
  });
  const book = useMutation({
    mutationFn: (slotId: string) =>
      api<Joined>(`/public/c/${slug}/slots/${slotId}/book`, { body, idempotencyKey: key, auth: false }),
    onSuccess: done,
    onError: () => void slots.refetch(),
  });

  if (listing.isError) {
    return (
      <Frame>
        <h1 className="text-2xl">{t.patient.clinicNotFoundTitle}</h1>
        <p className="mt-2 text-text-2">{t.patient.clinicNotFound}</p>
      </Frame>
    );
  }
  if (!listing.data) {
    return (
      <Frame>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-6 h-11" />
        <Skeleton className="mt-3 h-11" />
      </Frame>
    );
  }
  if (listing.data.servicePoints.length === 0) {
    return (
      <Frame clinic={listing.data.clinic}>
        <p className="text-text-2">{t.patient.noQueues}</p>
      </Frame>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    join.mutate();
  };
  const err = errorText(join.error) ?? errorText(book.error);
  const formReady = name.trim().length > 0 && consent;
  const busy = join.isPending || book.isPending;
  const openSlots = slots.data?.slots ?? [];

  return (
    <Frame clinic={listing.data.clinic}>
      <h1 className="text-[1.625rem] leading-tight">{t.patient.takeANumberTitle}</h1>
      <p className="mt-1.5 text-text-2">{t.patient.takeANumber}</p>

      <form onSubmit={submit} className="mt-6 grid gap-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t.patient.whereTo}</legend>
          <div role="radiogroup" aria-label={t.patient.whereTo} className="overflow-hidden rounded-md border border-line-strong">
            {listing.data.servicePoints.map((p) => {
              const selected = p.code === chosen && !p.closed;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={p.closed || undefined}
                  onClick={() => !p.closed && setCode(p.code)}
                  className={cn(
                    // 64px tall: comfortably above the 56px kiosk and touch minimum. One list, ruled, like a form.
                    'flex min-h-16 w-full items-center gap-3.5 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 focus-visible:outline-offset-[-2px]',
                    p.closed ? 'cursor-not-allowed bg-subtle' : selected ? 'bg-brand-soft' : 'bg-surface hover:bg-subtle',
                  )}
                >
                  <ServiceIcon name={p.icon} className={cn('size-6 shrink-0', selected ? 'text-brand' : 'text-text-3')} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-base font-semibold leading-snug', p.closed ? 'text-text-2' : 'text-text')}>{p.name}</span>
                    {p.description && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-text-2">{p.description}</span>}
                  </span>
                  {p.closed ? (
                    <span className="shrink-0 text-xs font-medium text-text-2">{t.patient.closed}</span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', selected ? 'border-brand bg-brand text-white' : 'border-line-strong')}
                    >
                      {selected && <Check className="size-4" strokeWidth={3} />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="name">{t.staff.patientName}</Label>
          <Input id="name" required maxLength={120} autoComplete="given-name" aria-describedby="name-hint" value={name} onChange={(e) => setName(e.target.value)} />
          <p id="name-hint" className="text-[0.8125rem] text-text-3">
            {t.patient.nameHint}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">{t.staff.phone}</Label>
          <Input id="phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <label className="flex cursor-pointer items-start gap-3 border-t border-line pt-4 text-[0.8125rem] leading-relaxed text-text-2">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>{t.patient.consent}</span>
        </label>

        {err && <Alert tone="danger">{err}</Alert>}

        <Button type="submit" variant="primary" size="lg" className="h-14 text-base" disabled={!formReady || busy || !chosen}>
          {t.patient.join}
        </Button>
        <p className="-mt-2 text-xs text-text-3">{t.patient.privacyLine}</p>
      </form>

      {openSlots.length > 0 && (
        <section className="mt-8 border-t border-line pt-6">
          <h2 className="text-base">{t.patient.bookTitle}</h2>
          <p className="mt-1 text-[0.8125rem] text-text-2">{t.patient.bookHint}</p>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {openSlots.map((s) => {
              const full = s.remaining === 0;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!formReady || full || busy}
                    onClick={() => book.mutate(s.id)}
                    className="flex h-full min-h-[3.5rem] w-full flex-col items-start justify-center rounded-md border border-line-strong bg-surface px-3 py-2 text-left transition-colors enabled:hover:border-brand enabled:hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <span className="text-base font-semibold tabular-nums">
                      {new Date(s.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className={cn('text-xs', full ? 'font-medium text-danger' : 'text-text-3')}>
                      {full ? t.patient.full : `${s.remaining} ${t.patient.left}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!formReady && <p className="mt-3 text-xs text-text-3">{t.patient.bookNeedsName}</p>}
        </section>
      )}
    </Frame>
  );
}

function Frame({ children, clinic }: { children: React.ReactNode; clinic?: string }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-5">
      <div className="mb-6 border-b border-line pb-4">{clinic ? <ClinicHeader name={clinic} /> : <p className="text-sm font-medium text-text-2">Queueless</p>}</div>
      {children}
      <PoweredBy />
    </main>
  );
}
