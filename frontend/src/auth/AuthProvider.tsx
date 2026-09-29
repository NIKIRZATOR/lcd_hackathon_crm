import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { apiRequest, setAuthTokenProvider } from '../api/client';
import { AuthContext } from './AuthContext';
import { initKeycloak, keycloak } from './keycloak';
import type { AuthContextValue, AuthUser } from './types';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();

  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const getToken = useCallback(async () => {
    if (!keycloak.authenticated) {
      return undefined;
    }

    await keycloak.updateToken(30);

    return keycloak.token;
  }, []);

  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiRequest<AuthUser>('/api/auth/me'),
    enabled: initialized && authenticated,
    staleTime: 5 * 60 * 1000,
  });

  const refreshUser = useCallback(async () => {
    if (!authenticated) {
      return;
    }

    await refetchUser();
  }, [authenticated, refetchUser]);

  const login = useCallback(async () => {
    await keycloak.login({
      redirectUri: window.location.origin,
    });
  }, []);

  const logout = useCallback(async () => {
    queryClient.clear();

    await keycloak.logout({
      redirectUri: window.location.origin,
    });
  }, [queryClient]);

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
    keycloak.onAuthSuccess = () => {
      setAuthenticated(true);
    };

    keycloak.onAuthLogout = () => {
      queryClient.clear();
      setAuthenticated(false);
    };

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch((error) => {
        console.error('Failed to refresh Keycloak token', error);

        queryClient.clear();
        setAuthenticated(false);
      });
    };

    return () => {
      keycloak.onAuthSuccess = undefined;
      keycloak.onAuthLogout = undefined;
      keycloak.onTokenExpired = undefined;
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      authenticated,
      user: user ?? null,
      userLoading,
      userError,
      login,
      logout,
      getToken,
      refreshUser,
    }),
    [
      authenticated,
      getToken,
      initialized,
      login,
      logout,
      refreshUser,
      user,
      userError,
      userLoading,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
