import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function UserMenu() {
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
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Avatar button */}
      <button
        id="user-menu-button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: open ? '#1f2937' : 'transparent',
          border: '1px solid transparent',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.15s',
          color: '#d1d5db',
        }}
        onMouseEnter={e => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = '#1f2937';
        }}
        onMouseLeave={e => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        {/* Avatar circle */}
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 700,
          color: '#fff',
        }}>
          {initials}
        </div>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>{user.sub}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          marginTop: '4px',
          width: '200px',
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          zIndex: 50,
        }}>
          {/* User info */}
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid #374151',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f9fafb' }}>
              {user.sub}
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '4px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              backgroundColor: user.role === 'Admin'
                ? 'rgba(168, 85, 247, 0.15)'
                : 'rgba(59, 130, 246, 0.15)',
              color: user.role === 'Admin' ? '#a855f7' : '#3b82f6',
            }}>
              {user.role}
            </div>
          </div>

          {/* Sign out */}
          <button
            id="logout-button"
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: 'transparent',
              border: 'none',
              borderTop: 'none',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#111827'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
