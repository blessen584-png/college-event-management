import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.addEventListener('cems:unauthorized', logout);
    return () => window.removeEventListener('cems:unauthorized', logout);
  }, [logout]);

  const authenticate = useCallback(async (path, body) => {
    const data = await api(path, { method: 'POST', body });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: (body) => authenticate('/auth/login', body),
      register: (body) => authenticate('/auth/register', body),
      logout,
      canManageEvents: user?.role === 'organizer' || user?.role === 'admin',
    }),
    [user, loading, authenticate, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
