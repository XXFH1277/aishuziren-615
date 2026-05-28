import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getAuthProfile, getStoredToken, login as loginRequest, logout as logoutRequest, setStoredToken } from '../services/authService';

const AuthContext = createContext(null);

function normalizeAuthPayload(payload = {}) {
  return {
    user: payload.user || null,
    roles: payload.roles || [],
    permissions: payload.permissions || [],
    menuPermissions: payload.menuPermissions || [],
    sessionExpiresAt: payload.sessionExpiresAt || '',
  };
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => normalizeAuthPayload());
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      setAuth(normalizeAuthPayload());
      setLoading(false);
      return null;
    }

    try {
      const profile = await getAuthProfile();
      const normalized = normalizeAuthPayload(profile);
      setAuth(normalized);
      return normalized;
    } catch {
      setStoredToken('');
      setAuth(normalizeAuthPayload());
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = useCallback(async (values) => {
    const result = await loginRequest(values);
    const normalized = normalizeAuthPayload(result);
    setAuth(normalized);
    return normalized;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setAuth(normalizeAuthPayload());
    }
  }, []);

  const value = useMemo(
    () => ({
      ...auth,
      loading,
      isAuthenticated: Boolean(auth.user),
      login,
      logout,
      reload: loadProfile,
    }),
    [auth, loadProfile, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
