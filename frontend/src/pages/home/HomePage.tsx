import { useAuth } from '../../auth';

import KamHomePage from './KamHomePage';
import NbaTodayPage from './NbaTodayPage';

const V2HomePage = () => {
  const { user } = useAuth();
  const roles = user?.roles ?? [];

  if (roles.includes('ADMIN') || roles.includes('MANAGER')) {
    return <NbaTodayPage />;
  }

  return <KamHomePage />;
};

export default V2HomePage;
