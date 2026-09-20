import {
  BellOutlined,
  LogoutOutlined,
  MenuOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Avatar, Badge, Button, Divider, Dropdown, Layout, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';
import styles from './Header.module.scss';

const { Header: HeaderAnt } = Layout;
const { Text } = Typography;

type HeaderProps = {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
};

const userMenuItems: MenuProps['items'] = [
  {
    key: 'profile',
    label: 'Профиль',
    icon: <UserOutlined />,
  },
  {
    key: 'settings',
    label: 'Настройки',
    icon: <SettingOutlined />,
  },
  {
    type: 'divider',
  },
  {
    key: 'logout',
    label: 'Выйти',
    icon: <LogoutOutlined />,
    danger: true,
  },
];

const Header = ({ showMenuButton, onMenuClick }: HeaderProps) => {
  const { logout, user } = useAuth();

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile') {
      console.log('Профиль');
    }

    if (key === 'settings') {
      console.log('Настройки');
    }

    if (key === 'logout') {
      void logout();
    }
  };

  return (
    <HeaderAnt className={styles.header}>
      <div className={styles.left}>
        {showMenuButton && (
          <Button
            type="text"
            shape="circle"
            icon={<MenuOutlined />}
            onClick={onMenuClick}
            className={styles.menuButton}
          />
        )}

        <Link to="/" className={styles.logoLink}>
          <Text className={styles.logoMain}>RTK</Text>
          <Text className={styles.logoAccent}>EduFlow</Text>
        </Link>
      </div>

      <Space size={16}>
        <Badge dot offset={[-3, 3]}>
          <Button
            className={styles.notification}
            type="text"
            shape="circle"
            icon={<BellOutlined />}
          />
        </Badge>

        <Divider vertical className={styles.divider} />

        <Dropdown
          menu={{
            items: userMenuItems,
            onClick: handleUserMenuClick,
          }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Space size={10} className={styles.user}>
            <Avatar size={40} className={styles.avatar}>
              {(user?.full_name ?? user?.username ?? 'RT').slice(0, 2).toUpperCase()}
            </Avatar>
            <Text className={styles.username}>
              {user?.full_name ?? user?.username ?? 'Пользователь'}
            </Text>
          </Space>
        </Dropdown>
      </Space>
    </HeaderAnt>
  );
};

export default Header;
