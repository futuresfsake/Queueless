import { useQuery } from '@tanstack/react-query';

type Health = { status: string; db: string; uptimeSeconds: number };

export function App() {
  const { data, isError, isLoading } = useQuery<Health>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/v1/health');
      if (!res.ok) throw new Error('health failed');
      return res.json();
    },
    refetchInterval: 10_000,
  });

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-3xl font-bold">Queueless</h1>
      <p className="text-slate-600">Wait anywhere. Get called when it&apos;s your turn.</p>
      <p className="text-sm">
        API:{' '}
        {isLoading ? 'checking…' : isError ? 'unreachable' : `${data?.status} (db ${data?.db})`}
      </p>
    </main>
  );
}
