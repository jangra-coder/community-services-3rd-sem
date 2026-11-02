/* eslint-disable react-refresh/only-export-components -- provider and hook belong together */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    api.auth
      .me()
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch((err) => {
        if (err.status === 401 || err.status === 404) tokenStore.clear();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.auth.login({ email, password });
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (body) => {
    const data = await api.auth.signup(body);
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, signup, logout }), [user, loading, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
