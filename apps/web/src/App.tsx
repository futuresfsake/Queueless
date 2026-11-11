import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { HomePage } from './pages/HomePage';
import { JoinPage } from './pages/JoinPage';
import { LoginPage } from './pages/LoginPage';
import { StaffPage } from './pages/StaffPage';
import { TicketPage } from './pages/TicketPage';
import { TvPage } from './pages/TvPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/c/:slug" element={<JoinPage />} />
        <Route path="/t/:token" element={<TicketPage />} />
        <Route path="/tv/:slug/:code" element={<TvPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth roles={['STAFF', 'CLINIC_ADMIN']} />}>
          <Route path="/staff" element={<StaffPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
