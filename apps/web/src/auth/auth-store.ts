import type { AuthUser } from '@queueless/shared';
import { create } from 'zustand';

const KEY = 'queueless.session';
type Session = { token: string; user: AuthUser };

// Storage can throw (private mode, blocked site data): the app must still work without it.
const load = (): Session | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
};
const save = (s: Session | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  signIn: (s: Session) => void;
  signOut: () => void;
}

const initial = load();
export const useAuth = create<AuthState>((set) => ({
  token: initial?.token ?? null,
  user: initial?.user ?? null,
  signIn: (s) => {
    save(s);
    set({ token: s.token, user: s.user });
  },
  signOut: () => {
    save(null);
    set({ token: null, user: null });
  },
}));
