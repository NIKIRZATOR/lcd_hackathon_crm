import React, { useState } from 'react';
import {
  BarChartOutlined,
  BankOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  HomeOutlined,
  ProductOutlined,
  ReadOutlined,
  TrophyOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Drawer, Grid, Layout as LayoutAnt, Menu } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import Header from './header';

const { Content, Sider } = LayoutAnt;
const { useBreakpoint } = Grid;

type MenuItem = Required<MenuProps>['items'][number];

const navigationItems = [
  {
    path: '/',
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
    path: '/tasks',
    title: 'Мои задачи',
    icon: <CheckSquareOutlined />,
  },
  {
    path: '/programs',
    title: 'Программы',
    icon: <ReadOutlined />,
  },
  {
    path: '/products',
    title: 'ИТ-продукты',
    icon: <ProductOutlined />,
  },
  {
    path: '/analytics',
    title: 'Аналитика',
    icon: <BarChartOutlined />,
  },
  {
    path: '/rating',
    title: 'Рейтинг',
    icon: <TrophyOutlined />,
  },
  {
    path: '/reports',
    title: 'Отчеты',
    icon: <FileTextOutlined />,
  },
];

const items: MenuItem[] = navigationItems.map((item) => ({
  key: item.path,
  label: item.title,
  icon: item.icon,
}));

const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    setMobileMenuOpen(false);
  };

  const menu = (
    <Menu
      mode="inline"
      items={items}
      selectedKeys={[location.pathname]}
      onClick={handleMenuClick}
      style={{
        height: '100%',
        borderInlineEnd: 0,
      }}
    />
  );

  return (
    <LayoutAnt style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          theme="light"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'auto',
          }}
        >
          {menu}
        </Sider>
      )}

      <LayoutAnt>
        <Header showMenuButton={isMobile} onMenuClick={() => setMobileMenuOpen(true)} />

        <Content
          style={{
            padding: 24,
          }}
        >
          <Outlet />
        </Content>
      </LayoutAnt>

      <Drawer
        open={isMobile && mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="left"
        size={240}
        closable={false}
        styles={{
          body: {
            padding: 0,
          },
        }}
      >
        {menu}
      </Drawer>
    </LayoutAnt>
  );
};

export default Layout;
