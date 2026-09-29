export type AuthUser = {
  id: string;
  keycloak_user_id: string;
  username: string;
  email: string | null;
  full_name: string;
  roles: string[];
  has_avatar: boolean;
  supervisor_name: string | null;
  team_members: string[];
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
