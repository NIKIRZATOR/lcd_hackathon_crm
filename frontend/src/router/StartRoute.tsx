import { Button, Result, Spin } from 'antd';

import { useAuth } from '../auth';
import Layout from '../layout';
import LoginPage from '../pages/login/LoginPage';
import { allowedRoles } from './constants';

const centeredStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
};

const StartRoute = () => {
  const { authenticated, initialized, logout, user } = useAuth();

  if (!initialized) {
    return (
      <div style={centeredStyle}>
        <Spin size="large" />
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  if (!user) {
    return (
      <div style={centeredStyle}>
        <Spin size="large" />
      </div>
    );
  }

  const hasRequiredRole = user.roles.some((role) => allowedRoles.includes(role));

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

  return <Layout />;
};

export default StartRoute;
