import {
  ArrowRightOutlined,
  BarChartOutlined,
  BankOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Divider, Form, Input, Typography } from 'antd';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../../auth';
import styles from './LoginPage.module.scss';

const { Paragraph, Text, Title } = Typography;

const advantages = [
  {
    title: 'Единая платформа',
    description: 'Четко',
    icon: <TeamOutlined />,
  },
  {
    title: 'Аналитика и инсайты',
    description: 'Данные ради данных',
    icon: <BarChartOutlined />,
  },
  {
    title: 'Надежный доступ',
    description: 'Keycloak.',
    icon: <SafetyCertificateOutlined />,
  },
];

const LoginPage = () => {
  const { authenticated, initialized, login } = useAuth();

  const handleLogin = () => {
    console.log('RTK EduFlow login submit placeholder');
  };

  const handleKeycloakLogin = () => {
    void login();
  };

  if (initialized && authenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className={styles.page}>
      <section className={styles.infoPanel}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <BankOutlined />
          </div>
          <div>
            <Text className={styles.logoText}>
              RTK <span>EduFlow</span>
            </Text>
            <Paragraph className={styles.logoDescription}>
              Развитие образования в новых возможностях
            </Paragraph>
          </div>
        </div>

        <div className={styles.advantages}>
          {advantages.map((advantage) => (
            <div className={styles.advantage} key={advantage.title}>
              <div className={styles.advantageIcon}>{advantage.icon}</div>
              <div>
                <Text className={styles.advantageTitle}>{advantage.title}</Text>
                <Paragraph className={styles.advantageDescription}>
                  {advantage.description}
                </Paragraph>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.formPanel} aria-label="Авторизация">
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <Title level={1} className={styles.formTitle}>
              Вход в RTK EduFlow
            </Title>
          </div>

          <Form layout="vertical" requiredMark={false} onFinish={handleLogin}>
            <Form.Item
              label="Email или логин"
              name="login"
              rules={[{ required: true, message: 'Введите email или логин' }]}
            >
              <Input size="large" prefix={<MailOutlined />} placeholder="Введите email или логин" />
            </Form.Item>

            <Form.Item
              label="Пароль"
              name="password"
              rules={[{ required: true, message: 'Введите пароль' }]}
            >
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="Введите пароль" />
            </Form.Item>

            <Button
              block
              size="large"
              type="primary"
              htmlType="submit"
              icon={<ArrowRightOutlined />}
              iconPosition="end"
              className={styles.loginButton}
            >
              Войти
            </Button>
          </Form>

          <Divider plain className={styles.divider}>
            или
          </Divider>

          <Button
            block
            size="large"
            type="default"
            loading={!initialized}
            onClick={handleKeycloakLogin}
            icon={<SafetyCertificateOutlined />}
            className={styles.keycloakButton}
          >
            Войти через Keycloak
          </Button>

          <div className={styles.securityNote}>
            <SafetyCertificateOutlined />
            <div>
              <Text className={styles.securityTitle}>Безопасный доступ</Text>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
