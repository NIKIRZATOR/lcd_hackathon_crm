import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { apiRequest, setAuthTokenProvider } from '../api/client';
import { AuthContext } from './AuthContext';
import { initKeycloak, keycloak } from './keycloak';
import type { AuthContextValue, AuthUser } from './types';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const getToken = useCallback(async () => {
    if (!keycloak.authenticated) {
      return undefined;
    }

    await keycloak.updateToken(30);
    return keycloak.token;
  }, []);

  const refreshUser = useCallback(async () => {
    if (!keycloak.authenticated) {
      setUser(null);
      return;
    }

    const currentUser = await apiRequest<AuthUser>('/api/auth/me');
    setUser(currentUser);
  }, []);

  const login = useCallback(async () => {
    await keycloak.login({
      redirectUri: window.location.origin,
    });
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await keycloak.logout({
      redirectUri: window.location.origin,
    });
  }, []);

  useEffect(() => {
    setAuthTokenProvider(getToken);

    initKeycloak()
      .then((isAuthenticated) => {
        setAuthenticated(isAuthenticated);
        setInitialized(true);
      })
      .catch((error) => {
        console.error('Keycloak initialization failed', error);
        setAuthenticated(false);
        setInitialized(true);
      });
  }, [getToken]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (authenticated) {
      queueMicrotask(() => {
        refreshUser().catch((error) => {
          console.error('Failed to load current user', error);
          setUser(null);
        });
      });
    } else {
      queueMicrotask(() => setUser(null));
    }
  }, [authenticated, initialized, refreshUser]);

  useEffect(() => {
    keycloak.onAuthSuccess = () => setAuthenticated(true);
    keycloak.onAuthLogout = () => {
      setAuthenticated(false);
      setUser(null);
    };
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => {
        setAuthenticated(false);
        setUser(null);
      });
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      authenticated,
      user,
      login,
      logout,
      getToken,
      refreshUser,
    }),
    [authenticated, getToken, initialized, login, logout, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
