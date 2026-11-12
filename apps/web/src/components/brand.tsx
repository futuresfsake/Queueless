import { cn } from '../lib/utils';

/** Three lines in a queue, the first one longest. The whole idea, nothing more. */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="var(--color-brand)" />
      <rect x="7" y="8" width="14" height="3" rx="1.5" fill="#fff" />
      <rect x="7" y="12.5" width="10" height="3" rx="1.5" fill="#fff" fillOpacity="0.75" />
      <rect x="7" y="17" width="6" height="3" rx="1.5" fill="#fff" fillOpacity="0.5" />
    </svg>
  );
}

export function Wordmark({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-[1.0625rem] font-semibold tracking-tight', tone === 'light' ? 'text-white' : 'text-text', className)}>
      <LogoMark className="size-7" />
      Queueless
    </span>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * The clinic is the identity on patient screens: its name, with an initials tile where a logo would go
 * (clinics cannot upload a logo yet). Queueless stays small, in the footer.
 */
export function ClinicHeader({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-md bg-text text-sm font-semibold tracking-wide text-white">
        {initialsOf(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[1.0625rem] font-semibold leading-tight">{name}</p>
        {sub && <p className="truncate text-[0.8125rem] text-text-2">{sub}</p>}
      </div>
    </div>
  );
}

export function PoweredBy() {
  return (
    <p className="mt-10 flex items-center gap-2 text-xs text-text-3">
      <LogoMark className="size-4" /> Powered by Queueless
    </p>
  );
}
