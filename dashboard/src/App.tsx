import { useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, Box, Flame } from 'lucide-react';
import APMCatalog from './pages/APMCatalog';

axios.get('http://localhost:3000/api/v1/login').then(res => {
  axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
});
import TraceExplorer from './pages/TraceExplorer';

function Sidebar() {
  const location = useLocation();

  const links = [
    { path: '/', label: 'Service Catalog', icon: Box },
    { path: '/traces', label: 'Trace Explorer', icon: Flame },
  ];

  return (
    <div className="w-64 h-screen border-r border-white/10 flex flex-col p-4 bg-surface/30 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-2 mb-8 mt-4">
        <Activity className="text-primary w-8 h-8" />
        <h1 className="text-xl font-bold tracking-wider">EASY<span className="text-primary">MONITOR</span></h1>
      </div>
      <nav className="flex flex-col gap-2">
        {links.map(l => {
          const active = location.pathname === l.path;
          return (
            <Link key={l.path} to={l.path} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-primary/20 text-primary font-bold' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}>
              <l.icon className="w-5 h-5" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  // Enforce dark mode on body securely
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <BrowserRouter>
      <div className="flex bg-background min-h-screen text-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none opacity-50" />
          <div className="relative z-10">
            <Routes>
              <Route path="/" element={<APMCatalog />} />
              <Route path="/traces" element={<TraceExplorer />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
