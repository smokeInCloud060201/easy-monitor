import { NavLink } from 'react-router-dom';
import { Activity, List, Server, Zap, Network, BarChart3, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Sidebar() {
  const { user } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
      isActive
        ? 'bg-brand/10 text-brand-light font-semibold border-l-2 border-brand ml-[-1px]'
        : 'text-gray-400 hover:bg-sidebar-hover hover:text-gray-200'
    }`;

  return (
    <div className="w-60 h-screen bg-sidebar-bg text-white flex flex-col border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-light flex items-center justify-center shadow-glow-sm">
          <BarChart3 size={16} className="text-white" />
        </div>
        <span className="text-[15px] font-bold tracking-tight bg-gradient-to-r from-brand-light to-purple-300 bg-clip-text text-transparent">
          EasyMonitor
        </span>
      </div>

      <nav className="flex-1 flex flex-col px-3 overflow-y-auto">
        {/* Monitoring */}
        <div className="section-header px-3 pt-4 pb-2">Monitoring</div>
        <NavLink to="/" className={linkClass}>
          <Activity size={16} />
          <span>Metrics</span>
        </NavLink>
        <NavLink to="/apm" className={linkClass}>
          <Server size={16} />
          <span>APM</span>
        </NavLink>
        <NavLink to="/service-map" className={linkClass}>
          <Network size={16} />
          <span>Service Map</span>
        </NavLink>

        {/* Analysis */}
        <div className="section-header px-3 pt-5 pb-2">Analysis</div>
        <NavLink to="/traces" className={linkClass}>
          <Zap size={16} />
          <span>Traces</span>
        </NavLink>
        <NavLink to="/logs" className={linkClass}>
          <List size={16} />
          <span>Logs</span>
        </NavLink>

        {/* Admin */}
        {user?.role === 'Admin' && (
          <>
            <div className="section-header px-3 pt-5 pb-2">Admin</div>
            <NavLink to="/admin/users" className={linkClass}>
              <Shield size={16} />
              <span>Users & Access</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-sidebar-border">
        <div className="text-[10px] text-gray-600">
          EasyMonitor v1.0 · Observability
        </div>
      </div>
    </div>
  );
}
