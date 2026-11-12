import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type Tone = 'info' | 'ok' | 'warn' | 'danger';

const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'border-brand-line bg-brand-soft text-brand', icon: <Info className="size-4" /> },
  ok: { box: 'border-ok-line bg-ok-soft text-ok', icon: <CheckCircle2 className="size-4" /> },
  warn: { box: 'border-warn-line bg-warn-soft text-warn', icon: <AlertTriangle className="size-4" /> },
  danger: { box: 'border-danger-line bg-danger-soft text-danger', icon: <AlertCircle className="size-4" /> },
};

/** Inline message. Icon + words, so it never relies on colour alone. */
export function Alert({ tone = 'info', children, className, live = true }: { tone?: Tone; children: ReactNode; className?: string; live?: boolean }) {
  return (
    <div
      role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}
      className={cn('flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm', tones[tone].box, className)}
    >
      <span className="mt-0.5 shrink-0">{tones[tone].icon}</span>
      <div className="min-w-0 text-text">{children}</div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-xs text-[0.8125rem] text-text-2">{children}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}
