import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--ultra)" />
    <path d="M7 12h18v3a2 2 0 0 0 0 4v3H7v-3a2 2 0 0 0 0-4z" fill="var(--marigold)" />
  </svg>
);

export default function Layout() {
  const { user, logout, canManageEvents } = useAuth();
  const navigate = useNavigate();
  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand"><Logo /> Campus Events</Link>
          <nav aria-label="Main" className="nav">
            <NavLink to="/" end className={link}>Events</NavLink>
            {user && <NavLink to="/dashboard" className={link}>Dashboard</NavLink>}
            {canManageEvents && <NavLink to="/events/new" className={link}>Create event</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin/users" className={link}>Users</NavLink>}
          </nav>
          <div className="account">
            {user ? (
              <>
                <span className="who">
                  <strong>{user.name}</strong>
                  <span className={`role role-${user.role}`}>{user.role}</span>
                </span>
                <button className="btn btn-quiet" onClick={() => { logout(); navigate('/'); }}>Log out</button>
              </>
            ) : (
              <>
                <Link className="btn btn-quiet" to="/login">Log in</Link>
                <Link className="btn btn-primary" to="/register">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main"><Outlet /></main>
      <footer className="footer">Campus Events: find it, register, show up.</footer>
    </>
  );
}
