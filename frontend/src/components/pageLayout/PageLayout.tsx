import { Typography } from 'antd';
import type { PropsWithChildren } from 'react';

const { Title } = Typography;

interface PageLayoutProps extends PropsWithChildren {
  title?: string;
}

const PageLayout = ({ title, children }: PageLayoutProps) => {
  return (
    <>
      <Title level={2} style={{ margin: 0 }}>
        {title}
      </Title>
      {children}
    </>
  );
};

export default PageLayout;
