// Production: the web app (Vercel) and API (Railway) are on different origins, so set VITE_API_URL at build time
// (e.g. https://queueless-api.up.railway.app). Local dev leaves it empty and uses the Vite proxy (same origin).
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
