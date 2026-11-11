import { API_URL } from '../config';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Hooks = { getToken: () => string | null; onUnauthorized: () => void };
let hooks: Hooks = { getToken: () => null, onUnauthorized: () => {} };
export const configureApi = (h: Hooks) => {
  hooks = h;
};

/**
 * `idempotencyKey` (rule 4, D-14): one UUID per user action, created when the user acts and reused
 * on any retry of that same action, so a double-tap can never skip a patient.
 */
export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  const token = hooks.getToken();
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && opts.auth !== false) hooks.onUnauthorized();
    const err = json?.error ?? json ?? {};
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText);
  }
  return json as T;
}
