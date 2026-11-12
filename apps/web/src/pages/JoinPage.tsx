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
        <h1 className="text-3xl">{t.patient.clinicNotFoundTitle}</h1>
        <p className="mt-2 text-grey">{t.patient.clinicNotFound}</p>
      </Shell>
    );
  }
  if (!listing.data) {
    return (
      <Shell>
        <p className="text-grey">{t.patient.loading}</p>
      </Shell>
    );
  }
  if (listing.data.servicePoints.length === 0) {
    return (
      <Shell>
        <h1 className="text-3xl">{listing.data.clinic}</h1>
        <p className="mt-2 text-grey">{t.patient.noQueues}</p>
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
      <h1 className="text-[2rem]">{listing.data.clinic}</h1>
      <p className="mt-1 text-grey">{t.patient.takeANumber}</p>

      {listing.data.servicePoints.length > 1 && (
        <fieldset className="mt-6">
          <legend className="mb-2 text-[0.8125rem] font-semibold">{t.patient.whereTo}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {listing.data.servicePoints.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.code === chosen}
                onClick={() => setCode(p.code)}
                className={cn(
                  'h-10 border-2 border-ink px-4 text-sm font-semibold',
                  p.code === chosen ? 'bg-ink text-white' : 'bg-white hover:bg-mark',
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{t.staff.patientName}</Label>
          <Input id="name" required maxLength={120} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-xs text-grey">{t.patient.nameHint}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">{t.staff.phone}</Label>
          <Input id="phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <label className="flex cursor-pointer items-start gap-3 border-2 border-ink bg-white p-3 text-[0.8125rem] leading-relaxed">
          <input
            type="checkbox"
            className="mt-0.5 size-[1.15rem] shrink-0 accent-black"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>{t.patient.consent}</span>
        </label>

        {err && (
          <p role="alert" className="border-2 border-alarm bg-white px-3 py-2 text-sm font-medium text-alarm">
            {err}
          </p>
        )}

        <Button type="submit" variant="accent" size="lg" disabled={!formReady || busy}>
          {t.patient.join}
        </Button>
      </form>

      {openSlots.length > 0 && (
        <section className="mt-10">
          <h2 className="border-b-2 border-ink pb-2 text-xl">{t.patient.bookTitle}</h2>
          <p className="mt-2 text-[0.8125rem] text-grey">{t.patient.bookHint}</p>
          <ul className="mt-2">
            {openSlots.map((s) => {
              const full = s.remaining === 0;
              return (
                <li key={s.id} className="flex items-center gap-3 border-b border-rule py-2.5">
                  <span className="num w-[4.6rem] text-xl">
                    {new Date(s.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  <span className={cn('flex-1 text-sm', full ? 'font-semibold text-alarm' : 'text-grey')}>
                    {full ? t.patient.full : `${s.remaining} ${t.patient.left}`}
                  </span>
                  <Button size="sm" variant="outline" disabled={!formReady || full || busy} onClick={() => book.mutate(s.id)}>
                    {t.patient.book}
                  </Button>
                </li>
              );
            })}
          </ul>
          {!formReady && <p className="mt-3 text-xs text-grey">{t.patient.bookNeedsName}</p>}
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-14 pt-5">
      <div className="mb-8">
        <Wordmark className="text-base" />
      </div>
      {children}
    </main>
  );
}
