import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Wordmark } from '../components/brand';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/utils';
import { t } from '../strings';

interface Listing {
  clinic: string;
  servicePoints: { id: string; name: string; code: string }[];
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
  const chosen = code ?? listing.data?.servicePoints[0]?.code ?? null;

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
      <Shell>
        <h1 className="text-[1.75rem] font-semibold">{t.patient.clinicNotFoundTitle}</h1>
        <p className="mt-2 text-ink-soft">{t.patient.clinicNotFound}</p>
      </Shell>
    );
  }
  if (!listing.data) {
    return (
      <Shell>
        <p className="text-ink-soft">{t.patient.loading}</p>
      </Shell>
    );
  }
  if (listing.data.servicePoints.length === 0) {
    return (
      <Shell>
        <h1 className="text-[1.75rem] font-semibold">{listing.data.clinic}</h1>
        <p className="mt-2 text-ink-soft">{t.patient.noQueues}</p>
      </Shell>
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
    <Shell>
      <p className="eyebrow">{t.patient.welcomeTo}</p>
      <h1 className="mt-1 text-[2.1rem] font-semibold leading-[1.05]">{listing.data.clinic}</h1>

      {listing.data.servicePoints.length > 1 && (
        <div className="mt-6">
          <p className="eyebrow mb-2">{t.patient.whereTo}</p>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {listing.data.servicePoints.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.code === chosen}
                onClick={() => setCode(p.code)}
                className={cn(
                  'h-10 rounded-md border px-4 text-sm font-medium transition-colors',
                  p.code === chosen ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-surface hover:border-ink',
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-7 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{t.staff.patientName}</Label>
          <Input id="name" required maxLength={120} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-xs text-ink-soft">{t.patient.nameHint}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">{t.staff.phone}</Label>
          <Input id="phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface/70 p-3.5 text-[0.8125rem] leading-relaxed">
          <input
            type="checkbox"
            className="mt-0.5 size-[1.15rem] shrink-0 accent-[var(--color-accent)]"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>{t.patient.consent}</span>
        </label>

        {err && (
          <p role="alert" className="text-sm font-medium text-alarm">
            {err}
          </p>
        )}

        <Button type="submit" variant="accent" size="lg" disabled={!formReady || busy}>
          {t.patient.join}
        </Button>
      </form>

      {openSlots.length > 0 && (
        <section className="mt-10">
          <div className="rule-strong pt-3">
            <h2 className="text-xl font-semibold">{t.patient.bookTitle}</h2>
            <p className="mt-1 text-[0.8125rem] text-ink-soft">{t.patient.bookHint}</p>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {openSlots.map((s) => {
              const full = s.remaining === 0;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!formReady || full || busy}
                    onClick={() => book.mutate(s.id)}
                    className="group flex h-full w-full flex-col items-start rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-left transition-colors enabled:hover:border-ink enabled:hover:bg-white disabled:opacity-50"
                  >
                    <span className="numeral text-[1.65rem]">
                      {new Date(s.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className={cn('text-xs', full ? 'text-alarm' : 'text-ink-soft')}>
                      {full ? t.patient.full : `${s.remaining} ${t.patient.left}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!formReady && <p className="mt-3 text-xs text-ink-soft">{t.patient.bookNeedsName}</p>}
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-14 pt-5">
      <div className="mb-9 flex items-center justify-between">
        <Wordmark className="text-[1.05rem]" />
      </div>
      {children}
    </main>
  );
}
