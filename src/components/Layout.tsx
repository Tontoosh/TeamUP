import { useState } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Rocket,
  Users,
  Sparkles,
  FolderKanban,
  ClipboardList,
  MessageSquare,
  UserRound,
  Settings,
  ShieldCheck,
  Plus,
  Search,
  LogOut,
  Menu,
  ChevronRight,
  GraduationCap,
  X,
} from 'lucide-react';
import { useApp } from '../context';
import { useApi } from '../hooks';
import { Avatar, Brand } from './ui';
import { DemoSwitcher } from './DemoSwitcher';

const navigation = [
  ['/projects', 'Төсөл хайх', Rocket],
  ['/people', 'Хамтрагч хайх', Users],
  ['/recommendations', 'Танд санал болгох', Sparkles],
  ['/my-projects', 'Миний төслүүд', FolderKanban],
  ['/requests', 'Миний хүсэлтүүд', ClipboardList],
  ['/chat', 'Багийн чат', MessageSquare],
] as const;
export function Layout() {
  const { user, logout, demoMode } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data } = useApi<{ unread: number }>(
    user ? '/community/notifications?unread=true' : null,
    15000
  );
  return (
    <div className="app-shell">
      {open && (
        <button className="sidebar-backdrop" aria-label="Цэс хаах" onClick={() => setOpen(false)} />
      )}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <Brand />
        <button
          className="mobile-close icon-btn"
          onClick={() => setOpen(false)}
          aria-label="Цэс хаах"
        >
          <X />
        </button>
        <div className="nav-label">ҮНДСЭН ЦЭС</div>
        <nav>
          {navigation.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end onClick={() => setOpen(false)}>
              <Icon size={19} />
              <span>{label}</span>
              <ChevronRight size={14} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>
        <div className="nav-label personal-label">ХУВИЙН ТАНХИМ</div>
        <nav>
          <NavLink to="/notifications" onClick={() => setOpen(false)}>
            <Bell size={19} />
            Мэдэгдэл{!!data?.unread && <span className="count">{data.unread}</span>}
          </NavLink>
          <NavLink to="/profile" onClick={() => setOpen(false)}>
            <UserRound size={19} />
            Миний профайл
          </NavLink>
          <NavLink to="/settings" onClick={() => setOpen(false)}>
            <Settings size={19} />
            Тохиргоо
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" onClick={() => setOpen(false)}>
              <ShieldCheck size={19} />
              Админ удирдлага
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-note">
            <span className="mini-icon">
              <GraduationCap size={21} />
            </span>
            <div>
              <b>Санаанаас → бодит бүтээл</b>
              <p>Дараагийн алхмаа хамтдаа.</p>
            </div>
          </div>
          <span className="sidebar-copyright">
            TEAMUP © {new Date().getFullYear()} <span>✧</span>
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setOpen(true)}
            aria-label="Цэс нээх"
          >
            <Menu />
          </button>
          <form
            className="global-search"
            onSubmit={event => {
              event.preventDefault();
              navigate(`/projects?q=${encodeURIComponent(query)}`);
            }}
          >
            <Search size={18} />
            <input
              aria-label="Төсөл хайх"
              placeholder="Санаа, төсөл, ур чадвар хайх…"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="top-actions">
            <Link
              className="btn primary compact"
              to={user ? '/projects/new' : '/login?next=/projects/new'}
            >
              <Plus size={18} />
              <span>Төсөл үүсгэх</span>
            </Link>
            {user ? (
              <>
                <Link
                  className="icon-btn notification-button"
                  to="/notifications"
                  aria-label="Мэдэгдэл"
                >
                  <Bell size={21} />
                  {!!data?.unread && <i />}
                </Link>
                <div className="topbar-divider" />
                <Link className="account" to="/profile">
                  <Avatar name={user.name} />
                  <span>
                    <b>{user.name}</b>
                    <small>
                      {user.role === 'admin' ? 'Администратор' : `${user.school} · Оюутан`}
                    </small>
                  </span>
                </Link>
                {demoMode ? <DemoSwitcher /> : <button
                  className="icon-btn logout"
                  aria-label="Гарах"
                  onClick={async () => {
                    await logout();
                    navigate('/projects');
                  }}
                >
                  <LogOut size={17} />
                </button>}
              </>
            ) : (
              <Link to="/login" className="btn ghost">
                Нэвтрэх
              </Link>
            )}
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Хамтдаа бүтээх орон зай.</span>
          <Link to="/">Хамтдаа платформ ↗</Link>
        </footer>
      </div>
    </div>
  );
}
