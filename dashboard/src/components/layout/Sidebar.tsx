import { NavLink } from 'react-router-dom';
import { Activity, List, Server, Zap, Network, BarChart3, Shield, Database, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserMenu } from './UserMenu';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const { user } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 relative group ${
      isActive
        ? 'bg-brand/10 text-brand dark:text-brand-light font-semibold border-l-2 border-brand ml-[-1px]'
        : 'text-text-muted hover:bg-sidebar-hover hover:text-text-primary'
    } ${isCollapsed ? 'justify-center border-l-0 ml-0' : ''}`;

  const spanClass = `whitespace-nowrap transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`;

  return (
    <div className={`h-screen bg-sidebar-bg text-text-primary flex flex-col border-r border-sidebar-border transition-all duration-300 relative z-20 ${isCollapsed ? 'w-[68px]' : 'w-60'}`}>
      
      {/* Collapse Toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute -right-3 top-6 bg-sidebar-bg border border-sidebar-border rounded-full p-1 text-text-muted hover:text-text-primary hover:border-text-muted transition-all z-50 ${isCollapsed ? 'rotate-180' : ''}`}
      >
        <ChevronLeft size={14} />
      </button>

      {/* Brand */}
      <div className={`px-4 py-5 flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-hover dark:to-brand-light flex items-center justify-center shadow-glow-sm shrink-0">
          <BarChart3 size={16} className="text-white dark:text-text-primary" />
        </div>
        <span className={`text-[15px] font-bold tracking-tight bg-gradient-to-r from-brand to-purple-600 dark:from-brand-light dark:to-purple-300 bg-clip-text text-transparent whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'opacity-100'}`}>
          EasyMonitor
        </span>
      </div>

      <nav className="flex-1 flex flex-col px-3 overflow-y-auto overflow-x-hidden no-scrollbar">
        {/* Monitoring */}
        <div className={`section-header px-3 pt-4 pb-2 transition-all duration-300 ${isCollapsed ? 'text-center opacity-50 px-0' : ''}`}>
          {isCollapsed ? '...' : 'Monitoring'}
        </div>
        <NavLink to="/" className={linkClass} title={isCollapsed ? "Metrics" : undefined}>
          <Activity size={16} className="shrink-0" />
          <span className={spanClass}>Metrics</span>
        </NavLink>
        <NavLink to="/apm" className={linkClass} title={isCollapsed ? "APM" : undefined}>
          <Server size={16} className="shrink-0" />
          <span className={spanClass}>APM</span>
        </NavLink>
        <NavLink to="/service-map" className={linkClass} title={isCollapsed ? "Service Map" : undefined}>
          <Network size={16} className="shrink-0" />
          <span className={spanClass}>Service Map</span>
        </NavLink>
        <NavLink to="/databases" className={linkClass} title={isCollapsed ? "Databases" : undefined}>
          <Database size={16} className="shrink-0" />
          <span className={spanClass}>Databases</span>
        </NavLink>

        {/* Analysis */}
        <div className={`section-header px-3 pt-5 pb-2 transition-all duration-300 ${isCollapsed ? 'text-center opacity-50 px-0' : ''}`}>
          {isCollapsed ? '...' : 'Analysis'}
        </div>
        <NavLink to="/traces" className={linkClass} title={isCollapsed ? "Traces" : undefined}>
          <Zap size={16} className="shrink-0" />
          <span className={spanClass}>Traces</span>
        </NavLink>
        <NavLink to="/logs" className={linkClass} title={isCollapsed ? "Logs" : undefined}>
          <List size={16} className="shrink-0" />
          <span className={spanClass}>Logs</span>
        </NavLink>

        {/* Admin */}
        {user?.role === 'Admin' && (
          <>
            <div className={`section-header px-3 pt-5 pb-2 transition-all duration-300 ${isCollapsed ? 'text-center opacity-50 px-0' : ''}`}>
              {isCollapsed ? '...' : 'Admin'}
            </div>
            <NavLink to="/admin/users" className={linkClass} title={isCollapsed ? "Users & Access" : undefined}>
              <Shield size={16} className="shrink-0" />
              <span className={spanClass}>Users & Access</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border flex flex-col gap-3">
        <UserMenu isCollapsed={isCollapsed} />
        <div className={`text-[10px] text-text-muted text-center whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'h-0 opacity-0 m-0' : 'h-auto opacity-100'}`}>
          EasyMonitor v1.0
        </div>
      </div>
    </div>
  );
}
