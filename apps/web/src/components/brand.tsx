import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/** A yellow square, a lowercase name. Nothing clever. */
export function Wordmark({ className, tone = 'ink' }: { className?: string; tone?: 'ink' | 'white' }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[1.15rem] font-bold tracking-tight', tone === 'white' ? 'text-white' : 'text-ink', className)}>
      <span aria-hidden="true" className="inline-block size-[0.8em] border-2 border-ink bg-mark" />
      queueless
    </span>
  );
}

/** Signed-in pages: a black strip with the name on the left and who/where on the right. */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2.5">
        <span className="inline-flex items-center gap-2 text-[1.05rem] font-bold tracking-tight">
          <span aria-hidden="true" className="inline-block size-[0.75em] bg-mark" />
          queueless
        </span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm [&_a]:underline [&_a]:underline-offset-4 [&_button]:!text-white/80 [&_button:hover]:!text-white">
          {children}
        </nav>
      </div>
    </header>
  );
}
