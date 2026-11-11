import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, ApiError } from '../lib/api';
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
  const [key, setKey] = useState(() => crypto.randomUUID());

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

  if (listing.isError) return <Centered>{t.patient.clinicNotFound}</Centered>;
  if (!listing.data) return <Centered>{t.patient.loading}</Centered>;
  if (listing.data.servicePoints.length === 0) return <Centered>{t.patient.noQueues}</Centered>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    join.mutate();
  };
  const err = errorText(join.error) ?? errorText(book.error);
  const formReady = name.trim().length > 0 && consent;

  return (
    <main className="mx-auto max-w-md p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{listing.data.clinic}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t.patient.joinTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {listing.data.servicePoints.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sp">{t.staff.servicePoint}</Label>
                <select
                  id="sp"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={chosen ?? ''}
                  onChange={(e) => setCode(e.target.value)}
                >
                  {listing.data.servicePoints.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t.staff.patientName}</Label>
              <Input id="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{t.staff.phone}</Label>
              <Input id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              {t.patient.consent}
            </label>
            {err && (
              <p role="alert" className="text-sm text-destructive">
                {err}
              </p>
            )}
            <Button type="submit" disabled={!formReady || join.isPending || book.isPending}>
              {t.patient.join}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(slots.data?.slots.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.patient.bookTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {slots.data!.slots.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <span>
                  {new Date(s.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                  <span className="text-sm text-muted-foreground">
                    {s.remaining} {t.patient.left}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!formReady || s.remaining === 0 || book.isPending || join.isPending}
                  onClick={() => book.mutate(s.id)}
                >
                  {s.remaining === 0 ? t.patient.full : t.patient.book}
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t.patient.bookHint}</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center p-6 text-center">{children}</main>;
}
