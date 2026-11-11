import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth-store';

/** Route guard. This only decides what to show; the API enforces every permission itself. */
export function RequireAuth({ roles }: { roles: string[] }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
