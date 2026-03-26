import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

export function UserMenu({ isCollapsed }: { isCollapsed?: boolean }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
        className={`flex items-center gap-2 w-full rounded-lg cursor-pointer transition-colors border-none text-text-primary hover:bg-surface-light ${
          isCollapsed ? 'justify-center p-1.5' : 'justify-start px-3 py-1.5'
        } ${open ? 'bg-surface-light' : 'bg-transparent'}`}
      >
        {/* Avatar circle */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[11px] font-bold text-text-primary shrink-0">
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
          className="absolute w-[200px] bg-surface border border-border rounded-lg shadow-xl overflow-hidden z-50"
          style={{
            left: isCollapsed ? '100%' : '0',
            bottom: isCollapsed ? '0' : '100%',
            marginLeft: isCollapsed ? '12px' : '0',
            marginBottom: isCollapsed ? '0' : '4px',
          }}
        >
          {/* User info */}
          <div className="px-3.5 py-3 border-b border-border">
            <div className="text-[13px] font-semibold text-text-inverse whitespace-nowrap overflow-hidden text-ellipsis">
              {user.sub}
            </div>
            <div className={`inline-block mt-1 px-2 py-0.5 text-[11px] font-semibold rounded ${
              user.role === 'Admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'
            }`}>
              {user.role}
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleTheme();
            }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 bg-transparent text-text-primary text-[13px] font-medium cursor-pointer text-left transition-colors hover:bg-surface-light border-b border-border hover:text-text-inverse"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          {/* Sign out */}
          <button
            id="logout-button"
            onClick={handleLogout}
            className="w-full px-3.5 py-2.5 bg-transparent text-danger text-[13px] font-medium cursor-pointer text-left transition-colors hover:bg-surface-light border-none"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
