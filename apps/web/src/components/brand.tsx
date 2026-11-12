import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/** The mark is a ticket with a bite out of each side. Same shape as the stub on the patient page. */
export function TicketGlyph({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M6 8h20a1.5 1.5 0 0 1 1.5 1.5v3.6a3 3 0 0 0 0 5.8v3.6A1.5 1.5 0 0 1 26 24H6a1.5 1.5 0 0 1-1.5-1.5v-3.6a3 3 0 0 0 0-5.8V9.5A1.5 1.5 0 0 1 6 8z"
        fill="currentColor"
      />
      <path d="M17 10.5v11" stroke="var(--color-paper)" strokeWidth="1.6" strokeDasharray="2.2 2.2" />
    </svg>
  );
}

export function Wordmark({ className, tone = 'ink' }: { className?: string; tone?: 'ink' | 'paper' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-display text-[1.25rem] font-semibold tracking-tight',
        tone === 'paper' ? 'text-paper' : 'text-ink',
        className,
      )}
    >
      <TicketGlyph className="size-6 text-accent" />
      Queueless
    </span>
  );
}

/** Page chrome for signed-in screens: wordmark left, who and what on the right, one ruled line under. */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3.5">
        <Wordmark />
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">{children}</nav>
      </div>
    </header>
  );
}
