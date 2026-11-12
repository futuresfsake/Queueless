import { ListOrdered, LogOut, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/auth-store';
import { cn } from '../lib/utils';
import { t } from '../strings';
import { Wordmark } from './brand';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-soft text-brand' : 'text-text-2 hover:bg-subtle hover:text-text',
  );

/**
 * Signed-in frame: a fixed sidebar on desktop, a top bar with tabs on phones.
 * Navigation is the same two places everywhere: the queue, and (admins only) clinic setup.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const isAdmin = user?.role === 'CLINIC_ADMIN';
  const nav = (
    <>
      <NavLink to="/staff" className={linkClass}>
        <ListOrdered className="size-[1.1rem]" />
        {t.nav.queue}
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={linkClass}>
          <Settings2 className="size-[1.1rem]" />
          {t.admin.title}
        </NavLink>
      )}
    </>
  );
  const initial = (user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 py-5">
          <Wordmark />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1 px-3">
          {nav}
        </nav>
        <div className="mt-auto border-t border-line p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] font-medium">{user?.email}</span>
              <span className="block text-xs text-text-3">{isAdmin ? t.nav.roleAdmin : t.nav.roleStaff}</span>
            </span>
          </div>
          <button
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-text-2 hover:bg-subtle hover:text-text"
          >
            <LogOut className="size-[1.1rem]" />
            {t.staff.signOut}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-line bg-surface md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Wordmark />
            <button onClick={signOut} aria-label={t.staff.signOut} className="rounded-md p-2 text-text-2 hover:bg-subtle">
              <LogOut className="size-5" />
            </button>
          </div>
          <nav aria-label="Main" className="flex gap-1 px-3 pb-2">
            {nav}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8 md:pt-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
