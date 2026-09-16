import React, { useState } from 'react';
import {
  BarChartOutlined,
  BankOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  FileTextOutlined,
  ProductOutlined,
  ReadOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Layout as LayoutAnt, Menu } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import Header from './header';

const { Content, Sider } = LayoutAnt;

type MenuItem = Required<MenuProps>['items'][number];

const navigationItems = [
  {
    path: '/dashboard',
    title: 'Дашборд',
    icon: <DashboardOutlined />,
  },
  {
    path: '/universities',
    title: 'Вузы',
    icon: <BankOutlined />,
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

  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  return (
    <LayoutAnt style={{ minHeight: '100vh' }}>
      <Sider theme="light" collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <Menu
          mode="inline"
          items={items}
          selectedKeys={[location.pathname]}
          onClick={handleMenuClick}
          style={{
            height: '100%',
          }}
        />
      </Sider>
      <LayoutAnt>
        <Header />
        <Content
          style={{
            padding: 24,
          }}
        >
          <Outlet />
        </Content>
      </LayoutAnt>
    </LayoutAnt>
  );
};

export default Layout;
