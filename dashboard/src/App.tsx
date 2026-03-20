import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Logs } from './pages/Logs';
import { TraceDetail } from './pages/TraceDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/traces/:traceId" element={<TraceDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
