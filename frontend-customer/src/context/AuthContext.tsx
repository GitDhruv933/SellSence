import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '@/api/client';
import type { AuthUser, Role } from '@/api/types';

export interface SignupPayload {
  phone: string;
  password: string;
  name: string;
  role: Role;
  shop_name?: string;
  shop_category?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (phone: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/auth/login', { phone, password });
    setToken(res.token);
    setUser(res.user);
  };

  const signup = async (payload: SignupPayload) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/auth/signup', payload);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (patch: Partial<AuthUser>) => {
    const res = await api.put<{ user: AuthUser }>('/auth/me', patch);
    setUser(res.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
