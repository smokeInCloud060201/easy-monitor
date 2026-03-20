import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';

export function MainLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with user menu */}
        <header className="flex items-center justify-end px-4 py-2 border-b border-gray-800/50" style={{ minHeight: '48px' }}>
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
