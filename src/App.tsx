import { PageMotion } from './components/PageMotion';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useApp } from './context';
import { Layout } from './components/Layout';
import { Empty, Loading } from './components/ui';
import { Auth } from './pages/Auth';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { ProjectForm } from './pages/ProjectForm';
import { People, Recommendations } from './pages/People';
import { Requests } from './pages/Requests';
import { Chat } from './pages/Chat';
import { Profile } from './pages/Profile';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { Landing } from './pages/Landing';

function Private() {
  const { user, loading } = useApp();
  const location = useLocation();
  if (loading) return <Loading />;
  return user ? (
    <Outlet />
  ) : (
    <Navigate
      to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
      replace
    />
  );
}
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export function App() {
  return (
    <BrowserRouter>
      <ScrollTop />
      <PageMotion />
      <Routes>
        <Route path="/" element={<Landing />} />
        {(['login', 'register', 'forgot', 'reset', 'verify', 'resend'] as const).map(mode => (
          <Route key={mode} path={`/${mode}`} element={<Auth key={mode} mode={mode} />} />
        ))}
        <Route element={<Layout />}>
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route element={<Private />}>
            <Route path="/projects/new" element={<ProjectForm />} />
            <Route path="/projects/:id/edit" element={<ProjectForm />} />
            <Route path="/my-projects" element={<Projects mine />} />
            <Route path="/people" element={<People />} />
            <Route path="/people/:id" element={<Profile />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route
            path="*"
            element={
              <Empty
                title="Хуудас олдсонгүй"
                text="Үндсэн цэснээс хэрэгтэй хэсэг рүүгээ шилжинэ үү."
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

