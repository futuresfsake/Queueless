import type { LoginResponse } from '@queueless/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-store';
import { Wordmark } from '../components/brand';
import { Alert } from '../components/feedback';
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
    <main className="mx-auto flex min-h-dvh w-full max-w-[22rem] flex-col px-4 pb-10 pt-[min(18vh,9rem)]">
      <Link to="/" aria-label="Queueless home" className="self-start">
        <Wordmark />
      </Link>

      <div className="mt-10">
        <h1 className="text-2xl">{t.login.title}</h1>
        <p className="mt-1.5 text-sm text-text-2">{t.login.hint}</p>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">{t.login.email}</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">{t.login.password}</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" variant="primary" size="lg" disabled={login.isPending}>
            {login.isPending ? t.login.submitting : t.login.submit}
          </Button>
        </form>
      </div>

      <p className="mt-8 border-t border-line pt-4 text-[0.8125rem] text-text-3">{t.login.patientHint}</p>
    </main>
  );
}
