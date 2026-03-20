import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { AuthGuard } from './components/auth/AuthGuard';
import { AdminGuard } from './components/auth/AdminGuard';
import { Dashboard } from './pages/Dashboard';
import { Logs } from './pages/Logs';
import { TraceDetail } from './pages/TraceDetail';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthGuard />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/traces/:traceId" element={<TraceDetail />} />
            <Route element={<AdminGuard />}>
              <Route path="/admin/users" element={<Admin />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
