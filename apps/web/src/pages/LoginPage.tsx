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
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1fr]">
      {/* the board, as it looks in the waiting room */}
      <aside className="flex min-h-[16rem] flex-col justify-between bg-black p-6 font-mono text-white lg:p-10">
        <Wordmark tone="white" />
        <div aria-hidden="true">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">{t.login.boardLabel}</p>
          <p className="num whitespace-nowrap text-[clamp(6rem,20vw,16rem)] leading-[0.9] text-led [text-shadow:0_0_0.3em_rgb(255_59_36/0.35)]">G-014</p>
        </div>
      </aside>

      <section className="flex items-center justify-center bg-page px-6 py-12">
        <div className="w-full max-w-[22rem]">
          <h1 className="text-[2.2rem]">{t.login.title}</h1>
          <p className="mt-2 text-sm text-grey">{t.login.hint}</p>

          <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t.login.email}</Label>
              <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t.login.password}</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="border-2 border-alarm bg-white px-3 py-2 text-sm font-medium text-alarm">
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
