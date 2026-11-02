import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { cx } from '../lib/cx.js';
import { LogoutIcon, QrIcon } from './Icons.jsx';

const navClass = ({ isActive }) =>
  cx(
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  );

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <QrIcon className="h-5 w-5" />
            </span>
            <span>EventPass</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            <NavLink to="/" end className={navClass}>
              Events
            </NavLink>
            {user ? (
              <>
                <NavLink to="/organizer" className={navClass}>
                  My events
                </NavLink>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  title={`Signed in as ${user.email}`}
                >
                  <LogoutIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Log out</span>
                </button>
              </>
            ) : (
              <NavLink to="/login" className={navClass}>
                Organizer login
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        EventPass · Mobile-first event registration &amp; QR check-in
      </footer>
    </div>
  );
}
