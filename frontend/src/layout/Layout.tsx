import { FloatButton, Layout as LayoutAnt } from 'antd';
import { Outlet } from 'react-router-dom';

import Header from './header';

import styles from './Layout.module.scss';

const { Content } = LayoutAnt;

const Layout = () => {
  return (
    <LayoutAnt className={styles.layout}>
      <Header />

      <Content className={styles.content}>
        <div className={styles.contentInner}>
          <Outlet />
        </div>
      </Content>
      <FloatButton.BackTop />
    </LayoutAnt>
  );
};

export default Layout;
