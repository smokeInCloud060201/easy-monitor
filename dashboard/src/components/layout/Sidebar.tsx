import { NavLink } from 'react-router-dom';
import { Activity, List, Users, Server, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Sidebar() {
  const { user } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
      isActive ? 'bg-blue-500/10 text-blue-400 font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <div className="w-64 h-screen bg-gray-900 text-white flex flex-col pt-6 border-r border-gray-800">
      <div className="px-6 mb-8 text-xl font-bold tracking-tight text-blue-400">EasyMonitor</div>
      <nav className="flex-1 flex flex-col gap-2 px-3">
        <NavLink to="/" className={linkClass}>
          <Activity size={18} />
          <span>Metrics</span>
        </NavLink>
        <NavLink to="/apm" className={linkClass}>
          <Server size={18} />
          <span>APM</span>
        </NavLink>
        <NavLink to="/traces" className={linkClass}>
          <Zap size={18} />
          <span>Traces</span>
        </NavLink>
        <NavLink to="/logs" className={linkClass}>
          <List size={18} />
          <span>Logs</span>
        </NavLink>
        {user?.role === 'Admin' && (
          <NavLink 
            to="/admin/users"
            className={({ isActive }) => 
              `flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                 isActive ? 'bg-blue-500/10 text-blue-400 font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Users size={18} />
            <span>Users</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}

