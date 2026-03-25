import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function UserMenu({ isCollapsed }: { isCollapsed?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const initials = user.sub.slice(0, 2).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      {/* Avatar button */}
      <button
        id="user-menu-button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 w-full rounded-lg cursor-pointer transition-colors border-none text-gray-300 hover:bg-gray-800 ${
          isCollapsed ? 'justify-center p-1.5' : 'justify-start px-3 py-1.5'
        } ${open ? 'bg-gray-800' : 'bg-transparent'}`}
      >
        {/* Avatar circle */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
          {initials}
        </div>
        
        {!isCollapsed && (
          <>
            <span className="text-[13px] font-medium flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">
              {user.sub}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50 shrink-0">
              <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div 
          className="absolute w-[200px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50"
          style={{
            left: isCollapsed ? '100%' : '0',
            bottom: isCollapsed ? '0' : '100%',
            marginLeft: isCollapsed ? '12px' : '0',
            marginBottom: isCollapsed ? '0' : '4px',
          }}
        >
          {/* User info */}
          <div className="px-3.5 py-3 border-b border-gray-700">
            <div className="text-[13px] font-semibold text-gray-50 whitespace-nowrap overflow-hidden text-ellipsis">
              {user.sub}
            </div>
            <div className={`inline-block mt-1 px-2 py-0.5 text-[11px] font-semibold rounded ${
              user.role === 'Admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'
            }`}>
              {user.role}
            </div>
          </div>

          {/* Sign out */}
          <button
            id="logout-button"
            onClick={handleLogout}
            className="w-full px-3.5 py-2.5 bg-transparent text-red-500 text-[13px] font-medium cursor-pointer text-left transition-colors hover:bg-gray-900 border-none"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
