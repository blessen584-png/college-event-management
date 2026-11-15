import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Loading } from './ui.jsx';

export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page narrow">
        <div className="empty">
          <h2>You don’t have access to this page</h2>
          <p>This area is for {roles.join(' and ')} accounts.</p>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
