import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { AuthGuard } from './components/auth/AuthGuard';
import { AdminGuard } from './components/auth/AdminGuard';
import { Dashboard } from './pages/Dashboard';
import { Logs } from './pages/Logs';
import { TraceDetail } from './pages/TraceDetail';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';
import APMCatalog from './pages/APMCatalog';
import ServiceDetail from './pages/ServiceDetail';
import ResourceDetail from './pages/ResourceDetail';
import TraceExplorer from './pages/TraceExplorer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthGuard />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/apm" element={<APMCatalog />} />
            <Route path="/apm/services/:name" element={<ServiceDetail />} />
            <Route path="/apm/services/:name/resources/:resource" element={<ResourceDetail />} />
            <Route path="/traces" element={<TraceExplorer />} />
            <Route path="/traces/:traceId" element={<TraceDetail />} />
            <Route path="/logs" element={<Logs />} />
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
