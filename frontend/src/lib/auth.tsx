import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'author' | 'viewer';
  permissions: string[];
  preferences?: Record<string, any>;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): void;
  can(p: string): boolean;
  refresh(): Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setLoading(false); return; }
    try {
      setUser(await api.get<User>('/auth/me'));
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { tokenStore.clear(); setUser(null); });
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    tokenStore.set(r.token);
    setUser(r.user);
  };

  const can = (p: string) => !!user?.permissions?.includes(p);

  return <Ctx.Provider value={{ user, loading, login, logout, can, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
