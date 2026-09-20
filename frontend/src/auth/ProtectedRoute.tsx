import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';

import { Button, Result, Spin } from 'antd';

import { useAuth } from './useAuth';

const centeredStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
};

type ProtectedRouteProps = PropsWithChildren<{
  allowedRoles?: string[];
}>;

export const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { authenticated, initialized, login, logout, user } = useAuth();

  useEffect(() => {
    if (initialized && !authenticated) {
      login();
    }
  }, [authenticated, initialized, login]);

  if (!initialized || !authenticated || !user) {
    return (
      <div style={centeredStyle}>
        <Spin size="large" />
      </div>
    );
  }

  const hasRequiredRole =
    !allowedRoles?.length || user.roles.some((role) => allowedRoles.includes(role));

  if (!hasRequiredRole) {
    return (
      <div style={centeredStyle}>
        <Result
          status="403"
          title="Нет доступа"
          subTitle="У вашей учетной записи нет роли для работы в RTK EduFlow."
          extra={
            <Button type="primary" onClick={() => void logout()}>
              Выйти
            </Button>
          }
        />
      </div>
    );
  }

  return children;
};
