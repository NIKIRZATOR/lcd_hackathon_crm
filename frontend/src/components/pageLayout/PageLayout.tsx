import { Flex, Typography } from 'antd';
import type { PropsWithChildren } from 'react';

const { Title, Text } = Typography;

interface PageLayoutProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
}

const PageLayout = ({ title, subtitle, children }: PageLayoutProps) => {
  return (
    <>
      {(title || subtitle) && (
        <Flex vertical gap={6}>
          {title && (
            <Title level={1} style={{ margin: 0 }}>
              {title}
            </Title>
          )}

          {subtitle && <Text type="secondary">{subtitle}</Text>}
        </Flex>
      )}

      {children}
    </>
  );
};

export default PageLayout;
