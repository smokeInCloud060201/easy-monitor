import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30">
      <Sidebar />
      <main className="flex-1 overflow-auto flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
