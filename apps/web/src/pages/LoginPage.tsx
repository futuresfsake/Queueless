import type { LoginResponse } from '@queueless/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-store';
import { Wordmark } from '../components/brand';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, ApiError } from '../lib/api';
import { t } from '../strings';

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => api<LoginResponse>('/auth/login', { body: { email, password }, auth: false }),
    onSuccess: (r) => {
      signIn({ token: r.accessToken, user: r.user });
      navigate('/staff', { replace: true });
    },
  });

  if (user) return <Navigate to="/staff" replace />;

  const error = !login.error
    ? null
    : login.error instanceof ApiError && login.error.status === 429
      ? t.login.tooMany
      : login.error instanceof ApiError && login.error.status === 401
        ? t.login.badCredentials
        : t.login.generic;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* The board: the same giant numerals the waiting-room TV shows, cropped on purpose. */}
      <aside className="relative flex min-h-[19rem] flex-col overflow-hidden bg-ink px-7 pb-0 pt-7 text-paper lg:min-h-0 lg:px-12 lg:pt-10">
        <Wordmark tone="paper" />
        <p className="mt-8 max-w-[18rem] text-balance font-display text-[1.55rem] leading-[1.2] text-paper lg:mt-14 lg:max-w-sm lg:text-[2.1rem]">
          {t.login.pitch}
        </p>
        <div aria-hidden="true" className="relative mt-auto select-none">
          <p className="eyebrow !text-paper/50">{t.login.boardLabel}</p>
          <p className="numeral -mb-[0.12em] -ml-[0.03em] text-[clamp(9rem,30vw,27rem)] leading-[0.86] text-accent">014</p>
        </div>
      </aside>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[22rem]">
          <p className="eyebrow">{t.login.eyebrow}</p>
          <h1 className="mt-1 text-[2.4rem] font-semibold">{t.login.title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{t.login.hint}</p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t.login.email}</Label>
              <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t.login.password}</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-alarm">
                {error}
              </p>
            )}
            <Button type="submit" variant="accent" size="lg" disabled={login.isPending}>
              {login.isPending ? t.login.submitting : t.login.submit}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
