import type { ComponentType } from 'react';

import { useAuth } from '../../auth';

import AdminHomePage from './AdminHomePage';
import KamHomePage from './KamHomePage';
import ManagerHomePage from './ManagerHomePage';

const HOME_PAGE_BY_ROLE: Record<string, ComponentType> = {
  ADMIN: AdminHomePage,
  MANAGER: ManagerHomePage,
  KAM: KamHomePage,
};

const ROLE_PRIORITY = ['ADMIN', 'MANAGER', 'KAM'];

const HomePage = () => {
  const { user } = useAuth();

  const role = ROLE_PRIORITY.find((role) => user?.roles.includes(role));

  if (!role) {
    return null;
  }

  const RoleHomePage = HOME_PAGE_BY_ROLE[role];

  return <RoleHomePage />;
};

export default HomePage;
