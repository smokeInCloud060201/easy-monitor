import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';

export function MainLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-gray-100 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 border-b border-sidebar-border bg-surface-dark/50 backdrop-blur-sm" style={{ minHeight: '48px' }}>
          <div className="text-[11px] text-gray-600 tracking-wide">
            OBSERVABILITY PLATFORM
          </div>
          <UserMenu />
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-auto flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
