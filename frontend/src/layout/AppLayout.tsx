import { ApartmentOutlined, BankOutlined, FileTextOutlined, HomeOutlined, MenuOutlined, QuestionCircleOutlined, SettingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';
import { Button, Drawer, FloatButton, Grid, Layout, Menu, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth';
import DocumentationDrawer from '../documentation/DocumentationDrawer';

import styles from './AppLayout.module.scss';

const { Content, Header } = Layout;
const { useBreakpoint } = Grid;

type NavigationItem = { key: string; label: string; icon: ReactNode; roles?: string[] };

const navigation: NavigationItem[] = [
  { key: '/home', label: 'Главная', icon: <HomeOutlined /> },
  { key: '/organizations', label: 'Организации', icon: <BankOutlined /> },
  { key: '/workflows', label: 'Воркфлоу', icon: <ApartmentOutlined /> },
  { key: '/reports', label: 'Отчёты', icon: <FileTextOutlined /> },
  { key: '/management', label: 'Управление', icon: <SettingOutlined />, roles: ['MANAGER', 'ADMIN'] },
];

const AppLayout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [documentationOpen, setDocumentationOpen] = useState(false);
  const isMobile = !useBreakpoint().md;
  const items = navigation.filter((item) => !item.roles || user?.roles.some((role) => item.roles?.includes(role)));
  const selectedKey = [...items].sort((left, right) => right.key.length - left.key.length).find((item) => location.pathname === item.key || location.pathname.startsWith(`${item.key}/`))?.key;
  const go = (key: string) => { navigate(key); setMobileMenuOpen(false); };
  const menuItems: MenuProps['items'] = items.map((item) => ({ key: item.key, label: item.label, icon: item.icon }));

  return <Layout className={styles.layout}>
    <Header className={styles.header}>
      <div className={styles.headerLeft}>
        {isMobile && <Button type="text" shape="circle" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} />}
        <Link to="/home" className={styles.logo}>RTK <span>EduFlow</span></Link>
        {!isMobile && <nav className={styles.navigation}>{items.map((item) => <Button key={item.key} type="text" className={item.key === selectedKey ? styles.navigationActive : styles.navigationButton} onClick={() => go(item.key)}>{item.label}</Button>)}</nav>}
      </div>
      <Space className={styles.headerRight}>
        <Button type="text" aria-label="Документация" icon={<QuestionCircleOutlined />} onClick={() => setDocumentationOpen(true)} />
        <Typography.Text className={styles.userName}>{user?.full_name ?? user?.username}</Typography.Text>
        {user?.roles.map((role) => <Tag key={role}>{role}</Tag>)}
        <Button type="link" onClick={() => void logout()}>Выйти</Button>
      </Space>
    </Header>
    <Content className={styles.content}><div className={styles.contentInner}><Outlet /></div></Content>
    <Drawer open={isMobile && mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} placement="left" closable={false} styles={{ body: { padding: 0 } }}><Menu mode="inline" items={menuItems} selectedKeys={selectedKey ? [selectedKey] : []} onClick={({ key }) => go(key)} /></Drawer>
    <FloatButton.BackTop />
    <DocumentationDrawer open={documentationOpen} onClose={() => setDocumentationOpen(false)} />
  </Layout>;
};

export default AppLayout;
