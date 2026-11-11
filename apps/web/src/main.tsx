import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { useAuth } from './auth/auth-store';
import { configureApi } from './lib/api';
import './index.css';

// A 401 means the token expired or the user was deactivated: drop the session; the route guard sends them to /login.
configureApi({ getToken: () => useAuth.getState().token, onUnauthorized: () => useAuth.getState().signOut() });

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnReconnect: true, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
