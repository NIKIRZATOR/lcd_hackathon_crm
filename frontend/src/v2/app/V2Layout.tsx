import {
  BankOutlined,
  FileTextOutlined,
  HomeOutlined,
  MenuOutlined,
  SettingOutlined,
  ApartmentOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';
import { Button, Drawer, Grid, Layout, Menu, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth';
import DocumentationDrawer from '../documentation/DocumentationDrawer';

const { Content, Header, Sider } = Layout;
const { useBreakpoint } = Grid;

type NavigationItem = {
  key: string;
  label: string;
  icon: ReactNode;
  roles?: string[];
};

const navigation: NavigationItem[] = [
  { key: '/v2', label: 'Главная', icon: <HomeOutlined /> },
  { key: '/v2/organizations', label: 'Организации', icon: <BankOutlined /> },
  { key: '/v2/workflows', label: 'Воркфлоу', icon: <ApartmentOutlined /> },
  { key: '/v2/reports', label: 'Отчёты', icon: <FileTextOutlined /> },
  { key: '/v2/management', label: 'Управление', icon: <SettingOutlined />, roles: ['MANAGER', 'ADMIN'] },
];

const V2Layout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [documentationOpen, setDocumentationOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const items: MenuProps['items'] = navigation
    .filter((item) => !item.roles || user?.roles.some((role) => item.roles?.includes(role)))
    .map((item) => ({ key: item.key, label: item.label, icon: item.icon }));

  const selectedKey = [...navigation]
    .sort((left, right) => right.key.length - left.key.length)
    .find((item) => location.pathname === item.key || location.pathname.startsWith(`${item.key}/`))?.key;

  const menu = (
    <Menu
      mode="inline"
      items={items}
      selectedKeys={selectedKey ? [selectedKey] : []}
      onClick={({ key }) => {
        navigate(key);
        setMobileMenuOpen(false);
      }}
      style={{ height: '100%', borderInlineEnd: 0 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && <Sider theme="light">{menu}</Sider>}
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', justifyContent: 'space-between', padding: '0 24px' }}>
          <Space>
            {isMobile && <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} />}
            <Link to="/v2"><Typography.Title level={4} style={{ margin: 0 }}>RTK EduFlow</Typography.Title></Link>
            <Tag color="purple">CRM V2</Tag>
          </Space>
          <Space>
            <Button type="text" aria-label="Документация" icon={<QuestionCircleOutlined />} onClick={() => setDocumentationOpen(true)} />
            <Typography.Text>{user?.full_name ?? user?.username}</Typography.Text>
            {user?.roles.map((role) => <Tag key={role}>{role}</Tag>)}
            <Button type="link" onClick={() => void logout()}>Выйти</Button>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}><Outlet /></Content>
      </Layout>
      <Drawer open={isMobile && mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} placement="left" closable={false} styles={{ body: { padding: 0 } }}>
        {menu}
      </Drawer>
      <DocumentationDrawer open={documentationOpen} onClose={() => setDocumentationOpen(false)} />
    </Layout>
  );
};

export default V2Layout;
