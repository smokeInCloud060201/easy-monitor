import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { AuthGuard } from './components/auth/AuthGuard';
import { AdminGuard } from './components/auth/AdminGuard';
import { ThemeProvider } from './components/layout/ThemeContext';
import { Loader2 } from 'lucide-react';

// ─── Lazy-loaded pages (code-split per route) ───
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Logs = lazy(() => import('./pages/Logs'));
const TraceDetail = lazy(() => import('./pages/TraceDetail'));
const Admin = lazy(() => import('./pages/Admin'));
const APMCatalog = lazy(() => import('./pages/APMCatalog'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const ResourceDetail = lazy(() => import('./pages/ResourceDetail'));
const TraceExplorer = lazy(() => import('./pages/TraceExplorer'));
const ServiceMap = lazy(() => import('./pages/ServiceMap'));
const DatabaseMonitoring = lazy(() => import('./pages/DatabaseMonitoring'));

function PageLoader() {
  return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-brand-light" />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
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
                <Route path="/service-map" element={<ServiceMap />} />
                <Route path="/databases" element={<DatabaseMonitoring />} />
                <Route element={<AdminGuard />}>
                  <Route path="/admin/users" element={<Admin />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
