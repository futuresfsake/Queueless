import { ListOrdered, LogOut, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/auth-store';
import { cn } from '../lib/utils';
import { t } from '../strings';
import { Wordmark } from './brand';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-line text-text' : 'text-text-2 hover:bg-line/60 hover:text-text',
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

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[13.5rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-subtle md:flex">
        <div className="px-4 pb-5 pt-4">
          <Wordmark />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5 px-2">
          {nav}
        </nav>
        <div className="mt-auto border-t border-line p-2">
          <div className="px-2.5 py-1.5">
            <span className="block truncate text-[0.8125rem] font-medium" title={user?.email}>
              {user?.email}
            </span>
            <span className="block text-xs text-text-3">{isAdmin ? t.nav.roleAdmin : t.nav.roleStaff}</span>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-text-2 hover:bg-line/60 hover:text-text"
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
        <main className="w-full max-w-6xl px-4 pb-16 pt-5 md:px-8 md:pt-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
      <div>
        <h1 className="text-xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-text-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
