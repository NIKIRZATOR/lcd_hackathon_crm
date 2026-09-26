import {
  BellOutlined,
  HomeOutlined,
  BankOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Avatar, Badge, Button, Drawer, Dropdown, Grid, Layout, Menu, Typography } from 'antd';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth';

import styles from './Header.module.scss';

const { Header: HeaderAnt } = Layout;
const { Text } = Typography;

const navigationItems = [
  {
    path: '/home',
    title: 'Главная',
    icon: <HomeOutlined />,
  },
  {
    path: '/universities',
    title: 'Вузы',
    icon: <BankOutlined />,
  },
  {
    path: '/workflow',
    title: 'Workflow',
    icon: <ApartmentOutlined />,
  },
  {
    path: '/reports',
    title: 'Отчёты',
    icon: <FileTextOutlined />,
  },
];

const roleLabels: Record<string, string> = {
  KAM: 'KAM',
  MANAGER: 'Руководитель',
  ADMIN: 'Администратор',
};

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const navigate = useNavigate();
  const location = useLocation();

  const { logout, user } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }

    return location.pathname.startsWith(path);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      void logout();
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      label: 'Выйти',
      icon: <LogoutOutlined />,
      danger: true,
    },
  ];

  const mobileMenuItems: MenuProps['items'] = navigationItems.map((item) => ({
    key: item.path,
    label: item.title,
    icon: item.icon,
  }));

  const userName = user?.full_name ?? user?.username ?? 'Пользователь';

  const userRole = user?.roles?.[0] ? (roleLabels[user.roles[0]] ?? user.roles[0]) : '';

  return (
    <>
      <HeaderAnt className={styles.header}>
        <div className={styles.left}>
          {isMobile && (
            <Button
              type="text"
              shape="circle"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
              className={styles.menuButton}
            />
          )}

          <Link to="/" className={styles.logoLink}>
            <Text className={styles.logoMain}>RTK</Text>
            <Text className={styles.logoAccent}>EduFlow</Text>
          </Link>

          {!isMobile && (
            <nav className={styles.navigation}>
              {navigationItems.map((item) => (
                <Button
                  key={item.path}
                  type="text"
                  className={`${styles.navigationButton} ${
                    isActive(item.path) ? styles.navigationButtonActive : ''
                  }`}
                  onClick={() => handleNavigation(item.path)}
                >
                  {item.title}
                </Button>
              ))}
            </nav>
          )}
        </div>

        <div className={styles.right}>
          <Badge dot offset={[-3, 3]}>
            <Button
              type="text"
              shape="circle"
              icon={<BellOutlined />}
              className={styles.notification}
            />
          </Badge>

          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: handleUserMenuClick,
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <div className={styles.user}>
              <Avatar size={40} className={styles.avatar}>
                {userName.slice(0, 2).toUpperCase()}
              </Avatar>

              <div className={styles.userInfo}>
                <Text className={styles.username}>{userName}</Text>

                {userRole && <Text className={styles.role}>{userRole}</Text>}
              </div>
            </div>
          </Dropdown>
        </div>
      </HeaderAnt>

      <Drawer
        open={isMobile && mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="left"
        size={280}
        title={
          <Link to="/" className={styles.drawerLogo} onClick={() => setMobileMenuOpen(false)}>
            <span className={styles.logoMain}>RTK</span>
            <span className={styles.logoAccent}>EduFlow</span>
          </Link>
        }
        styles={{
          body: {
            padding: '8px 0',
          },
        }}
      >
        <Menu
          mode="inline"
          items={mobileMenuItems}
          selectedKeys={[navigationItems.find((item) => isActive(item.path))?.path ?? '']}
          onClick={({ key }) => handleNavigation(key)}
          className={styles.mobileMenu}
        />
      </Drawer>
    </>
  );
};

export default Header;
