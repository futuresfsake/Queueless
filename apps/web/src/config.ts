// Production: the web app (Vercel) and API (Railway) are on different origins, so set VITE_API_URL at build time
// (e.g. https://queueless-api.up.railway.app). Local dev leaves it empty and uses the Vite proxy (same origin).
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

// The clinic the home page links to as the demo. It exists once `seed:demo` has been run against the database.
export const DEMO_SLUG: string = import.meta.env.VITE_DEMO_SLUG ?? 'demo-clinic';
export const DEMO_SERVICE_CODE: string = import.meta.env.VITE_DEMO_SERVICE_CODE ?? 'general';
