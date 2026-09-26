import { Card, Typography } from 'antd';

type V2PlaceholderPageProps = {
  title: string;
  description: string;
};

const V2PlaceholderPage = ({ title, description }: V2PlaceholderPageProps) => (
  <Card>
    <Typography.Title level={2}>{title}</Typography.Title>
    <Typography.Paragraph>{description}</Typography.Paragraph>
  </Card>
);

export default V2PlaceholderPage;
