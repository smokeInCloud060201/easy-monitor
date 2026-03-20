import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function AdminGuard() {
  const { user } = useAuth();

  if (user?.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
