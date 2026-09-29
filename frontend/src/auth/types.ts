export type AuthUser = {
  id: string;
  keycloak_user_id: string;
  username: string;
  email: string | null;
  full_name: string;
  roles: string[];
};

export type AuthContextValue = {
  initialized: boolean;
  authenticated: boolean;

  user: AuthUser | null;
  userLoading: boolean;
  userError: Error | null;

  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | undefined>;
  refreshUser: () => Promise<void>;
};
