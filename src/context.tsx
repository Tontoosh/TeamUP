import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, post } from './api';
import type { User } from './types';

interface AppContext {
  user: User | null;
  loading: boolean;
  googleEnabled: boolean;
  localMail: boolean;
  demoMode: boolean;
  demoRole: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  toast: (message: string, error?: boolean) => void;
}
const Context = createContext<AppContext>(null!);
export const useApp = () => useContext(Context);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogle] = useState(false);
  const [localMail, setLocalMail] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoRole, setDemoRole] = useState('student');
  const [notice, setNotice] = useState({ text: '', error: false, key: 0 });
  const toast = useCallback(
    (text: string, error = false) => setNotice({ text, error, key: Date.now() }),
    []
  );
  const refresh = useCallback(async () => {
    const data = await api<{
      user: User | null; googleEnabled: boolean; localMail: boolean;
      demoMode: boolean; demoRole: string | null;
    }>(
      '/auth/me'
    );
    setUser(data.user);
    setGoogle(data.googleEnabled);
    setLocalMail(data.localMail);
    setDemoMode(data.demoMode);
    setDemoRole(data.demoRole || 'student');
  }, []);
  useEffect(() => {
    refresh()
      .catch(error => toast(error.message, true))
      .finally(() => setLoading(false));
  }, [refresh, toast]);
  useEffect(() => {
    if (!notice.text) return;
    const timer = setTimeout(() => setNotice(prev => ({ ...prev, text: '' })), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const logout = async () => {
    await post('/auth/logout');
    setUser(null);
  };
  return (
    <Context.Provider value={{ user, loading, googleEnabled, localMail, demoMode, demoRole, refresh, logout, toast }}>
      {children}
      {notice.text && (
        <div
          className={`toast ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.text}
          <button aria-label="Хаах" onClick={() => setNotice(prev => ({ ...prev, text: '' }))}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
